import type { PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import {
  executePlanReviewStage,
  resolveProjectRootFromArgs,
} from "../workflow.js";
import type { LoadedAkaneConfig } from "../types.js";

export function createAkanePlanReviewTool(
  pluginInput: PluginInput,
  configInfo: LoadedAkaneConfig,
) {
  return tool({
    description:
      "Review the current Akane plan artifact and write plan-review.md using the configured review model.",
    args: {
      task: tool.schema
        .string()
        .optional()
        .describe("Optional task restatement to include during review."),
      notes: tool.schema
        .string()
        .optional()
        .describe("Optional additional review constraints."),
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
          title: "Akane plan review",
          metadata: {
            stage: "plan-review",
            projectRoot,
          },
        });

        const result = await executePlanReviewStage({
          pluginInput,
          configInfo,
          toolContext: context,
          projectRoot,
          task: args.task,
          notes: args.notes,
        });

        return [
          `Created Akane plan review.`,
          `Artifact: ${result.artifactPath}`,
          `Session: ${result.sessionID}`,
          `Model: ${result.model}`,
        ].join("\n");
      } catch (error) {
        return `Akane plan review failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}
