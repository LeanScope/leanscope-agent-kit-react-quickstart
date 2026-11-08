# Agent instructions

This repository is a starter for a React MVP on LeanScope. Help the user get from a selected
choreo to their first working screens.

## How the pieces fit

- **While you build:** the LeanScope Agent Kit gives you skills and the `leanscope-admin`,
  `leanscope-graphql` and `leanscope-agents` MCP servers. Use them to find or model a choreo,
  test-run it, and understand its personas and user stories.
- **While the app runs:** this React app talks to the LeanScope Agent Server REST + SSE API through
  `LeanScopeSession` in `src/app/leanscope/`. The app never calls the MCP servers.

A **choreo** is a LeanScope Scenario that the agent server runs as a conversation between AI
personas and a human. This starter runs one choreo, shows its conversation and renders a form for
the current question. The application-specific screens are yours to build.

## Workflow

1. **Connect.** Use the `leanscope-quickstart` skill to check the MCP servers and find the
   repository from the user's token. Never ask for a repository id.
2. **Pick a choreo.** List the choreos in the repository and let the user choose one, or create one
   with the `model-a-choreo` skill when the user describes a new use case.
3. **Configure the app.** Ask the user to set `LEANSCOPE_CHOREO_SCENARIO_GUID`, their token and an
   LLM key in their local `.env`. Give them the choreo `_guid`; never commit it in source.
4. **Test-run it.** Use the `run-a-choreo` skill once to understand what the choreo asks and in
   which order.
5. **Plan the MVP.** Read the Scenario, ScenarioSteps, Personas and UserStories through
   `leanscope-graphql` (`search_schema`, then `query_graphql`). Propose the screens and get the
   user's approval before building them.
6. **Build.** Put app-specific screens and logic under `src/app/features/`. Drive the conversation
   through `useLeanScopeSession()` and the generic client in `src/app/leanscope/`. Run `npm run
dev` and ask the user to try the app at http://localhost:5173.
7. **Optional worker.** If a choreo step needs the user's code to run server-side, use the
   `write-a-worker` skill and place the worker under `leanscope-worker/`.

## Secrets

- Secrets and the choreo guid belong only in the gitignored `.env`; names are listed in
  `.env.example`. Never open, read, print or edit `.env`.
- Vite loads the selected `LEANSCOPE_*` variables in `vite.config.ts` and injects them at build
  time. Do not add a different secret-loading mechanism.
- `npm run connect:claude` transfers set values to the Agent Kit plugin's settings via stdin; it
  prints only variable names. Never ask the user to paste a key into chat.
- Never commit `.env` or put a token/key in a source file, test or commit message.
- Keys are included in the browser bundle for local development. If the user wants to deploy,
  explain that a backend must hold the secrets and create sessions; do not deploy this setup as-is.
- Do not add a root `.mcp.json`; the Claude plugin already provides its MCP servers.

## React conventions

- Use functional React components and hooks with TypeScript.
- Keep `src/app/leanscope/` generic and updateable from the template. Put product-specific work
  under `src/app/features/`.
- No UI library is installed; add one only if the user requests it.
- Before finishing, run `npm test` and `npm run build`.

## Agent Server API

The generic client handles these routes. The full API is documented at
https://dev.api.agents.leanscope.ai/api/v1/docs.

| Call                                | Purpose                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `POST /api/v1/sessions`             | Creates a session and returns a `sessionToken`, `controllerUrl` and `uiUrl` |
| `GET {controllerUrl}/history`       | Loads steps recorded before the app connected                               |
| `GET {controllerUrl}/events`        | Follows the SSE stream                                                      |
| `GET {controllerUrl}/steps/pending` | Reads the current question and JSON Schema                                  |
| `POST {controllerUrl}/submit`       | Submits an answer matching the schema                                       |

Only session creation needs the personal access token. The session routes are authorized by the
`sessionToken` in the URL.
