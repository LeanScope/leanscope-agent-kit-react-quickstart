import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ENV_FILE = join(root, '.env');
const PLUGIN = 'leanscope-agent-kit@leanscope';

const SECRETS = [
  { env: 'LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN', plugin: 'token' },
  { env: 'LEANSCOPE_OPENAI_API_KEY', plugin: 'openai' },
  { env: 'LEANSCOPE_ANTHROPIC_API_KEY', plugin: 'anthropic' },
  { env: 'LEANSCOPE_MISTRAL_API_KEY', plugin: 'mistral' },
  { env: 'LEANSCOPE_GOOGLE_API_KEY', plugin: 'google' },
  { env: 'LEANSCOPE_ELEVENLABS_API_KEY', plugin: 'elevenlabs' },
  { env: 'LEANSCOPE_TYPESAFE_API_KEY', plugin: 'typesafe' },
];

export function readEnvFile(file = ENV_FILE) {
  if (!existsSync(file)) return {};
  const values = {};
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2];
    const quoted = value.match(/^(['"])(.*)\1$/);
    if (quoted) value = quoted[2];
    else value = value.replace(/\s+#.*$/, '').trim();
    values[match[1]] = value;
  }
  return values;
}

const APP_SETTINGS = ['LEANSCOPE_CHOREO_SCENARIO_GUID'];

export function describeEnv(env = readEnvFile()) {
  if (!existsSync(ENV_FILE)) {
    return 'No .env yet: copy .env.example to .env and fill in your choreo guid, LeanScope token and an LLM key.';
  }
  const set = [...APP_SETTINGS, ...SECRETS.map((secret) => secret.env)].filter((name) => env[name]);
  return `Values from .env: ${set.length ? set.join(', ') : 'none set'}.`;
}

function findClaude() {
  try {
    execFileSync('claude', ['--version'], { stdio: 'ignore' });
    return 'claude';
  } catch {
    // Not installed on PATH; check the editor-bundled CLI below.
  }
  const binary = process.platform === 'win32' ? 'claude.exe' : 'claude';
  for (const editor of ['.vscode', '.vscode-insiders', '.cursor']) {
    const dir = join(homedir(), editor, 'extensions');
    if (!existsSync(dir)) continue;
    const newest = readdirSync(dir)
      .filter((name) => name.startsWith('anthropic.claude-code-'))
      .map((name) => join(dir, name, 'resources', 'native-binary', binary))
      .filter((path) => existsSync(path))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .pop();
    if (newest) return newest;
  }
  return null;
}

function configureClaude(env) {
  const values = Object.fromEntries(
    SECRETS.filter((secret) => env[secret.env]).map((secret) => [secret.plugin, env[secret.env]]),
  );
  if (!values.token) {
    console.error('LEANSCOPE_PERSONAL_TEAM_REPOS_ACCESS_TOKEN is not set in .env.');
    return 1;
  }
  const claude = findClaude();
  if (!claude) {
    console.error(
      `Claude Code CLI not found. Install it (https://code.claude.com) or run /plugin configure ${PLUGIN} in a Claude Code session.`,
    );
    return 1;
  }
  const result = spawnSync(claude, ['plugin', 'configure', PLUGIN, '--values-stdin'], {
    input: JSON.stringify(values),
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  if (result.status !== 0) {
    console.error(`Could not configure ${PLUGIN} (exit code ${result.status ?? 'unknown'}).`);
    console.error(
      `Is the plugin installed? Start a Claude Code session in this folder and accept the install, or run:\n  "${claude}" plugin install ${PLUGIN} --scope project`,
    );
    return 1;
  }
  console.log(`Stored in Claude Code (${PLUGIN}): ${Object.keys(values).join(', ')}.`);
  console.log('Start a new Claude Code session so the LeanScope MCP servers use them.');
  return 0;
}

function updatePlugin() {
  const claude = findClaude();
  if (!claude) {
    console.error('Claude Code CLI not found. Install it (https://code.claude.com).');
    return 1;
  }
  for (const args of [
    ['plugin', 'marketplace', 'update', 'leanscope'],
    ['plugin', 'update', PLUGIN, '--scope', 'project'],
  ]) {
    const result = spawnSync(claude, args, { stdio: 'inherit' });
    if (result.status !== 0) return result.status ?? 1;
  }
  console.log('Start a new Claude Code session (or reload the window) to use the new version.');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--update-plugin')) process.exit(updatePlugin());
  const env = readEnvFile();
  console.log(describeEnv(env));
  if (process.argv.includes('--claude')) process.exit(configureClaude(env));
}
