---
description: Generate or refresh the Akane plan artifact
agent: build
subtask: false
---

Load the `akane-workflow` skill, then use the `akane_plan` tool in the current repository.

Task: $ARGUMENTS

Requirements:
- Reuse existing Akane artifacts when they already contain relevant context.
- Update the plan artifact in `.opencode/akane/plan.md`.
- Keep the final reply concise and mention which artifact changed.
