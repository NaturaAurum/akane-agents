---
description: Initialize the Akane workspace in this repo
agent: build
subtask: false
---

<!-- managed-by: opencode-akane -->

Load the `akane-workflow` skill, then use the `akane_init` tool in the current repository.

Requirements:
- Initialize or refresh the `.opencode/akane/` workspace.
- Do not overwrite existing artifacts unless the current state is clearly inconsistent.
- Keep the final reply concise and mention the workspace path and created files.
