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
- `src/workflow.ts`: child-session orchestration, stage prompts, and artifact handoff
- `src/tools/akane-plan.ts`: planner stage
- `src/tools/akane-plan-review.ts`: plan review stage
- `src/tools/akane-implement.ts`: implementation stage
- `src/tools/akane-review.ts`: review stage
- `src/tools/akane-synthesize.ts`: final synthesis stage
- `src/tools/akane-run.ts`: end-to-end MVP workflow runner
- `examples/akane.example.json`: example global Akane config

## Local development

```bash
bun install
bun run typecheck
bun run build
```

The build emits `dist/index.js` as the package entrypoint and also keeps `dist/akane.js` for local file-based linking.

## Available tools

Once the plugin is loaded in OpenCode, the current MVP exposes these tools:

- `akane_init`
- `akane_stage_artifact`
- `akane_plan`
- `akane_plan_review`
- `akane_implement`
- `akane_review`
- `akane_synthesize`
- `akane_run`

Notes:

- `akane_init` is optional because the stage tools lazily create `.opencode/akane/` on first use
- `akane_run` is the main MVP entrypoint when you want to test the full workflow

## Repo-local commands and skill

This repository now includes project-local OpenCode command files in `.opencode/commands/` and a project-local skill at `.opencode/skills/akane-workflow/SKILL.md`.

That gives you slash-command style entrypoints such as:

- `/akane-init`
- `/akane-plan`
- `/akane-plan-review`
- `/akane-implement`
- `/akane-review`
- `/akane-synthesize`
- `/akane-run`

The commands are thin wrappers that tell OpenCode to load the `akane-workflow` skill and then invoke the matching `akane_*` tool while reusing existing artifacts in `.opencode/akane/`.
When the Akane plugin loads, it now bootstraps these managed command and skill files into the global OpenCode paths under `~/.config/opencode/commands/` and `~/.config/opencode/skills/akane-workflow/`.
Existing files are only updated automatically when they are recognized as Akane-managed copies.

## Package install

For package-based installation, publish this repository to npm and add it to the OpenCode plugin array in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "oh-my-opencode@latest",
    "opencode-akane@latest"
  ]
}
```

Akane still reads its runtime config from `~/.config/opencode/akane.json`.
If that file does not exist yet, the plugin now bootstraps it automatically on first load with the default config.
You only need to edit it when you want to override the default role or artifact settings.
By default, Akane stays model-first and does not depend on `oh-my-opencode`.
`workflow.agentMode` is the explicit routing switch:

- `models`: Akane routes by model only
- `native`: Akane uses OpenCode native/custom agents like `plan`, `build`, and `general`
- `omo`: Akane prefers OMO agent names like `prometheus`, `atlas`, and `momus`

`workflow.preferAgents` is still supported for backward compatibility, but `workflow.agentMode` should be preferred for new configs.
`workflow.stageTimeoutMinutes` controls the per-stage timeout budget and defaults to hour-scale values.

`akane.json` supports both model routing and agent routing:

```json
{
  "workflow": {
    "agentMode": "omo",
    "stageTimeoutMinutes": {
      "plan": 180,
      "plan-review": 180,
      "implementation-context": 360,
      "review-codex": 180,
      "review-claude": 180,
      "final-synthesis": 180
    }
  },
  "roleAgents": {
    "planner": "prometheus",
    "plan_reviewer": "hephaestus",
    "implementer": "atlas",
    "reviewer_codex": "momus",
    "reviewer_claude": "oracle",
    "synthesizer": "sisyphus"
  }
}
```

For native OpenCode agents, the config is typically closer to:

```json
{
  "workflow": {
    "agentMode": "native",
    "stageTimeoutMinutes": {
      "plan": 180,
      "plan-review": 180,
      "implementation-context": 360,
      "review-codex": 180,
      "review-claude": 180,
      "final-synthesis": 180
    }
  },
  "roleAgents": {
    "planner": "plan",
    "plan_reviewer": "general",
    "implementer": "build",
    "reviewer_codex": "general",
    "reviewer_claude": "akane-review-claude",
    "synthesizer": "general"
  }
}
```

## Publish flow

The package is prepared to publish from npm with:

```bash
bun install
bun run typecheck
bun run build
npm publish
```

Useful checks before publishing:

```bash
bun run pack:check
```

Notes:

- The current package name assumption is `opencode-akane`
- The current license is `MIT`
- If you later switch to a scoped package name, publish with `npm publish --access public`

## Automated publishing

This repository includes GitHub Actions workflows for CI and npm publishing:

- `.github/workflows/ci.yml`: runs install, typecheck, build, and `npm pack --dry-run`
- `.github/workflows/publish.yml`: publishes to npm when a tag like `v0.1.0` is pushed

Recommended setup for public release:

1. Make the GitHub repository public
2. Publish `opencode-akane` once manually from your npm account, or reserve the package name
3. In npm package settings, add a Trusted Publisher for:
   - GitHub owner: `NaturaAurum`
   - Repository: `akane-agents`
   - Workflow filename: `publish.yml`
4. Push a version tag that matches `package.json`, for example:

```bash
git tag v0.1.0
git push origin main --tags
```

The publish workflow intentionally uses npm trusted publishing with GitHub OIDC instead of an `NPM_TOKEN`.
