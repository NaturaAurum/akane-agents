import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PluginInput } from "@opencode-ai/plugin";
import type { ToolContext } from "@opencode-ai/plugin/tool";
import type {
  AssistantMessage,
  Part,
  Session,
} from "@opencode-ai/sdk";
import {
  AKANE_SERVICE_NAME,
  AKANE_STAGE_IDS,
  AKANE_TOOL_IDS,
  DEFAULT_ROLE_AGENTS,
} from "./constants.js";
import {
  ensureArtifactLayout,
  resolveProjectRoot,
  resolveStageArtifactPath,
  writeStageArtifact,
} from "./artifacts.js";
import type {
  AkaneConfig,
  AkaneRoleId,
  AkaneStageId,
  LoadedAkaneConfig,
} from "./types.js";

const execFileAsync = promisify(execFile);

const STAGE_ROLE_MAP: Record<AkaneStageId, AkaneRoleId> = {
  plan: "planner",
  "plan-review": "plan_reviewer",
  "implementation-context": "implementer",
  "review-codex": "reviewer_codex",
  "review-claude": "reviewer_claude",
  "final-synthesis": "synthesizer",
};

const OMO_ROLE_AGENT_CANDIDATES: Record<AkaneRoleId, string[]> = {
  planner: ["prometheus", "Prometheus (Plan Builder)"],
  plan_reviewer: ["metis", "Metis (Plan Consultant)", "hephaestus", "Hephaestus (Deep Agent)"],
  implementer: ["atlas", "Atlas (Plan Executor)"],
  consultant_primary: ["oracle"],
  consultant_secondary: ["librarian"],
  reviewer_codex: ["momus", "Momus (Plan Critic)", "hephaestus", "Hephaestus (Deep Agent)"],
  reviewer_claude: ["oracle"],
  synthesizer: ["sisyphus", "Sisyphus (Ultraworker)"],
};

const NATIVE_ROLE_AGENT_CANDIDATES: Record<AkaneRoleId, string[]> = {
  planner: ["plan"],
  plan_reviewer: ["general"],
  implementer: ["build"],
  consultant_primary: ["general"],
  consultant_secondary: ["explore", "general"],
  reviewer_codex: ["general"],
  reviewer_claude: ["general"],
  synthesizer: ["general"],
};

const LEGACY_ROLE_AGENT_CANDIDATES: Record<AkaneRoleId, string[]> = {
  planner: [...OMO_ROLE_AGENT_CANDIDATES.planner, ...NATIVE_ROLE_AGENT_CANDIDATES.planner],
  plan_reviewer: [...OMO_ROLE_AGENT_CANDIDATES.plan_reviewer, ...NATIVE_ROLE_AGENT_CANDIDATES.plan_reviewer],
  implementer: [...OMO_ROLE_AGENT_CANDIDATES.implementer, ...NATIVE_ROLE_AGENT_CANDIDATES.implementer],
  consultant_primary: [...OMO_ROLE_AGENT_CANDIDATES.consultant_primary, ...NATIVE_ROLE_AGENT_CANDIDATES.consultant_primary],
  consultant_secondary: [...OMO_ROLE_AGENT_CANDIDATES.consultant_secondary, ...NATIVE_ROLE_AGENT_CANDIDATES.consultant_secondary],
  reviewer_codex: [...OMO_ROLE_AGENT_CANDIDATES.reviewer_codex, ...NATIVE_ROLE_AGENT_CANDIDATES.reviewer_codex],
  reviewer_claude: [...OMO_ROLE_AGENT_CANDIDATES.reviewer_claude, ...NATIVE_ROLE_AGENT_CANDIDATES.reviewer_claude],
  synthesizer: [...OMO_ROLE_AGENT_CANDIDATES.synthesizer, ...NATIVE_ROLE_AGENT_CANDIDATES.synthesizer],
};

const PLAN_TIMEOUT_MS = 12 * 60 * 1000;
const PLAN_REVIEW_TIMEOUT_MS = 8 * 60 * 1000;
const IMPLEMENT_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 8 * 60 * 1000;
const POLL_INTERVAL_MS = 800;
const STABILITY_POLLS_REQUIRED = 2;

type WorkspaceSnapshot = {
  statusShort: string;
  diffStat: string;
};

type StageExecutionBaseInput = {
  pluginInput: PluginInput;
  configInfo: LoadedAkaneConfig;
  toolContext: ToolContext;
  projectRoot: string;
  task?: string;
  notes?: string;
};

type RunStageRequest = {
  pluginInput: PluginInput;
  configInfo: LoadedAkaneConfig;
  toolContext: ToolContext;
  projectRoot: string;
  stage: AkaneStageId;
  title: string;
  system: string;
  prompt: string;
  allowWorkspaceMutation: boolean;
  timeoutMs?: number;
};

type RunStageResult = {
  stage: AkaneStageId;
  role: AkaneRoleId;
  model: string;
  agent?: string;
  sessionID: string;
  messageID: string;
  title: string;
  text: string;
};

type StageArtifactResult = RunStageResult & {
  artifactPath: string;
  content: string;
};

type ReviewSelection = "codex" | "claude" | "both";

function nowIso(): string {
  return new Date().toISOString();
}

function truncate(input: string, length: number): string {
  if (input.length <= length) {
    return input;
  }

  return `${input.slice(0, Math.max(0, length - 1)).trimEnd()}...`;
}

function stageTitle(stage: AkaneStageId): string {
  return stage
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeAgentName(input: string): string {
  return input.trim().toLowerCase();
}

function agentNameAliases(input: string): string[] {
  const normalized = normalizeAgentName(input);
  const base = normalized.replace(/\s*\([^)]*\)\s*$/, "").trim();

  return Array.from(new Set([normalized, base].filter(Boolean)));
}

function parseModelRef(modelRef: string): { providerID: string; modelID: string } {
  const [providerID, ...rest] = modelRef.split("/");
  const modelID = rest.join("/").trim();

  if (!providerID || !modelID) {
    throw new Error(
      `Invalid Akane model mapping "${modelRef}". Expected provider/model.`,
    );
  }

  return { providerID, modelID };
}

function resultErrorMessage(result: { error?: unknown }, fallback: string): string {
  if (result.error instanceof Error) {
    return result.error.message;
  }

  if (typeof result.error === "string") {
    return result.error;
  }

  if (result.error) {
    return JSON.stringify(result.error);
  }

  return fallback;
}

function requireResultData<T extends { data?: unknown; error?: unknown }>(
  result: T,
  action: string,
): NonNullable<T["data"]> {
  if (!result.error && result.data !== undefined && result.data !== null) {
    return result.data as NonNullable<T["data"]>;
  }

  throw new Error(`${action} failed: ${resultErrorMessage(result, "unknown error")}`);
}

function extractAssistantText(parts: Part[]): string {
  const text = parts
    .filter((part): part is Extract<Part, { type: "text" }> => part.type === "text")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (text) {
    return text;
  }

  return "";
}

function findLatestAssistantMessage(
  messages: Array<{ info: { role: string; time?: { created?: number } }; parts: Part[] }>,
): { info: AssistantMessage; parts: Part[] } | null {
  const assistants = messages
    .filter(
      (
        message,
      ): message is { info: AssistantMessage; parts: Part[] } =>
        message.info.role === "assistant",
    )
    .sort(
      (left, right) =>
        (left.info.time.created ?? 0) - (right.info.time.created ?? 0),
    );

  return assistants.at(-1) ?? null;
}

function makeToolRestrictions(allowWorkspaceMutation: boolean): Record<string, boolean> {
  const restrictions = Object.fromEntries(
    AKANE_TOOL_IDS.map((toolID) => [toolID, false]),
  ) as Record<string, boolean>;

  if (!allowWorkspaceMutation) {
    for (const toolID of ["bash", "edit", "patch", "write"]) {
      restrictions[toolID] = false;
    }
  }

  return restrictions;
}

function resolveAgentMode(config: AkaneConfig): "models" | "native" | "omo" | "legacy-agents" {
  if (config.workflow.agentMode === "models" || config.workflow.agentMode === "native" || config.workflow.agentMode === "omo") {
    return config.workflow.agentMode;
  }

  return config.workflow.preferAgents ? "legacy-agents" : "models";
}

async function resolveAgentName(
  client: PluginInput["client"],
  directory: string,
  role: AkaneRoleId,
  config: AkaneConfig,
): Promise<string | undefined> {
  const agentMode = resolveAgentMode(config);
  if (agentMode === "models") {
    return undefined;
  }

  const defaultCandidates =
    agentMode === "native"
      ? NATIVE_ROLE_AGENT_CANDIDATES[role]
      : agentMode === "omo"
        ? OMO_ROLE_AGENT_CANDIDATES[role]
        : LEGACY_ROLE_AGENT_CANDIDATES[role];

  const candidates = [
    config.roleAgents[role],
    ...defaultCandidates,
    DEFAULT_ROLE_AGENTS[role],
  ]
    .filter((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)
    .filter((candidate, index, all) =>
      all.findIndex((value) => normalizeAgentName(value) === normalizeAgentName(candidate)) === index,
    );

  try {
    const result = await client.app.agents({
      query: { directory },
    });
    const agents = requireResultData(result, "agent list");

    for (const candidate of candidates) {
      const candidateAliases = agentNameAliases(candidate);
      const matched = agents.find((agent) =>
        agentNameAliases(agent.name).some((alias) => candidateAliases.includes(alias)),
      );
      if (matched) {
        return matched.name;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

async function createStageSession(input: {
  client: PluginInput["client"];
  parentSessionID: string;
  directory: string;
  title: string;
}): Promise<Session> {
  const result = await input.client.session.create({
    body: {
      parentID: input.parentSessionID,
      title: input.title,
    },
    query: {
      directory: input.directory,
    },
  });

  return requireResultData(result, "session creation");
}

async function waitForSessionCompletion(input: {
  client: PluginInput["client"];
  sessionID: string;
  directory: string;
  abort: AbortSignal;
  timeoutMs: number;
}): Promise<Array<{ info: { role: string; time?: { created?: number } }; parts: Part[] }>> {
  const startedAt = Date.now();
  let stablePolls = 0;
  let lastMessageCount = -1;

  while (Date.now() - startedAt < input.timeoutMs) {
    if (input.abort.aborted) {
      throw new Error("Akane stage aborted.");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const statusResult = await input.client.session.status({
      query: { directory: input.directory },
    });
    const statusMap = requireResultData(statusResult, "session status");
    const sessionStatus = statusMap[input.sessionID];

    if (sessionStatus && sessionStatus.type !== "idle") {
      stablePolls = 0;
      lastMessageCount = -1;
      continue;
    }

    const messagesResult = await input.client.session.messages({
      path: { id: input.sessionID },
      query: { directory: input.directory },
    });
    const messages = requireResultData(messagesResult, "session messages");
    const latestAssistant = findLatestAssistantMessage(messages);

    if (!latestAssistant) {
      stablePolls = 0;
      lastMessageCount = messages.length;
      continue;
    }

    if (messages.length === lastMessageCount) {
      stablePolls += 1;
    } else {
      stablePolls = 0;
      lastMessageCount = messages.length;
    }

    if (stablePolls >= STABILITY_POLLS_REQUIRED) {
      return messages;
    }
  }

  throw new Error(
    `Akane stage timed out after ${Math.ceil(input.timeoutMs / 60000)} minute(s).`,
  );
}

async function runGitCommand(
  projectRoot: string,
  args: string[],
): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: projectRoot,
      env: process.env,
      maxBuffer: 1024 * 1024,
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

async function captureWorkspaceSnapshot(projectRoot: string): Promise<WorkspaceSnapshot> {
  const [statusShort, diffStat] = await Promise.all([
    runGitCommand(projectRoot, ["status", "--short"]),
    runGitCommand(projectRoot, ["diff", "--stat"]),
  ]);

  return { statusShort, diffStat };
}

function renderCodeBlock(content: string, language = "text"): string {
  const normalized = content.trim();
  if (!normalized) {
    return "_None_";
  }

  return `\`\`\`${language}\n${normalized}\n\`\`\``;
}

function renderSection(title: string, body: string): string {
  return `## ${title}\n\n${body.trim()}\n`;
}

function renderStageDocument(input: {
  stage: AkaneStageId;
  role: AkaneRoleId;
  agent?: string;
  model: string;
  sessionID: string;
  messageID: string;
  title: string;
  body: string;
  extraSections?: Array<{ title: string; body: string }>;
}): string {
  const sections = [
    `# ${stageTitle(input.stage)}`,
    "",
    `- Service: ${AKANE_SERVICE_NAME}`,
    `- Role: ${input.role}`,
    ...(input.agent ? [`- Agent: ${input.agent}`] : []),
    `- Model: ${input.model}`,
    `- Session ID: ${input.sessionID}`,
    `- Message ID: ${input.messageID}`,
    `- Generated At: ${nowIso()}`,
    "",
    renderSection("Output", input.body),
  ];

  for (const extra of input.extraSections ?? []) {
    sections.push(renderSection(extra.title, extra.body));
  }

  return sections.join("\n").trimEnd() + "\n";
}

async function readArtifactContent(
  projectRoot: string,
  configInfo: LoadedAkaneConfig,
  stage: AkaneStageId,
): Promise<string> {
  const artifactPath = resolveStageArtifactPath(projectRoot, configInfo.config, stage);

  try {
    return await readFile(artifactPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

async function requireArtifactContent(
  projectRoot: string,
  configInfo: LoadedAkaneConfig,
  stage: AkaneStageId,
  instruction: string,
): Promise<string> {
  const content = (await readArtifactContent(projectRoot, configInfo, stage)).trim();

  if (!content) {
    const artifactPath = resolveStageArtifactPath(projectRoot, configInfo.config, stage);
    throw new Error(
      `Missing ${stage} artifact at ${artifactPath}. ${instruction}`,
    );
  }

  return content;
}

function buildTaskBlock(task?: string, notes?: string): string {
  const blocks: string[] = [];

  if (task?.trim()) {
    blocks.push(renderSection("Task", task.trim()));
  }

  if (notes?.trim()) {
    blocks.push(renderSection("Additional Notes", notes.trim()));
  }

  return blocks.join("\n");
}

function buildArtifactBlock(
  title: string,
  content: string,
): string {
  return renderSection(title, renderCodeBlock(content, "md"));
}

async function runStageSession(input: RunStageRequest): Promise<RunStageResult> {
  const role = STAGE_ROLE_MAP[input.stage];
  const configuredModel = input.configInfo.config.roles[role];
  const modelRef = parseModelRef(configuredModel);
  const agent = await resolveAgentName(
    input.pluginInput.client,
    input.projectRoot,
    role,
    input.configInfo.config,
  );

  const session = await createStageSession({
    client: input.pluginInput.client,
    parentSessionID: input.toolContext.sessionID,
    directory: input.projectRoot,
    title: input.title,
  });

  const promptResult = await input.pluginInput.client.session.promptAsync({
    path: { id: session.id },
    query: { directory: input.projectRoot },
    signal: input.toolContext.abort,
    body: {
      ...(agent ? { agent } : {}),
      ...(agent ? {} : { model: modelRef }),
      system: input.system,
      tools: makeToolRestrictions(input.allowWorkspaceMutation),
      parts: [
        {
          type: "text",
          text: input.prompt,
        },
      ],
    },
  });

  if (promptResult.error) {
    throw new Error(
      `${stageTitle(input.stage)} prompt failed: ${resultErrorMessage(promptResult, "unknown error")}`,
    );
  }

  const messages = await waitForSessionCompletion({
    client: input.pluginInput.client,
    sessionID: session.id,
    directory: input.projectRoot,
    abort: input.toolContext.abort,
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  const latestAssistant = findLatestAssistantMessage(messages);

  if (!latestAssistant) {
    throw new Error(`${stageTitle(input.stage)} completed without an assistant response.`);
  }

  const text = extractAssistantText(latestAssistant.parts).trim();
  if (!text) {
    throw new Error(`${stageTitle(input.stage)} completed without text output.`);
  }

  return {
    stage: input.stage,
    role,
    model:
      latestAssistant.info.providerID && latestAssistant.info.modelID
        ? `${latestAssistant.info.providerID}/${latestAssistant.info.modelID}`
        : configuredModel,
    agent,
    sessionID: session.id,
    messageID: latestAssistant.info.id,
    title: input.title,
    text,
  };
}

function planSystemPrompt(): string {
  return [
    `You are the ${AKANE_SERVICE_NAME} planning stage.`,
    "Create a deterministic implementation plan in Markdown.",
    "Focus on steps, risks, validation, and clear sequencing.",
    "Do not modify files.",
    "Do not rely on hidden context. Use only the task and repository inspection you perform in this session.",
    "Output sections: Goal, Assumptions, Plan, Risks, Validation.",
  ].join("\n");
}

function planReviewSystemPrompt(): string {
  return [
    `You are the ${AKANE_SERVICE_NAME} plan review stage.`,
    "Critically review the plan and improve it without implementing anything.",
    "Do not modify files.",
    "Output sections: Verdict, Findings, Recommended Changes, Approved Plan Notes.",
    "Be direct and specific.",
  ].join("\n");
}

function implementSystemPrompt(): string {
  return [
    `You are the ${AKANE_SERVICE_NAME} implementation stage.`,
    "Implement the approved plan in the current repository.",
    "Use tools when needed to inspect, edit, and validate.",
    "At the end, output concise Markdown with sections: Completed Work, Changed Files, Validation, Remaining Risks.",
    "Do not include full diffs in the response.",
  ].join("\n");
}

function reviewSystemPrompt(reviewer: "codex" | "claude"): string {
  return [
    `You are the ${AKANE_SERVICE_NAME} ${reviewer} review stage.`,
    "Review the current repository state after implementation.",
    "Do not modify files.",
    "Prioritize bugs, regressions, missing validation, and risky assumptions.",
    "Output findings first with severity labels like P1/P2/P3 and file references when possible.",
    'If there are no findings, explicitly say "No findings."',
    "Then include Residual Risks and Suggested Follow-ups.",
  ].join("\n");
}

function synthesizeSystemPrompt(): string {
  return [
    `You are the ${AKANE_SERVICE_NAME} synthesis stage.`,
    "Produce the final synthesis across plan, implementation, and reviews.",
    "Do not modify files.",
    "Output sections: Outcome, Validation, Review Summary, Remaining Risks, Next Steps.",
    "Keep it decision-oriented.",
  ].join("\n");
}

export function resolveProjectRootFromArgs(input: {
  toolContext: ToolContext;
  projectRoot?: string;
}): string {
  return resolveProjectRoot({
    directory: input.toolContext.directory,
    worktree: input.toolContext.worktree,
    projectRoot: input.projectRoot,
  });
}

export async function executePlanStage(
  input: StageExecutionBaseInput & { task: string },
): Promise<StageArtifactResult> {
  await ensureArtifactLayout({
    projectRoot: input.projectRoot,
    config: input.configInfo.config,
    configPath: input.configInfo.path,
  });

  const result = await runStageSession({
    pluginInput: input.pluginInput,
    configInfo: input.configInfo,
    toolContext: input.toolContext,
    projectRoot: input.projectRoot,
    stage: "plan",
    title: `Akane Plan: ${truncate(input.task, 60)}`,
    system: planSystemPrompt(),
    prompt: [
      buildTaskBlock(input.task, input.notes),
      renderSection(
        "Project Context",
        `Repository root: ${input.projectRoot}`,
      ),
    ]
      .filter(Boolean)
      .join("\n"),
    allowWorkspaceMutation: false,
    timeoutMs: PLAN_TIMEOUT_MS,
  });

  const content = renderStageDocument({
    stage: result.stage,
    role: result.role,
    agent: result.agent,
    model: result.model,
    sessionID: result.sessionID,
    messageID: result.messageID,
    title: result.title,
    body: result.text,
  });

  const writeResult = await writeStageArtifact({
    projectRoot: input.projectRoot,
    config: input.configInfo.config,
    configPath: input.configInfo.path,
    stage: "plan",
    content,
    mode: "replace",
    details: {
      role: result.role,
      agent: result.agent,
      model: result.model,
      sessionID: result.sessionID,
      messageID: result.messageID,
      title: result.title,
    },
  });

  return {
    ...result,
    artifactPath: writeResult.artifactPath,
    content,
  };
}

export async function executePlanReviewStage(
  input: StageExecutionBaseInput,
): Promise<StageArtifactResult> {
  const plan = await requireArtifactContent(
    input.projectRoot,
    input.configInfo,
    "plan",
    "Run akane_plan first.",
  );

  const result = await runStageSession({
    pluginInput: input.pluginInput,
    configInfo: input.configInfo,
    toolContext: input.toolContext,
    projectRoot: input.projectRoot,
    stage: "plan-review",
    title: `Akane Plan Review${input.task ? `: ${truncate(input.task, 40)}` : ""}`,
    system: planReviewSystemPrompt(),
    prompt: [
      buildTaskBlock(input.task, input.notes),
      buildArtifactBlock("Plan Artifact", plan),
    ]
      .filter(Boolean)
      .join("\n"),
    allowWorkspaceMutation: false,
    timeoutMs: PLAN_REVIEW_TIMEOUT_MS,
  });

  const content = renderStageDocument({
    stage: result.stage,
    role: result.role,
    agent: result.agent,
    model: result.model,
    sessionID: result.sessionID,
    messageID: result.messageID,
    title: result.title,
    body: result.text,
  });

  const writeResult = await writeStageArtifact({
    projectRoot: input.projectRoot,
    config: input.configInfo.config,
    configPath: input.configInfo.path,
    stage: "plan-review",
    content,
    mode: "replace",
    details: {
      role: result.role,
      agent: result.agent,
      model: result.model,
      sessionID: result.sessionID,
      messageID: result.messageID,
      title: result.title,
    },
  });

  return {
    ...result,
    artifactPath: writeResult.artifactPath,
    content,
  };
}

export async function executeImplementStage(
  input: StageExecutionBaseInput,
): Promise<StageArtifactResult> {
  const [plan, planReview, workspace] = await Promise.all([
    requireArtifactContent(
      input.projectRoot,
      input.configInfo,
      "plan",
      "Run akane_plan first.",
    ),
    requireArtifactContent(
      input.projectRoot,
      input.configInfo,
      "plan-review",
      "Run akane_plan_review first.",
    ),
    captureWorkspaceSnapshot(input.projectRoot),
  ]);

  const result = await runStageSession({
    pluginInput: input.pluginInput,
    configInfo: input.configInfo,
    toolContext: input.toolContext,
    projectRoot: input.projectRoot,
    stage: "implementation-context",
    title: `Akane Implement${input.task ? `: ${truncate(input.task, 40)}` : ""}`,
    system: implementSystemPrompt(),
    prompt: [
      buildTaskBlock(input.task, input.notes),
      buildArtifactBlock("Plan Artifact", plan),
      buildArtifactBlock("Plan Review Artifact", planReview),
      renderSection(
        "Workspace Snapshot Before Implementation",
        [
          "### git status --short",
          renderCodeBlock(workspace.statusShort || "Clean working tree"),
          "### git diff --stat",
          renderCodeBlock(workspace.diffStat || "No unstaged diff"),
        ].join("\n\n"),
      ),
    ]
      .filter(Boolean)
      .join("\n"),
    allowWorkspaceMutation: true,
    timeoutMs: IMPLEMENT_TIMEOUT_MS,
  });

  const diffResult = await input.pluginInput.client.session.diff({
    path: { id: result.sessionID },
    query: { directory: input.projectRoot },
  });
  const diffs = diffResult.error ? [] : diffResult.data ?? [];
  const afterWorkspace = await captureWorkspaceSnapshot(input.projectRoot);

  const diffSummary =
    diffs.length === 0
      ? "No session diff records were returned."
      : diffs
          .map(
            (diff) =>
              `- ${diff.file} (+${diff.additions} / -${diff.deletions})`,
          )
          .join("\n");

  const content = renderStageDocument({
    stage: result.stage,
    role: result.role,
    agent: result.agent,
    model: result.model,
    sessionID: result.sessionID,
    messageID: result.messageID,
    title: result.title,
    body: result.text,
    extraSections: [
      {
        title: "Session Diff Summary",
        body: diffSummary,
      },
      {
        title: "Workspace Snapshot After Implementation",
        body: [
          "### git status --short",
          renderCodeBlock(afterWorkspace.statusShort || "Clean working tree"),
          "### git diff --stat",
          renderCodeBlock(afterWorkspace.diffStat || "No unstaged diff"),
        ].join("\n\n"),
      },
    ],
  });

  const writeResult = await writeStageArtifact({
    projectRoot: input.projectRoot,
    config: input.configInfo.config,
    configPath: input.configInfo.path,
    stage: "implementation-context",
    content,
    mode: "replace",
    details: {
      role: result.role,
      agent: result.agent,
      model: result.model,
      sessionID: result.sessionID,
      messageID: result.messageID,
      title: result.title,
    },
  });

  return {
    ...result,
    artifactPath: writeResult.artifactPath,
    content,
  };
}

async function executeReviewerStage(
  input: StageExecutionBaseInput & { stage: "review-codex" | "review-claude" },
): Promise<StageArtifactResult> {
  const [plan, planReview, implementation, workspace] = await Promise.all([
    requireArtifactContent(
      input.projectRoot,
      input.configInfo,
      "plan",
      "Run akane_plan first.",
    ),
    requireArtifactContent(
      input.projectRoot,
      input.configInfo,
      "plan-review",
      "Run akane_plan_review first.",
    ),
    requireArtifactContent(
      input.projectRoot,
      input.configInfo,
      "implementation-context",
      "Run akane_implement first.",
    ),
    captureWorkspaceSnapshot(input.projectRoot),
  ]);

  const reviewer = input.stage === "review-codex" ? "codex" : "claude";
  const result = await runStageSession({
    pluginInput: input.pluginInput,
    configInfo: input.configInfo,
    toolContext: input.toolContext,
    projectRoot: input.projectRoot,
    stage: input.stage,
    title: `Akane ${reviewer === "codex" ? "Codex" : "Claude"} Review`,
    system: reviewSystemPrompt(reviewer),
    prompt: [
      buildTaskBlock(input.task, input.notes),
      buildArtifactBlock("Plan Artifact", plan),
      buildArtifactBlock("Plan Review Artifact", planReview),
      buildArtifactBlock("Implementation Artifact", implementation),
      renderSection(
        "Current Workspace Snapshot",
        [
          "### git status --short",
          renderCodeBlock(workspace.statusShort || "Clean working tree"),
          "### git diff --stat",
          renderCodeBlock(workspace.diffStat || "No unstaged diff"),
        ].join("\n\n"),
      ),
    ]
      .filter(Boolean)
      .join("\n"),
    allowWorkspaceMutation: false,
  });

  const content = renderStageDocument({
    stage: result.stage,
    role: result.role,
    agent: result.agent,
    model: result.model,
    sessionID: result.sessionID,
    messageID: result.messageID,
    title: result.title,
    body: result.text,
  });

  const writeResult = await writeStageArtifact({
    projectRoot: input.projectRoot,
    config: input.configInfo.config,
    configPath: input.configInfo.path,
    stage: input.stage,
    content,
    mode: "replace",
    details: {
      role: result.role,
      agent: result.agent,
      model: result.model,
      sessionID: result.sessionID,
      messageID: result.messageID,
      title: result.title,
    },
  });

  return {
    ...result,
    artifactPath: writeResult.artifactPath,
    content,
  };
}

export async function executeReviewStage(
  input: StageExecutionBaseInput & { reviewer: ReviewSelection },
): Promise<{
  requested: ReviewSelection;
  results: StageArtifactResult[];
}> {
  const stages =
    input.reviewer === "both"
      ? (["review-codex", "review-claude"] as const)
      : ([input.reviewer === "codex" ? "review-codex" : "review-claude"] as const);

  const results = await Promise.all(
    stages.map((stage) =>
      executeReviewerStage({
        ...input,
        stage,
      }),
    ),
  );

  return {
    requested: input.reviewer,
    results,
  };
}

export async function executeSynthesizeStage(
  input: StageExecutionBaseInput,
): Promise<StageArtifactResult> {
  const [plan, planReview, implementation, reviewCodex, reviewClaude, workspace] =
    await Promise.all([
      requireArtifactContent(
        input.projectRoot,
        input.configInfo,
        "plan",
        "Run akane_plan first.",
      ),
      requireArtifactContent(
        input.projectRoot,
        input.configInfo,
        "plan-review",
        "Run akane_plan_review first.",
      ),
      requireArtifactContent(
        input.projectRoot,
        input.configInfo,
        "implementation-context",
        "Run akane_implement first.",
      ),
      requireArtifactContent(
        input.projectRoot,
        input.configInfo,
        "review-codex",
        "Run akane_review first.",
      ),
      requireArtifactContent(
        input.projectRoot,
        input.configInfo,
        "review-claude",
        "Run akane_review first.",
      ),
      captureWorkspaceSnapshot(input.projectRoot),
    ]);

  const result = await runStageSession({
    pluginInput: input.pluginInput,
    configInfo: input.configInfo,
    toolContext: input.toolContext,
    projectRoot: input.projectRoot,
    stage: "final-synthesis",
    title: `Akane Final Synthesis${input.task ? `: ${truncate(input.task, 40)}` : ""}`,
    system: synthesizeSystemPrompt(),
    prompt: [
      buildTaskBlock(input.task, input.notes),
      buildArtifactBlock("Plan Artifact", plan),
      buildArtifactBlock("Plan Review Artifact", planReview),
      buildArtifactBlock("Implementation Artifact", implementation),
      buildArtifactBlock("Codex Review Artifact", reviewCodex),
      buildArtifactBlock("Claude Review Artifact", reviewClaude),
      renderSection(
        "Current Workspace Snapshot",
        [
          "### git status --short",
          renderCodeBlock(workspace.statusShort || "Clean working tree"),
          "### git diff --stat",
          renderCodeBlock(workspace.diffStat || "No unstaged diff"),
        ].join("\n\n"),
      ),
    ]
      .filter(Boolean)
      .join("\n"),
    allowWorkspaceMutation: false,
  });

  const content = renderStageDocument({
    stage: result.stage,
    role: result.role,
    agent: result.agent,
    model: result.model,
    sessionID: result.sessionID,
    messageID: result.messageID,
    title: result.title,
    body: result.text,
  });

  const writeResult = await writeStageArtifact({
    projectRoot: input.projectRoot,
    config: input.configInfo.config,
    configPath: input.configInfo.path,
    stage: "final-synthesis",
    content,
    mode: "replace",
    details: {
      role: result.role,
      agent: result.agent,
      model: result.model,
      sessionID: result.sessionID,
      messageID: result.messageID,
      title: result.title,
    },
  });

  return {
    ...result,
    artifactPath: writeResult.artifactPath,
    content,
  };
}

export async function executeRunWorkflow(
  input: StageExecutionBaseInput & {
    task: string;
    throughStage: AkaneStageId;
  },
): Promise<{
  completedStages: AkaneStageId[];
  plan: StageArtifactResult;
  planReview?: StageArtifactResult;
  implementation?: StageArtifactResult;
  reviews?: StageArtifactResult[];
  synthesis?: StageArtifactResult;
}> {
  const completedStages: AkaneStageId[] = [];

  const plan = await executePlanStage(input);
  completedStages.push("plan");
  if (input.throughStage === "plan") {
    return { completedStages, plan };
  }

  const planReview = await executePlanReviewStage(input);
  completedStages.push("plan-review");
  if (input.throughStage === "plan-review") {
    return { completedStages, plan, planReview };
  }

  const implementation = await executeImplementStage(input);
  completedStages.push("implementation-context");
  if (input.throughStage === "implementation-context") {
    return { completedStages, plan, planReview, implementation };
  }

  const reviews = (
    await executeReviewStage({
      ...input,
      reviewer: "both",
    })
  ).results;
  completedStages.push("review-codex", "review-claude");
  if (
    input.throughStage === "review-codex" ||
    input.throughStage === "review-claude"
  ) {
    return { completedStages, plan, planReview, implementation, reviews };
  }

  const synthesis = await executeSynthesizeStage(input);
  completedStages.push("final-synthesis");
  return {
    completedStages,
    plan,
    planReview,
    implementation,
    reviews,
    synthesis,
  };
}

export function reviewSelectionLabel(selection: ReviewSelection): string {
  if (selection === "both") {
    return "codex + claude";
  }

  return selection;
}
