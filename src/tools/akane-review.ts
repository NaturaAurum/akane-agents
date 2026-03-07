import type { PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import {
  executeReviewStage,
  resolveProjectRootFromArgs,
  reviewSelectionLabel,
} from "../workflow.js";
import type { LoadedAkaneConfig } from "../types.js";

export function createAkaneReviewTool(
  pluginInput: PluginInput,
  configInfo: LoadedAkaneConfig,
) {
  return tool({
    description:
      "Run the Akane review stage. By default this runs both Codex and Claude reviews in parallel.",
    args: {
      reviewer: tool.schema
        .enum(["codex", "claude", "both"])
        .default("both")
        .describe("Which reviewer to run. 'both' runs both review artifacts in parallel."),
      task: tool.schema
        .string()
        .optional()
        .describe("Optional task restatement for the reviewers."),
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
          title: "Akane review",
          metadata: {
            stage: "review",
            reviewer: args.reviewer,
            projectRoot,
          },
        });

        const result = await executeReviewStage({
          pluginInput,
          configInfo,
          toolContext: context,
          projectRoot,
          reviewer: args.reviewer,
          task: args.task,
          notes: args.notes,
        });

        return [
          `Created Akane review artifact(s): ${reviewSelectionLabel(result.requested)}.`,
          ...result.results.map(
            (item) =>
              `- ${item.stage}: ${item.artifactPath} (${item.model})`,
          ),
        ].join("\n");
      } catch (error) {
        return `Akane review failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}
