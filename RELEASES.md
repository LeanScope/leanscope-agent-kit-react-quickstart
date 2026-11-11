# Release notes

## 0.1.1 — 2026-11-11

- **`npm run update:plugin` works for every coding agent, not only Claude Code.** It finds each
  client that has the Agent Kit plugin and updates it: Claude Code through its CLI, GitHub Copilot
  in VS Code and Cursor by pulling their plugin clone. For Copilot CLI and Codex it prints the
  command to run. `npm run update:plugin -- --clients vscode` limits it to one client.

## 0.1.0 — 2026-11-08

First version of the React quickstart.

- React + TypeScript app built with Vite, with a generic client for creating and following LeanScope
  Agent Server sessions.
- A conversation transcript and JSON-Schema-driven answer form demonstrate the session flow.
- Claude Code is configured for the LeanScope Agent Kit; `.env` values can be transferred to its
  plugin without printing the values.
- Agent instructions guide the first choreo test-run and the creation of app-specific MVP screens.
- CI runs the unit tests and production build without requiring secrets.
