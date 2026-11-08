import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { parse } from 'dotenv';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));
const envFile = join(root, '.env');
const env = existsSync(envFile) ? parse(readFileSync(envFile)) : {};

export default defineConfig(() => {
  const apiKeys = Object.fromEntries(
    [
      ['openai', 'LEANSCOPE_OPENAI_API_KEY'],
      ['anthropic', 'LEANSCOPE_ANTHROPIC_API_KEY'],
      ['google', 'LEANSCOPE_GOOGLE_API_KEY'],
      ['mistral', 'LEANSCOPE_MISTRAL_API_KEY'],
      ['elevenlabs', 'LEANSCOPE_ELEVENLABS_API_KEY'],
      ['typesafe', 'LEANSCOPE_TYPESAFE_API_KEY'],
    ].map(([vendor, name]) => [vendor, env[name] ?? '']),
  );
  const secrets = {
    choreoScenarioGuid: env.LEANSCOPE_CHOREO_SCENARIO_GUID ?? '',
    accessToken: env.LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN ?? '',
    apiKeys,
  };

  return {
    plugins: [react()],
    define: {
      LEANSCOPE_SECRETS: JSON.stringify(secrets),
    },
    server: { host: 'localhost', port: 5173 },
    preview: { host: 'localhost', port: 4173 },
  };
});
