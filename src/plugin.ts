import type { Plugin } from "@opencode-ai/plugin";
import { loadAkaneConfig } from "./config.js";
import { resolveArtifactDir } from "./artifacts.js";
import { createAkaneInitTool } from "./tools/akane-init.js";
import { createAkaneStageArtifactTool } from "./tools/akane-stage-artifact.js";

export const AkanePlugin: Plugin = async (input) => {
  const configInfo = await loadAkaneConfig();

  return {
    tool: {
      akane_init: createAkaneInitTool(configInfo),
      akane_stage_artifact: createAkaneStageArtifactTool(configInfo),
    },
    "shell.env": async (_event, output) => {
      const projectRoot = input.worktree || input.directory;
      output.env.AKANE_PROJECT_ROOT = projectRoot;
      output.env.AKANE_ARTIFACT_DIR = resolveArtifactDir(projectRoot, configInfo.config);
      output.env.AKANE_CONFIG_PATH = configInfo.path;
    },
  };
};

export default AkanePlugin;
