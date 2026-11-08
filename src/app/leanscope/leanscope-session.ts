import type {
  EndReason,
  GateFrame,
  HistoryResponse,
  PendingQuestion,
  PendingStep,
  SessionEndingFrame,
  SessionRequest,
  SessionResponse,
  SseFrame,
  Step,
} from './agent-server.types';
import { missingConfig, nonEmptyApiKeys, type LeanScopeConfig } from './leanscope.config';
import { readSseFrames } from './sse-parser';

export type SessionState =
  'idle' | 'connecting' | 'waiting' | 'working' | 'asking' | 'ended' | 'error';

export interface SessionSnapshot {
  state: SessionState;
  steps: Step[];
  pendingQuestion: PendingQuestion | null;
  session: SessionResponse | null;
  error: string | null;
  endReason: EndReason | null;
}

const INITIAL_SNAPSHOT: SessionSnapshot = {
  state: 'idle',
  steps: [],
  pendingQuestion: null,
  session: null,
  error: null,
  endReason: null,
};

export class LeanScopeSession {
  private snapshot = INITIAL_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private readonly frameListeners = new Set<(frame: SseFrame) => void>();
  private abort: AbortController | null = null;
  private run = 0;
  private refreshing: Promise<void> | null = null;
  private refreshAgain = false;

  constructor(
    private readonly config: LeanScopeConfig,
    // Wrapped so the browser's fetch is never called with `this` set to the session.
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  readonly getSnapshot = (): SessionSnapshot => this.snapshot;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get isActive(): boolean {
    return ['connecting', 'waiting', 'working', 'asking'].includes(this.snapshot.state);
  }

  async start(overrides: Partial<SessionRequest> = {}): Promise<void> {
    this.stop();
    const run = this.run;
    const missing = missingConfig(this.config);
    if (missing.length > 0) {
      this.fail(`Missing configuration: ${missing.join('; ')}.`);
      return;
    }

    this.update({ state: 'connecting' });
    const request: SessionRequest = {
      choreoScenarioGuid: this.config.choreoScenarioGuid.trim(),
      apiKeys: nonEmptyApiKeys(this.config.apiKeys),
      autoStart: true,
      ...(this.config.locale ? { locale: this.config.locale } : {}),
      ...overrides,
    };

    try {
      const response = await this.fetcher(
        `${this.config.agentServerUrl.replace(/\/+$/, '')}/api/v1/sessions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.accessToken.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        },
      );
      if (run !== this.run) return;
      if (!response.ok) {
        this.fail(await createErrorMessage(response));
        return;
      }

      const session = (await response.json()) as SessionResponse;
      if (!session.controllerUrl || !session.sessionToken) {
        this.fail('The agent server returned an invalid session response.');
        return;
      }
      if (run !== this.run) return;
      this.update({
        session,
        state: request.autoStart === false ? 'waiting' : 'working',
      });

      await this.loadHistory(run);
      if (run !== this.run) return;
      if (this.snapshot.state === 'error') return;
      this.follow(run);
      void this.refreshPending();
    } catch (error) {
      if (run === this.run) this.fail(`Could not initialize the session: ${messageOf(error)}`);
    }
  }

  async begin(): Promise<void> {
    const response = await this.call('/start', { method: 'POST' });
    if (response && !response.ok)
      this.update({ error: `Could not start the session (${response.status}).` });
  }

  async submit(answer: Record<string, unknown>): Promise<boolean> {
    const response = await this.call('/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answer),
    });
    if (!response) return false;
    if (response.status === 204 || response.ok) {
      this.update({ error: null, pendingQuestion: null });
      if (this.snapshot.state === 'asking') this.update({ state: 'working' });
      void this.refreshPending();
      return true;
    }
    if (response.status === 409) {
      this.update({ error: 'That question is no longer open.' });
      void this.refreshPending();
    } else if (response.status === 503) {
      this.update({ error: 'The session has not started yet. Try again in a moment.' });
    } else {
      this.update({
        error: `Your answer was not accepted (${response.status}): ${await errorText(response)}`,
      });
    }
    return false;
  }

  stop(): void {
    this.run += 1;
    this.abort?.abort();
    this.abort = null;
    this.refreshing = null;
    this.refreshAgain = false;
    this.snapshot = INITIAL_SNAPSHOT;
    this.emit();
  }

  onFrame(listener: (frame: SseFrame) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  private async loadHistory(run: number): Promise<void> {
    const response = await this.call('/history');
    if (run !== this.run) return;
    if (!response) throw new Error('Could not load the session history.');
    if (!response.ok)
      throw new Error(
        `Could not load the session history (${response.status}): ${await errorText(response)}`,
      );
    const history = (await response.json()) as HistoryResponse;
    if (run !== this.run) return;
    for (const step of history.steps ?? []) this.upsertStep(step);
  }

  private follow(run: number): void {
    const session = this.snapshot.session;
    if (!session) return;
    const abort = new AbortController();
    this.abort = abort;

    void (async () => {
      try {
        const response = await this.fetcher(`${session.controllerUrl}/events`, {
          headers: { Accept: 'text/event-stream' },
          signal: abort.signal,
        });
        if (!response.ok || !response.body)
          throw new Error(`events stream answered ${response.status}`);
        for await (const frame of readSseFrames(response.body)) {
          if (run !== this.run) return;
          this.handleFrame(frame);
        }
        if (run === this.run && this.snapshot.state !== 'ended') {
          this.end(this.snapshot.endReason ?? 'terminal');
        }
      } catch (error) {
        if (abort.signal.aborted || run !== this.run) return;
        if (this.snapshot.state !== 'ended')
          this.fail(`Lost the connection to the session: ${messageOf(error)}`);
      }
    })();
  }

  private handleFrame(frame: SseFrame): void {
    for (const listener of this.frameListeners) listener(frame);
    switch (frame.event) {
      case 'step':
        this.upsertStep(frame.data as Step);
        void this.refreshPending();
        break;
      case 'gate': {
        const { state } = frame.data as GateFrame;
        if (state === 'waiting' && this.snapshot.state === 'working')
          this.update({ state: 'waiting' });
        if (state === 'open' && this.snapshot.state === 'waiting')
          this.update({ state: 'working' });
        break;
      }
      case 'session_ending':
        this.end((frame.data as SessionEndingFrame).reason);
        break;
      case 'error':
        this.update({
          error: (frame.data as { message?: string })?.message ?? 'The session reported an error.',
        });
        break;
    }
  }

  private upsertStep(step: Step): void {
    const steps = this.snapshot.steps;
    const index = steps.findIndex((existing) => existing.guid === step.guid);
    if (step.action === 'DELETE') {
      if (index !== -1) this.update({ steps: steps.filter((_, position) => position !== index) });
      return;
    }
    if (index === -1) {
      this.update({ steps: [...steps, step] });
      return;
    }
    const next = [...steps];
    next[index] = step;
    this.update({ steps: next });
  }

  private refreshPending(): Promise<void> {
    if (this.refreshing) {
      this.refreshAgain = true;
      return this.refreshing;
    }
    const run = this.run;
    this.refreshing = (async () => {
      do {
        this.refreshAgain = false;
        const response = await this.call('/steps/pending');
        if (!response || run !== this.run) return;
        if (!response.ok) {
          this.update({
            error: `Could not refresh the pending question (${response.status}): ${await errorText(response)}`,
          });
          return;
        }
        const pending = (await response.json()) as PendingStep;
        if (run !== this.run || this.snapshot.state === 'ended' || this.snapshot.state === 'error')
          return;
        if (pending.status === 'asking' && pending.step) {
          this.update({ pendingQuestion: pending.step, state: 'asking' });
        } else if (pending.status === 'ended') {
          this.end(pending.endReason ?? 'terminal');
        } else {
          this.update({
            pendingQuestion: null,
            ...(this.snapshot.state === 'asking' ? { state: 'working' as const } : {}),
          });
        }
      } while (this.refreshAgain && run === this.run);
    })()
      .catch((error: unknown) => {
        if (run === this.run)
          this.update({ error: `Could not refresh the pending question: ${messageOf(error)}` });
      })
      .finally(() => {
        if (run === this.run) this.refreshing = null;
      });
    return this.refreshing;
  }

  private async call(path: string, init: RequestInit = {}): Promise<Response | null> {
    const session = this.snapshot.session;
    if (!session) return null;
    try {
      return await this.fetcher(`${session.controllerUrl}${path}`, init);
    } catch (error) {
      this.update({ error: `Could not reach the session: ${messageOf(error)}` });
      return null;
    }
  }

  private end(reason: EndReason): void {
    this.update({ endReason: reason, pendingQuestion: null, state: 'ended' });
    this.abort?.abort();
  }

  private fail(error: string): void {
    this.update({ error, state: 'error' });
    this.abort?.abort();
  }

  private update(patch: Partial<SessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

async function createErrorMessage(response: Response): Promise<string> {
  const detail = await errorText(response);
  switch (response.status) {
    case 401:
    case 403:
      return `LeanScope did not accept the access token (${response.status}). Check LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN in .env. ${detail}`;
    case 404:
      return `The choreo was not found (404). Check LEANSCOPE_CHOREO_SCENARIO_GUID in .env. ${detail}`;
    case 422:
      return `The agent server needs your own LLM key (422). Add an OpenAI, Anthropic, Google or Mistral key to .env. ${detail}`;
    default:
      return `Could not create the session (${response.status}). ${detail}`;
  }
}

async function errorText(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  try {
    const body = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    const message = typeof body.error === 'string' ? body.error : body.error?.message;
    return message ?? body.message ?? text;
  } catch {
    return text.slice(0, 300);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
