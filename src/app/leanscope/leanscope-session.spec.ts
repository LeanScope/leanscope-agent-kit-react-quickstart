import { describe, expect, it, vi } from 'vitest';
import type { Step } from './agent-server.types';
import type { LeanScopeConfig } from './leanscope.config';
import { LeanScopeSession } from './leanscope-session';

const serverUrl = 'https://agents.example';
const controllerUrl = `${serverUrl}/api/v1/sessions/token`;

const config: LeanScopeConfig = {
  agentServerUrl: serverUrl,
  choreoScenarioGuid: 'choreo-1',
  locale: 'en',
  accessToken: 'example-token',
  apiKeys: { openai: 'example-key', typesafe: 'example-typesafe-key', anthropic: '' },
};

const makeStep = (guid: string, line: string, action = 'CREATE'): Step => ({
  action,
  guid,
  scenarioGuid: 'session-1',
  listIndex: null,
  title: null,
  line,
  actorSymbolRef: 'agent',
  predecessorRefs: null,
  questions: null,
  actions: null,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function fakeServer() {
  const encoder = new TextEncoder();
  let eventStream!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      eventStream = controller;
    },
  });
  let pending: unknown = { status: 'working' };
  const calls: { method: string; url: string; init?: RequestInit }[] = [];

  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, init });
    if (method === 'POST' && url === `${serverUrl}/api/v1/sessions`) {
      return json({
        sessionId: '1',
        sessionScenarioGuid: 'session-1',
        sessionToken: 'token',
        controllerUrl,
        uiUrl: 'https://ui.example',
        markdown: '',
      });
    }
    if (url === `${controllerUrl}/history`) return json({ steps: [makeStep('a', 'Hello!')] });
    if (url === `${controllerUrl}/events`) return new Response(stream, { status: 200 });
    if (url === `${controllerUrl}/steps/pending`) return json(pending);
    if (method === 'POST' && url === `${controllerUrl}/submit`)
      return new Response(null, { status: 204 });
    return new Response('not found', { status: 404 });
  });

  return {
    fetcher,
    calls,
    setPending(value: unknown) {
      pending = value;
    },
    emit(event: string, data: unknown) {
      eventStream.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    },
  };
}

describe('LeanScopeSession', () => {
  it('creates a session with only non-empty keys and loads its history', async () => {
    const server = fakeServer();
    const session = new LeanScopeSession(config, server.fetcher);
    await session.start();

    const create = server.calls[0];
    expect(create.url).toBe(`${serverUrl}/api/v1/sessions`);
    expect((create.init?.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer example-token',
    );
    expect(JSON.parse(String(create.init?.body))).toEqual({
      choreoScenarioGuid: 'choreo-1',
      apiKeys: { openai: 'example-key', typesafe: 'example-typesafe-key' },
      autoStart: true,
      locale: 'en',
    });
    expect(session.getSnapshot().steps.map((step) => step.guid)).toEqual(['a']);
    expect(session.getSnapshot().state).toBe('working');
    session.stop();
  });

  it('updates from events, answers questions and ends sessions', async () => {
    const server = fakeServer();
    const session = new LeanScopeSession(config, server.fetcher);
    await session.start();

    server.emit('step', makeStep('a', 'How are you?', 'UPDATE'));
    server.setPending({
      status: 'asking',
      step: {
        guid: 'human-step',
        question: 'How are you?',
        fieldKeys: ['message'],
        required: ['message'],
      },
    });
    server.emit('step', { ...makeStep('human-step', ''), actorSymbolRef: 'human', pending: true });

    await vi.waitFor(() => expect(session.getSnapshot().state).toBe('asking'));
    expect(session.getSnapshot().pendingQuestion?.guid).toBe('human-step');
    expect(await session.submit({ message: 'Fine' })).toBe(true);
    expect(server.calls.find((call) => call.url.endsWith('/submit'))?.init?.body).toBe(
      '{"message":"Fine"}',
    );

    server.emit('session_ending', { reason: 'terminal' });
    await vi.waitFor(() => expect(session.getSnapshot().state).toBe('ended'));
    expect(session.getSnapshot().endReason).toBe('terminal');
  });

  it('surfaces rejected tokens and missing configuration', async () => {
    const rejected = new LeanScopeSession(
      config,
      vi.fn(async () => json({ error: { message: 'bad token' } }, 403)),
    );
    await rejected.start();
    expect(rejected.getSnapshot().state).toBe('error');
    expect(rejected.getSnapshot().error).toContain('did not accept the access token');

    const fetcher = vi.fn();
    const missing = new LeanScopeSession({ ...config, accessToken: '', apiKeys: {} }, fetcher);
    await missing.start();
    expect(fetcher).not.toHaveBeenCalled();
    expect(missing.getSnapshot().error).toContain('LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN');
  });

  it('attaches to a session created elsewhere, without token, choreo or keys', async () => {
    const server = fakeServer();
    const session = new LeanScopeSession(
      {
        ...config,
        agentServerUrl: `${serverUrl}/`,
        choreoScenarioGuid: '',
        accessToken: '',
        apiKeys: {},
      },
      server.fetcher,
    );
    expect(await session.attach(' token ')).toBe(true);

    expect(server.calls.some((c) => c.url === `${serverUrl}/api/v1/sessions`)).toBe(false);
    expect(session.getSnapshot().session?.controllerUrl).toBe(controllerUrl);
    expect(session.getSnapshot().state).toBe('waiting');
    expect(session.getSnapshot().steps.map((s) => s.line)).toEqual(['Hello!']);

    server.emit('gate', { state: 'open' });
    await vi.waitFor(() => expect(session.getSnapshot().state).toBe('working'));
  });

  it('explains an unknown session token', async () => {
    const session = new LeanScopeSession(config, fakeServer().fetcher);
    expect(await session.attach('unknown')).toBe(false);
    expect(session.getSnapshot().state).toBe('error');
    expect(session.getSnapshot().error).toContain('does not know this session');
  });
});
