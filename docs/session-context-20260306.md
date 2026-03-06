# Session Context - 2026-03-06

## Objective

Build a global OpenCode plugin named `Akane` that reuses OpenCode's provider and auth stack while enforcing a deterministic multi-model workflow.

## Naming

- Service name: `Akane`
- Working repo path: `~/Desktop/Projects/akane-agents`
- Planned plugin file: `~/.config/opencode/plugins/akane.js`
- Planned global config file: `~/.config/opencode/akane.json`

## Desired Workflow

1. Claude Opus creates the plan
2. Codex reviews the plan
3. Codex implements
4. Codex can consult Opus or Sonnet during implementation
5. Codex and Claude review in parallel
6. Codex synthesizes the final result

## Role Mapping

- `planner` -> `anthropic/claude-opus-4-6`
- `plan_reviewer` -> `openai/gpt-5.3-codex`
- `implementer` -> `openai/gpt-5.3-codex`
- `consultant_primary` -> `anthropic/claude-opus-4-6`
- `consultant_secondary` -> `anthropic/claude-sonnet-4-6`
- `reviewer_codex` -> `openai/gpt-5.3-codex`
- `reviewer_claude` -> `anthropic/claude-opus-4-6`
- `synthesizer` -> `openai/gpt-5.3-codex`

## Architectural Decisions

- Workflow policy should be global rather than per-project
- Runtime artifacts should remain per-project under `.opencode/akane/`
- Do not rely on long-lived chat context for stage handoff
- Use artifact files between stages
- Prefer deterministic stage execution over prompt-only orchestration

## OMO Coexistence Strategy

`oh-my-opencode` may remain installed, but Akane should not depend on OMO orchestration.

Rules:

- Keep OMO installed only if needed
- Do not override OMO agent names
- Do not modify `oh-my-opencode.json` from Akane
- Avoid hidden routing overlap
- Treat OMO as manual-only when Akane is active

## Current Draft Files

Existing draft files in `~/.config/opencode/`:

- `akane.example.json`
- `akane.md`

These define:

- global workflow structure
- stage roles and models
- artifact layout
- MVP tool names

## MVP Direction

The first implementation should not try to build everything at once.

Start with:

1. config loader for `akane.json`
2. one plugin entry file
3. one or two stage tools
4. artifact read/write helpers
5. then full `akane_run`

## Planned Artifact Layout

- `${projectRoot}/.opencode/akane/plan.md`
- `${projectRoot}/.opencode/akane/plan-review.md`
- `${projectRoot}/.opencode/akane/implementation-context.md`
- `${projectRoot}/.opencode/akane/review-codex.md`
- `${projectRoot}/.opencode/akane/review-claude.md`
- `${projectRoot}/.opencode/akane/final-synthesis.md`
- `${projectRoot}/.opencode/akane/state.json`

## Notes

- `gpt-5.4` was not available in the current OpenCode model list
- `openai/gpt-5.3-codex` is available and should be the current Codex baseline
- `superpowers` active remnants were removed from `~/.config/opencode`
