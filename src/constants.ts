export const AKANE_SERVICE_NAME = "Akane";
export const DEFAULT_GLOBAL_CONFIG_PATH = "~/.config/opencode/akane.json";
export const DEFAULT_PLUGIN_OUTPUT_PATH = "~/.config/opencode/plugins/akane.js";
export const DEFAULT_ARTIFACT_DIR = ".opencode/akane";
export const DEFAULT_STATE_FILE = "state.json";

export const AKANE_STAGE_IDS = [
  "plan",
  "plan-review",
  "implementation-context",
  "review-codex",
  "review-claude",
  "final-synthesis",
] as const;

export const AKANE_ROLE_IDS = [
  "planner",
  "plan_reviewer",
  "implementer",
  "consultant_primary",
  "consultant_secondary",
  "reviewer_codex",
  "reviewer_claude",
  "synthesizer",
] as const;

export const DEFAULT_ROLE_MODELS = {
  planner: "anthropic/claude-opus-4-6",
  plan_reviewer: "openai/gpt-5.3-codex",
  implementer: "openai/gpt-5.3-codex",
  consultant_primary: "anthropic/claude-opus-4-6",
  consultant_secondary: "anthropic/claude-sonnet-4-6",
  reviewer_codex: "openai/gpt-5.3-codex",
  reviewer_claude: "anthropic/claude-opus-4-6",
  synthesizer: "openai/gpt-5.3-codex",
} as const;

export const DEFAULT_STAGE_FILES = {
  plan: "plan.md",
  "plan-review": "plan-review.md",
  "implementation-context": "implementation-context.md",
  "review-codex": "review-codex.md",
  "review-claude": "review-claude.md",
  "final-synthesis": "final-synthesis.md",
} as const;

export const DEFAULT_STAGE_ORDER = [...AKANE_STAGE_IDS];
