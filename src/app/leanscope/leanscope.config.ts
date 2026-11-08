import type { ApiKeyVendor } from './agent-server.types';

export interface LeanScopeSecrets {
  accessToken: string;
  apiKeys: Partial<Record<ApiKeyVendor, string>>;
}

export interface LeanScopeEnv extends LeanScopeSecrets {
  choreoScenarioGuid: string;
}

export interface LeanScopeConfig extends LeanScopeEnv {
  agentServerUrl: string;
  locale?: string;
}

const LLM_VENDORS: ApiKeyVendor[] = ['openai', 'anthropic', 'mistral', 'google'];

export function missingConfig(config: LeanScopeConfig): string[] {
  const missing: string[] = [];
  if (!config.agentServerUrl.trim()) missing.push('agentServerUrl in src/app/environment.ts');
  if (!config.choreoScenarioGuid.trim()) missing.push('LEANSCOPE_CHOREO_SCENARIO_GUID in .env');
  if (!config.accessToken.trim())
    missing.push('LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN in .env');
  if (!LLM_VENDORS.some((vendor) => config.apiKeys[vendor]?.trim())) {
    missing.push(
      'LEANSCOPE_OPENAI_API_KEY, LEANSCOPE_ANTHROPIC_API_KEY, LEANSCOPE_GOOGLE_API_KEY or LEANSCOPE_MISTRAL_API_KEY in .env',
    );
  }
  return missing;
}

export function nonEmptyApiKeys(
  apiKeys: LeanScopeSecrets['apiKeys'],
): Partial<Record<ApiKeyVendor, string>> {
  return Object.fromEntries(
    Object.entries(apiKeys)
      .map(([vendor, key]) => [vendor, key?.trim()])
      .filter(([, key]) => key),
  );
}
