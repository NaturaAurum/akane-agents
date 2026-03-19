---
name: akane-workflow
description: Use this when the user wants to run or continue the Akane workflow, update .opencode/akane artifacts, or use the repo-local /akane-* commands.
---

<!-- managed-by: opencode-akane -->

# Akane Workflow

## What I do

- Route work through the Akane tools and artifact flow.
- Keep `.opencode/akane/*.md` artifacts as the source of truth between stages.
- Prefer continuing an existing Akane run over regenerating completed stages.

## When to use me

Use this when the user:

- asks to run Akane or continue an Akane stage
- refers to `.opencode/akane/` artifacts
- uses repo-local commands like `/akane-run` or `/akane-plan`

## Workflow rules

- Prefer the repo-local slash commands first:
  - `/akane-init`
  - `/akane-plan`
  - `/akane-plan-review`
  - `/akane-implement`
  - `/akane-review`
  - `/akane-synthesize`
  - `/akane-run`
- If slash commands are unavailable, call the matching `akane_*` tool directly.
- Reuse existing artifacts whenever they already contain relevant output.
- If `.opencode/akane/plan.md` is already implementation-ready, continue from the next sensible stage instead of regenerating the plan.
- Keep responses short and mention which stage ran and which artifact paths changed.

## Stage map

- `akane_init` creates or refreshes the workspace.
- `akane_plan` writes `plan.md`.
- `akane_plan_review` writes `plan-review.md`.
- `akane_implement` writes `implementation-context.md` and may change repository files.
- `akane_review` writes `review-codex.md` and `review-claude.md`.
- `akane_synthesize` writes `final-synthesis.md`.
- `akane_run` orchestrates the full workflow and can continue from existing artifacts.

## Artifact-first policy

- Check `.opencode/akane/state.json` and existing stage artifacts before deciding what to run.
- Do not erase completed artifacts unless the user explicitly asks for a reset.
- When a stage times out or partially completes, preserve the artifact state and continue from the nearest valid stage on the next attempt.
