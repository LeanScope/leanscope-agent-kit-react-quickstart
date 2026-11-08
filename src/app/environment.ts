import type { LeanScopeConfig, LeanScopeEnv } from './leanscope/leanscope.config';

const fromEnv: LeanScopeEnv =
  typeof LEANSCOPE_SECRETS === 'undefined'
    ? { choreoScenarioGuid: '', accessToken: '', apiKeys: {} }
    : LEANSCOPE_SECRETS;

export const environment: { leanscope: LeanScopeConfig } = {
  leanscope: {
    agentServerUrl: 'https://dev.api.agents.leanscope.ai',
    locale: 'en',
    ...fromEnv,
  },
};
