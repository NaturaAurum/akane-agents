---
description: Run both Akane review stages
agent: build
subtask: false
---

<!-- managed-by: opencode-akane -->

Load the `akane-workflow` skill, then use the `akane_review` tool in the current repository with both reviewers.

Task: $ARGUMENTS

Requirements:
- Continue from the current Akane artifact state.
- Run both review outputs unless the current state clearly requires only one.
- Update `.opencode/akane/review-codex.md` and `.opencode/akane/review-claude.md`.
- Keep the final reply concise and mention which artifacts changed.
