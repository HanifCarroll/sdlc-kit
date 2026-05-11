import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import YAML from "yaml";

export const planStatuses = ["draft", "active", "approved", "superseded", "archived"] as const;

export type PlanStatus = (typeof planStatuses)[number];

export interface PlanDocumentValidation {
  path: string;
  relativePath: string;
  status?: PlanStatus;
  errors: string[];
}

export function validatePlanDocuments(plansDir: string): PlanDocumentValidation[] {
  if (!existsSync(plansDir)) {
    return [];
  }

  return findPlanMarkdownFiles(plansDir).map((path) => validatePlanDocument(plansDir, path));
}

function validatePlanDocument(plansDir: string, path: string): PlanDocumentValidation {
  const relativePath = relative(plansDir, path);
  const contents = readFileSync(path, "utf8");
  const frontmatter = parseFrontmatter(contents);

  if (!frontmatter.ok) {
    return {
      path,
      relativePath,
      errors: [frontmatter.error],
    };
  }

  const errors: string[] = [];
  const status = frontmatter.value.status;

  if (!isPlanStatus(status)) {
    errors.push(`frontmatter.status must be one of: ${planStatuses.join(", ")}`);
  }

  if (!isIsoDateString(frontmatter.value.created)) {
    errors.push("frontmatter.created must be a YYYY-MM-DD string");
  }

  if (frontmatter.value.updated !== undefined && !isIsoDateString(frontmatter.value.updated)) {
    errors.push("frontmatter.updated must be a YYYY-MM-DD string when present");
  }

  const result: PlanDocumentValidation = {
    path,
    relativePath,
    errors,
  };
  if (isPlanStatus(status)) {
    result.status = status;
  }
  return result;
}

function findPlanMarkdownFiles(plansDir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(plansDir, { withFileTypes: true })) {
    const path = join(plansDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findPlanMarkdownFiles(path));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }
    if (entry.name === "README.md" || entry.name.startsWith("_")) {
      continue;
    }

    files.push(path);
  }

  return files.sort();
}

function parseFrontmatter(contents: string):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string } {
  const match = contents.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) {
    return { ok: false, error: "missing YAML frontmatter" };
  }

  try {
    const parsed = YAML.parse(match[1] ?? "") as unknown;
    if (!isRecord(parsed)) {
      return { ok: false, error: "YAML frontmatter must be an object" };
    }
    return { ok: true, value: parsed };
  } catch (error) {
    return {
      ok: false,
      error: `invalid YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function isPlanStatus(value: unknown): value is PlanStatus {
  return typeof value === "string" && planStatuses.includes(value as PlanStatus);
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
