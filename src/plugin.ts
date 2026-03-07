import type { Plugin } from "@opencode-ai/plugin";
import { loadAkaneConfig } from "./config.js";
import { resolveArtifactDir } from "./artifacts.js";
import { createAkaneInitTool } from "./tools/akane-init.js";
import { createAkaneStageArtifactTool } from "./tools/akane-stage-artifact.js";
import { createAkanePlanTool } from "./tools/akane-plan.js";
import { createAkanePlanReviewTool } from "./tools/akane-plan-review.js";
import { createAkaneImplementTool } from "./tools/akane-implement.js";
import { createAkaneReviewTool } from "./tools/akane-review.js";
import { createAkaneSynthesizeTool } from "./tools/akane-synthesize.js";
import { createAkaneRunTool } from "./tools/akane-run.js";

export const AkanePlugin: Plugin = async (input) => {
  const configInfo = await loadAkaneConfig();

  return {
    tool: {
      akane_init: createAkaneInitTool(configInfo),
      akane_stage_artifact: createAkaneStageArtifactTool(configInfo),
      akane_plan: createAkanePlanTool(input, configInfo),
      akane_plan_review: createAkanePlanReviewTool(input, configInfo),
      akane_implement: createAkaneImplementTool(input, configInfo),
      akane_review: createAkaneReviewTool(input, configInfo),
      akane_synthesize: createAkaneSynthesizeTool(input, configInfo),
      akane_run: createAkaneRunTool(input, configInfo),
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
