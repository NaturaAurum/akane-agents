import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expandHome } from "./config.js";

const MANAGED_MARKER = "<!-- managed-by: opencode-akane -->";
const GLOBAL_COMMANDS_DIR = "~/.config/opencode/commands";
const GLOBAL_SKILLS_DIR = "~/.config/opencode/skills";
const SKILL_NAME = "akane-workflow";

function bundledAssetPath(relativePath: string): string {
  return new URL(`../${relativePath}`, import.meta.url).pathname;
}

function hasManagedMarker(content: string): boolean {
  return content.includes(MANAGED_MARKER);
}

function insertManagedMarker(content: string): string {
  if (hasManagedMarker(content)) {
    return content;
  }

  if (content.startsWith("---\n")) {
    const frontmatterEnd = content.indexOf("\n---\n", 4);
    if (frontmatterEnd !== -1) {
      const splitIndex = frontmatterEnd + 5;
      return `${content.slice(0, splitIndex)}\n${MANAGED_MARKER}\n\n${content.slice(splitIndex)}`;
    }
  }

  return `${MANAGED_MARKER}\n${content}`;
}

function stripManagedMarker(content: string): string {
  return content.replace(`${MANAGED_MARKER}\n\n`, "").replace(`${MANAGED_MARKER}\n`, "").replace(MANAGED_MARKER, "");
}

async function writeManagedFile(
  targetPath: string,
  sourceContent: string,
): Promise<"created" | "updated" | "skipped"> {
  const managedContent = insertManagedMarker(sourceContent);

  try {
    const existing = await readFile(targetPath, "utf8");
    if (
      hasManagedMarker(existing) ||
      stripManagedMarker(existing) === stripManagedMarker(managedContent)
    ) {
      if (existing !== managedContent) {
        await writeFile(targetPath, managedContent, "utf8");
        return "updated";
      }

      return "skipped";
    }

    return "skipped";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    await writeFile(targetPath, managedContent, "utf8");
    return "created";
  }
}

export async function bootstrapAkaneGlobalAssets(): Promise<void> {
  const commandsSourceDir = bundledAssetPath(".opencode/commands");
  const commandsTargetDir = expandHome(GLOBAL_COMMANDS_DIR);
  const skillSourcePath = bundledAssetPath(".opencode/skills/akane-workflow/SKILL.md");
  const skillTargetDir = path.join(expandHome(GLOBAL_SKILLS_DIR), SKILL_NAME);
  const skillTargetPath = path.join(skillTargetDir, "SKILL.md");

  await mkdir(commandsTargetDir, { recursive: true });
  await mkdir(skillTargetDir, { recursive: true });

  const commandEntries = await readdir(commandsSourceDir, { withFileTypes: true });
  for (const entry of commandEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const sourcePath = path.join(commandsSourceDir, entry.name);
    const targetPath = path.join(commandsTargetDir, entry.name);
    const content = await readFile(sourcePath, "utf8");
    await writeManagedFile(targetPath, content);
  }

  const skillContent = await readFile(skillSourcePath, "utf8");
  await writeManagedFile(skillTargetPath, skillContent);
}
