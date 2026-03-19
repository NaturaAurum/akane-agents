---
description: Run the Akane implementation stage
agent: build
subtask: false
---

<!-- managed-by: opencode-akane -->

Load the `akane-workflow` skill, then use the `akane_implement` tool in the current repository.

Task: $ARGUMENTS

Requirements:
- Continue from existing Akane artifacts instead of restarting the workflow.
- Update `.opencode/akane/implementation-context.md`.
- Keep the final reply concise and mention changed code and artifact paths.
