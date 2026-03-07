# Akane Agents

Akane is a global OpenCode orchestration plugin draft.

Current direction:

- Keep OpenCode provider and auth infrastructure
- Keep `oh-my-opencode` installed but neutralized
- Drive a deterministic workflow across planning, review, implementation, and synthesis

See [docs/session-context-20260306.md](/Users/taewoo.kim/Desktop/Projects/akane-agents/docs/session-context-20260306.md) for the current working context.

## MVP scaffold

This repository now contains the first MVP skeleton for the plugin:

- `src/plugin.ts`: OpenCode plugin entry
- `src/config.ts`: `~/.config/opencode/akane.json` loader with defaults
- `src/artifacts.ts`: `.opencode/akane/` artifact and `state.json` helpers
- `src/tools/akane-init.ts`: initializes the per-project workspace
- `src/tools/akane-stage-artifact.ts`: writes stage artifacts deterministically
- `examples/akane.example.json`: example global Akane config

## Local development

```bash
bun install
bun run typecheck
bun run build
```

The build emits `dist/akane.js`, which is the intended plugin artifact to link or copy to `~/.config/opencode/plugins/akane.js`.
