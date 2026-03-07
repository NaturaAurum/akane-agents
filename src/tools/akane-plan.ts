import type { PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import {
  executePlanStage,
  resolveProjectRootFromArgs,
} from "../workflow.js";
import type { LoadedAkaneConfig } from "../types.js";

export function createAkanePlanTool(
  pluginInput: PluginInput,
  configInfo: LoadedAkaneConfig,
) {
  return tool({
    description:
      "Create the Akane plan artifact for a task by running the planner role in a child OpenCode session.",
    args: {
      task: tool.schema.string().describe("The task or change request to plan."),
      notes: tool.schema
        .string()
        .optional()
        .describe("Optional additional constraints or context for the plan."),
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
          title: "Akane plan",
          metadata: {
            stage: "plan",
            projectRoot,
          },
        });

        const result = await executePlanStage({
          pluginInput,
          configInfo,
          toolContext: context,
          projectRoot,
          task: args.task,
          notes: args.notes,
        });

        return [
          `Created Akane plan.`,
          `Artifact: ${result.artifactPath}`,
          `Session: ${result.sessionID}`,
          `Model: ${result.model}`,
        ].join("\n");
      } catch (error) {
        return `Akane plan failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}
