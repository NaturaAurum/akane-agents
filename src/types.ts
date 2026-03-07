import type {
  AKANE_ROLE_IDS,
  AKANE_STAGE_IDS,
  DEFAULT_ROLE_MODELS,
  DEFAULT_STAGE_FILES,
} from "./constants.js";

export type AkaneStageId = (typeof AKANE_STAGE_IDS)[number];
export type AkaneRoleId = (typeof AKANE_ROLE_IDS)[number];

export type AkaneRoles = Record<AkaneRoleId, string>;
export type AkaneStageFiles = Record<AkaneStageId, string>;

export interface AkaneConfig {
  version: number;
  serviceName: string;
  pluginOutputPath: string;
  globalConfigPath: string;
  artifacts: {
    dir: string;
    stateFile: string;
    files: AkaneStageFiles;
  };
  workflow: {
    stageOrder: AkaneStageId[];
  };
  roles: AkaneRoles;
}

export interface LoadedAkaneConfig {
  path: string;
  exists: boolean;
  config: AkaneConfig;
}

export interface AkaneStageState {
  path: string;
  status: "pending" | "initialized" | "completed";
  updatedAt: string | null;
}

export interface AkaneState {
  version: number;
  serviceName: string;
  configPath: string;
  projectRoot: string;
  artifactDir: string;
  initializedAt: string;
  updatedAt: string;
  activeStage: AkaneStageId | null;
  stageOrder: AkaneStageId[];
  stages: Record<AkaneStageId, AkaneStageState>;
  roles: AkaneRoles;
}

export type ArtifactWriteMode = "append" | "replace";

export type RoleModelDefaults = typeof DEFAULT_ROLE_MODELS;
export type StageFileDefaults = typeof DEFAULT_STAGE_FILES;
