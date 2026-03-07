import type { PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import {
  executeSynthesizeStage,
  resolveProjectRootFromArgs,
} from "../workflow.js";
import type { LoadedAkaneConfig } from "../types.js";

export function createAkaneSynthesizeTool(
  pluginInput: PluginInput,
  configInfo: LoadedAkaneConfig,
) {
  return tool({
    description:
      "Create the final Akane synthesis artifact after implementation and review artifacts exist.",
    args: {
      task: tool.schema
        .string()
        .optional()
        .describe("Optional task restatement for the synthesis stage."),
      notes: tool.schema
        .string()
        .optional()
        .describe("Optional additional synthesis constraints."),
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
          title: "Akane synthesize",
          metadata: {
            stage: "final-synthesis",
            projectRoot,
          },
        });

        const result = await executeSynthesizeStage({
          pluginInput,
          configInfo,
          toolContext: context,
          projectRoot,
          task: args.task,
          notes: args.notes,
        });

        return [
          `Created Akane final synthesis.`,
          `Artifact: ${result.artifactPath}`,
          `Session: ${result.sessionID}`,
          `Model: ${result.model}`,
        ].join("\n");
      } catch (error) {
        return `Akane synthesis failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}
