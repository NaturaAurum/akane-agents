---
description: Review the current Akane plan artifact
agent: build
subtask: false
---

<!-- managed-by: opencode-akane -->

Load the `akane-workflow` skill, then use the `akane_plan_review` tool in the current repository.

Task: $ARGUMENTS

Requirements:
- Read the existing plan artifact first and continue from the current Akane state.
- Update `.opencode/akane/plan-review.md`.
- Keep the final reply concise and mention which artifact changed.
