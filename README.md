# LeanScope Agent Kit — React Quickstart

Fork this repository to build a minimum viable React app around a LeanScope choreo. The app runs
the conversation through the **LeanScope Agent Server**; the **LeanScope Agent Kit** helps your
coding agent find or model the choreo and test-run it.

```
While you build                         While the app runs
───────────────                         ──────────────────
Coding agent (Claude Code, …)           This React app
  └─ LeanScope Agent Kit plugin            └─ LeanScopeSession
       └─ LeanScope MCP servers                  └─ LeanScope Agent Server (REST + SSE)
          (models, test-runs and reads              (AI personas talk with your user)
           your choreos)
```

A **choreo** is a LeanScope Scenario that the agent server plays out as a conversation between AI
personas and a human. This starter can start one choreo, show the conversation and render a form
for each question. Build your product screens around that flow.

## What you need

- Node.js 22.22.3+, 24.15+ or 26+ (`nvm use` reads `.nvmrc`)
- A LeanScope personal team-repos access token: https://app.leanscope.ai/ → your avatar
- An OpenAI, Anthropic, Google Gemini or Mistral API key; sessions run on your own key
- Optional TypeSafe API key for 🎯 Decision Model steps
- Claude Code, or another coding agent set up with the LeanScope Agent Kit

## Get started

1. **Create your copy:** choose **Use this template** on GitHub (or fork), then clone it.
2. **Install dependencies:** `npm install`
3. **Create `.env`:** copy `.env.example` to `.env` and enter your credentials locally. Do not paste
   secrets into chat. Leave `LEANSCOPE_CHOREO_SCENARIO_GUID` empty until you choose a choreo.
4. **Connect Claude Code:** open the project in Claude Code (CLI or VS Code extension). The
   `.claude/settings.json` file enables the Agent Kit plugin.
   - Accept the plugin install when prompted.
   - Run `npm run connect:claude` to store values from `.env` in the plugin's settings (OS
     keychain). Run it again when you change `.env`; values are sent through stdin and never
     printed.
   - Start a new session. `/mcp` should list `leanscope-admin`, `leanscope-graphql` and
     `leanscope-agents` as connected.
   - To pull the latest plugin now, run `npm run update:plugin`.
5. **Ask your agent:**

   > Set up LeanScope in this project and help me build an MVP for my choreo.

   Follow [AGENTS.md](AGENTS.md): connect, select or model a choreo, configure its guid, test-run
   it, propose screens, and build the approved MVP.

6. **Run the app:** `npm run dev`, then open http://localhost:5173.

## Project layout

```
.env.example                     variable names; copy to .env and fill in locally
.claude/settings.json            enables the Agent Kit plugin for Claude Code
AGENTS.md, CLAUDE.md             instructions and workflow for coding agents
vite.config.ts                   reads .env and injects only the named app settings
src/app/leanscope/               generic LeanScope session client, SSE parser and answer fields
src/app/leanscope/ui/            transcript and pending-question form
src/app/pages/                   minimal setup and session pages
src/app/features/                your MVP screens
```

## Use the session in your own screens

`useLeanScopeSession()` returns `session` and a snapshot with the current `state`, `steps`,
`pendingQuestion`, `error` and `endReason`. Start and answer through the client:

```tsx
function OnboardingPage() {
  const { session, state, steps, pendingQuestion } = useLeanScopeSession();

  return (
    <>
      <button onClick={() => void session.start({ initialInput: { company: 'ACME' } })}>
        Start
      </button>
      <p>{state}</p>
      {steps.map((step) => (
        <p key={step.guid}>{step.line}</p>
      ))}
      {pendingQuestion && (
        <button onClick={() => void session.submit({ message: 'My answer' })}>Answer</button>
      )}
    </>
  );
}
```

`session.onFrame(frame => …)` exposes every SSE frame, including frames the client does not handle
(`inventory`, `tool_activity`, `tts_audio`, …). The full API is at
https://dev.api.agents.leanscope.ai/api/v1/docs.

## Open the app from LeanScope Classic

The agent server's `run-choreo` plugin can open this app instead of its own UI:

1. In LeanScope, set the theme's `uiBaseUrl` parameter to `http://localhost:5173/`.
2. Run `npm start`.
3. Run the choreo from LeanScope Classic.

The plugin creates the session and opens `http://localhost:5173/?sessionToken=<token>`. The app
then shows the session page, which calls `client.attach(token)` instead of `start()`. Attaching
needs no access token, choreo guid or LLM key: the session token authorizes every session route.
The agent server must be the one in `environment.leanscope.agentServerUrl`.

## Scripts

| Command                  | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `npm run dev`            | Start the Vite dev server at http://localhost:5173  |
| `npm test`               | Run unit tests with Vitest                          |
| `npm run build`          | Type-check and create a production build in `dist/` |
| `npm run preview`        | Preview the production build locally                |
| `npm run connect:claude` | Store the `.env` values in the Agent Kit plugin     |
| `npm run update:plugin`  | Update the Agent Kit plugin in every coding agent that has it |

## Other coding agents

Claude Code is configured in this template. For another client, run the Agent Kit setup for that
client (avoid registering the same servers twice):

```sh
npx -y github:leanscope/leanscope-agent-kit --clients vscode
npx -y github:leanscope/leanscope-agent-kit --clients copilot-cli
npx -y github:leanscope/leanscope-agent-kit --clients codex
npx -y github:leanscope/leanscope-agent-kit --clients cursor
```

Diagnose a connection with `npx -y github:leanscope/leanscope-agent-kit --check --clients <client>`.
See the [Agent Kit README](https://github.com/leanscope/leanscope-agent-kit) for details.

To update the plugin later, run `npm run update:plugin`. VS Code and Cursor don't update it on
their own.

## Security: development only

The token and LLM keys from `.env` are included in the JavaScript bundle served to the browser.
Anyone who can open the app can read them. Keep this project local. Before deploying, move the
secrets into a backend that creates the session (`POST /api/v1/sessions`) and returns only the
`sessionToken` and `controllerUrl` to the browser. The session routes do not need the token.

## License

[MIT](LICENSE)
