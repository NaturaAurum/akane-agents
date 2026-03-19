---
description: Run the end-to-end Akane workflow
agent: build
subtask: false
---

<!-- managed-by: opencode-akane -->

Load the `akane-workflow` skill, then use the `akane_run` tool in the current repository.

Task: $ARGUMENTS

Requirements:
- Reuse existing Akane artifacts when present instead of starting from scratch.
- If the plan artifact is already implementation-ready, continue from the next sensible stage.
- Respect the current Akane configuration for routing and timeout behavior.
- Keep the final reply concise and mention completed stages and updated artifact paths.
