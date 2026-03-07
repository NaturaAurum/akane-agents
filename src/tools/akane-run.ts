import type { PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import {
  executeRunWorkflow,
  resolveProjectRootFromArgs,
} from "../workflow.js";
import { AKANE_STAGE_IDS } from "../constants.js";
import type { LoadedAkaneConfig } from "../types.js";

export function createAkaneRunTool(
  pluginInput: PluginInput,
  configInfo: LoadedAkaneConfig,
) {
  return tool({
    description:
      "Run the Akane MVP workflow from planning through synthesis, writing artifacts at each stage.",
    args: {
      task: tool.schema.string().describe("The task or change request to run through Akane."),
      notes: tool.schema
        .string()
        .optional()
        .describe("Optional additional constraints or context for the workflow."),
      throughStage: tool.schema
        .enum(AKANE_STAGE_IDS)
        .default("final-synthesis")
        .describe("Optional stop point for partial workflow runs."),
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
          title: "Akane run",
          metadata: {
            stage: "workflow",
            throughStage: args.throughStage,
            projectRoot,
          },
        });

        const result = await executeRunWorkflow({
          pluginInput,
          configInfo,
          toolContext: context,
          projectRoot,
          task: args.task,
          notes: args.notes,
          throughStage: args.throughStage,
        });

        return [
          `Completed Akane workflow through ${args.throughStage}.`,
          `Stages: ${result.completedStages.join(", ")}`,
          `Plan: ${result.plan.artifactPath}`,
          ...(result.planReview ? [`Plan review: ${result.planReview.artifactPath}`] : []),
          ...(result.implementation
            ? [`Implementation: ${result.implementation.artifactPath}`]
            : []),
          ...(result.reviews
            ? result.reviews.map((review) => `${review.stage}: ${review.artifactPath}`)
            : []),
          ...(result.synthesis
            ? [`Final synthesis: ${result.synthesis.artifactPath}`]
            : []),
        ].join("\n");
      } catch (error) {
        return `Akane workflow failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}
