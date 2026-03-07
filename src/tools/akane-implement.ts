import type { PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import {
  executeImplementStage,
  resolveProjectRootFromArgs,
} from "../workflow.js";
import type { LoadedAkaneConfig } from "../types.js";

export function createAkaneImplementTool(
  pluginInput: PluginInput,
  configInfo: LoadedAkaneConfig,
) {
  return tool({
    description:
      "Implement the approved Akane plan in the repository and write implementation-context.md.",
    args: {
      task: tool.schema
        .string()
        .optional()
        .describe("Optional task restatement for the implementer stage."),
      notes: tool.schema
        .string()
        .optional()
        .describe("Optional additional implementation constraints."),
      projectRoot: tool.schema
        .string()
        .optional()
        .describe("Optional project root override. Defaults to the current session worktree."),
    },
    async execute(args, context) {
      try {
        const projectRoot = resolveProjectRootFromArgs({
          toolContext: context,
          projectRoot: args.projectRoot,
        });

        context.metadata({
          title: "Akane implement",
          metadata: {
            stage: "implementation-context",
            projectRoot,
          },
        });

        const result = await executeImplementStage({
          pluginInput,
          configInfo,
          toolContext: context,
          projectRoot,
          task: args.task,
          notes: args.notes,
        });

        return [
          `Created Akane implementation artifact.`,
          `Artifact: ${result.artifactPath}`,
          `Session: ${result.sessionID}`,
          `Model: ${result.model}`,
        ].join("\n");
      } catch (error) {
        return `Akane implement failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}
