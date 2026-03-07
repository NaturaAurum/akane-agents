import { tool } from "@opencode-ai/plugin/tool";
import { ensureArtifactLayout, resolveProjectRoot } from "../artifacts.js";
import type { LoadedAkaneConfig } from "../types.js";

export function createAkaneInitTool(configInfo: LoadedAkaneConfig) {
  return tool({
    description:
      "Initialize the per-project .opencode/akane workspace and create the stage artifact files.",
    args: {
      force: tool.schema
        .boolean()
        .default(false)
        .describe("Recreate artifact files and state.json even when they already exist."),
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

      const result = await ensureArtifactLayout({
        projectRoot,
        config: configInfo.config,
        configPath: configInfo.path,
        force: args.force,
      });

      context.metadata({
        title: "Akane initialized",
        metadata: {
          projectRoot,
          artifactDir: result.artifactDir,
          configPath: configInfo.path,
          configFound: configInfo.exists,
          createdFiles: result.createdFiles,
        },
      });

      const lines = [
        `Initialized ${configInfo.config.serviceName} in ${projectRoot}.`,
        `Artifact directory: ${result.artifactDir}`,
        `State file: ${result.statePath}`,
        `Config path: ${configInfo.path}${configInfo.exists ? "" : " (default config fallback)"}`,
      ];

      if (result.createdFiles.length > 0) {
        lines.push(`Created files: ${result.createdFiles.length}`);
      } else {
        lines.push("No files were recreated.");
      }

      return lines.join("\n");
    },
  });
}
