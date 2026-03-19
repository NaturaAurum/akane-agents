---
description: Produce the final Akane synthesis artifact
agent: build
subtask: false
---

<!-- managed-by: opencode-akane -->

Load the `akane-workflow` skill, then use the `akane_synthesize` tool in the current repository.

Task: $ARGUMENTS

Requirements:
- Use the current Akane plan, implementation, and review artifacts as the source of truth.
- Update `.opencode/akane/final-synthesis.md`.
- Keep the final reply concise and mention which artifact changed.
