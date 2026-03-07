import { tool } from "@opencode-ai/plugin/tool";
import { AKANE_STAGE_IDS } from "../constants.js";
import { resolveProjectRoot, writeStageArtifact } from "../artifacts.js";
import type { LoadedAkaneConfig } from "../types.js";

export function createAkaneStageArtifactTool(configInfo: LoadedAkaneConfig) {
  return tool({
    description:
      "Write deterministic stage artifacts into .opencode/akane and update Akane state.json.",
    args: {
      stage: tool.schema
        .enum(AKANE_STAGE_IDS)
        .describe("The workflow stage whose artifact file should be written."),
      content: tool.schema
        .string()
        .describe("Markdown content to write into the selected stage artifact."),
      mode: tool.schema
        .enum(["replace", "append"])
        .default("replace")
        .describe("Replace the artifact content or append to the existing file."),
      projectRoot: tool.schema
        .string()
        .optional()
        .describe("Optional project root override. Defaults to the current session worktree."),
    },
    async execute(args, context) {
      const projectRoot = resolveProjectRoot({
        directory: context.directory,
        worktree: context.worktree,
        projectRoot: args.projectRoot,
      });

      const result = await writeStageArtifact({
        projectRoot,
        config: configInfo.config,
        configPath: configInfo.path,
        stage: args.stage,
        content: args.content,
        mode: args.mode,
      });

      context.metadata({
        title: `Akane stage updated: ${args.stage}`,
        metadata: {
          stage: args.stage,
          mode: args.mode,
          artifactPath: result.artifactPath,
          statePath: result.statePath,
          projectRoot,
        },
      });

      return [
        `Updated stage ${args.stage}.`,
        `Artifact: ${result.artifactPath}`,
        `State: ${result.statePath}`,
        `Mode: ${args.mode}`,
      ].join("\n");
    },
  });
}
