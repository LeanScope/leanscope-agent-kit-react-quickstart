export interface SessionRequest {
  choreoScenarioGuid: string;
  choreoRepositoryId?: string;
  apiKeys?: Partial<Record<ApiKeyVendor, string>>;
  locale?: string;
  initialInput?: Record<string, unknown>;
  autoStart?: boolean;
  lmProvider?: string;
  lmModel?: string;
}

export type ApiKeyVendor =
  'openai' | 'anthropic' | 'mistral' | 'google' | 'elevenlabs' | 'typesafe';

export interface SessionResponse {
  sessionId: string;
  sessionScenarioGuid: string;
  sessionToken: string;
  controllerUrl: string;
  uiUrl: string;
  markdown: string;
}

export interface Step {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | string;
  guid: string;
  scenarioGuid: string | null;
  listIndex: number | null;
  title: string | null;
  line: string;
  actorSymbolRef: string | null;
  predecessorRefs: string[] | null;
  questions: string | null;
  actions: string | null;
  meanTime?: string | null;
  actorGuid?: string | null;
  pending?: boolean;
}

export interface HistoryResponse {
  steps: Step[];
  degraded?: boolean;
}

export interface AnswerSchema {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, AnswerPropertySchema>;
  required?: string[];
  [key: string]: unknown;
}

export interface AnswerPropertySchema {
  type?: string | string[];
  title?: string;
  description?: string;
  enum?: unknown[];
  oneOf?: { const?: unknown; title?: string; [key: string]: unknown }[];
  anyOf?: { const?: unknown; title?: string; [key: string]: unknown }[];
  format?: string;
  maxLength?: number;
  default?: unknown;
  [key: string]: unknown;
}

export type EndReason =
  'terminal' | 'infinite-loop' | 'choreo-structure-changed' | 'composed-turn-refused' | string;

export interface PendingStep {
  status: 'asking' | 'working' | 'ended';
  step?: PendingQuestion;
  endReason?: EndReason;
}

export interface PendingQuestion {
  guid: string;
  question?: string;
  askedBy?: string;
  schema?: AnswerSchema;
  fieldKeys: string[];
  required: string[];
  prefill?: Record<string, unknown>;
}

export interface GateFrame {
  state: 'waiting' | 'open' | string;
}

export interface SessionEndingFrame {
  reason: EndReason;
}

export interface SseFrame {
  event: string;
  data: unknown;
}
