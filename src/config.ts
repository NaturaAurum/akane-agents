import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  AKANE_SERVICE_NAME,
  AKANE_STAGE_IDS,
  DEFAULT_ARTIFACT_DIR,
  DEFAULT_GLOBAL_CONFIG_PATH,
  DEFAULT_PLUGIN_OUTPUT_PATH,
  DEFAULT_ROLE_MODELS,
  DEFAULT_STAGE_FILES,
  DEFAULT_STAGE_ORDER,
  DEFAULT_STATE_FILE,
} from "./constants.js";
import type {
  AkaneConfig,
  AkaneRoleId,
  AkaneRoles,
  AkaneStageFiles,
  AkaneStageId,
  LoadedAkaneConfig,
} from "./types.js";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? U[]
    : T[K] extends Record<string, unknown>
      ? DeepPartial<T[K]>
      : T[K];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function expandHome(inputPath: string): string {
  if (inputPath === "~") {
    return os.homedir();
  }

  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
}

export function defaultAkaneConfig(): AkaneConfig {
  return {
    version: 1,
    serviceName: AKANE_SERVICE_NAME,
    pluginOutputPath: DEFAULT_PLUGIN_OUTPUT_PATH,
    globalConfigPath: DEFAULT_GLOBAL_CONFIG_PATH,
    artifacts: {
      dir: DEFAULT_ARTIFACT_DIR,
      stateFile: DEFAULT_STATE_FILE,
      files: { ...DEFAULT_STAGE_FILES },
    },
    workflow: {
      stageOrder: [...DEFAULT_STAGE_ORDER],
    },
    roles: { ...DEFAULT_ROLE_MODELS },
  };
}

function parseJsonFile<T>(content: string, filePath: string): T {
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown JSON parse error";
    throw new Error(`Failed to parse Akane config at ${filePath}: ${message}`);
  }
}

function normalizeRoles(
  input: unknown,
  fallback: AkaneRoles,
): AkaneRoles {
  if (!isRecord(input)) {
    return { ...fallback };
  }

  const next = { ...fallback };
  for (const role of Object.keys(fallback) as AkaneRoleId[]) {
    const candidate = input[role];
    if (typeof candidate === "string" && candidate.trim()) {
      next[role] = candidate.trim();
    }
  }

  return next;
}

function normalizeFiles(
  input: unknown,
  fallback: AkaneStageFiles,
): AkaneStageFiles {
  if (!isRecord(input)) {
    return { ...fallback };
  }

  const next = { ...fallback };
  for (const stage of AKANE_STAGE_IDS) {
    const candidate = input[stage];
    if (typeof candidate === "string" && candidate.trim()) {
      next[stage] = candidate.trim();
    }
  }

  return next;
}

function normalizeStageOrder(
  input: unknown,
  fallback: AkaneStageId[],
): AkaneStageId[] {
  if (!Array.isArray(input)) {
    return [...fallback];
  }

  const values = input.filter(
    (value): value is AkaneStageId =>
      typeof value === "string" &&
      (AKANE_STAGE_IDS as readonly string[]).includes(value),
  );

  return values.length === AKANE_STAGE_IDS.length ? values : [...fallback];
}

export function mergeAkaneConfig(
  base: AkaneConfig,
  overrides: DeepPartial<AkaneConfig>,
): AkaneConfig {
  return {
    version:
      typeof overrides.version === "number" ? overrides.version : base.version,
    serviceName:
      typeof overrides.serviceName === "string" && overrides.serviceName.trim()
        ? overrides.serviceName.trim()
        : base.serviceName,
    pluginOutputPath:
      typeof overrides.pluginOutputPath === "string" &&
      overrides.pluginOutputPath.trim()
        ? overrides.pluginOutputPath.trim()
        : base.pluginOutputPath,
    globalConfigPath:
      typeof overrides.globalConfigPath === "string" &&
      overrides.globalConfigPath.trim()
        ? overrides.globalConfigPath.trim()
        : base.globalConfigPath,
    artifacts: {
      dir:
        isRecord(overrides.artifacts) &&
        typeof overrides.artifacts.dir === "string" &&
        overrides.artifacts.dir.trim()
          ? overrides.artifacts.dir.trim()
          : base.artifacts.dir,
      stateFile:
        isRecord(overrides.artifacts) &&
        typeof overrides.artifacts.stateFile === "string" &&
        overrides.artifacts.stateFile.trim()
          ? overrides.artifacts.stateFile.trim()
          : base.artifacts.stateFile,
      files: normalizeFiles(
        isRecord(overrides.artifacts) ? overrides.artifacts.files : undefined,
        base.artifacts.files,
      ),
    },
    workflow: {
      stageOrder: normalizeStageOrder(
        isRecord(overrides.workflow) ? overrides.workflow.stageOrder : undefined,
        base.workflow.stageOrder,
      ),
    },
    roles: normalizeRoles(overrides.roles, base.roles),
  };
}

export async function loadAkaneConfig(
  configPath = process.env.AKANE_CONFIG_PATH ?? DEFAULT_GLOBAL_CONFIG_PATH,
): Promise<LoadedAkaneConfig> {
  const resolvedPath = expandHome(configPath);
  const defaults = defaultAkaneConfig();

  try {
    const raw = await readFile(resolvedPath, "utf8");
    const parsed = parseJsonFile<DeepPartial<AkaneConfig>>(raw, resolvedPath);
    return {
      path: resolvedPath,
      exists: true,
      config: mergeAkaneConfig(defaults, parsed),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        path: resolvedPath,
        exists: false,
        config: defaults,
      };
    }

    throw error;
  }
}
