import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import YAML from "yaml";

export type ProviderName = "github" | "vercel" | "cloudflare" | "portless" | "none";

export interface SdlcProjectConfig {
  version: 1;
  project: string;
  base_branch?: string;
  tracker?: {
    provider: ProviderName;
  };
  docs?: {
    constitution?: string;
    current_state?: string;
    capabilities_dir?: string;
    plans_dir?: string;
    decisions_dir?: string;
  };
  worktrees?: {
    root?: string;
    branch_prefix?: string;
  };
  local?: {
    provider?: ProviderName;
    route_pattern?: string;
    required_before_push?: boolean;
  };
  preview?: {
    provider?: ProviderName;
    required_before_merge?: boolean;
    environment?: string;
    require_preview_secrets?: boolean;
  };
  production?: {
    required_before_issue_close?: boolean;
    smoke_paths?: string[];
  };
  commands?: Record<string, string>;
}

export interface LoadProjectConfigResult {
  configPath: string;
  config: SdlcProjectConfig;
}

export function findProjectRoot(start = process.cwd()): string | null {
  let current = resolve(start);

  while (true) {
    if (existsSync(join(current, ".sdlc", "project.yml"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function loadProjectConfig(projectRoot = findProjectRoot()): LoadProjectConfigResult {
  if (!projectRoot) {
    throw new Error("No .sdlc/project.yml found. Run `sdlc init` or `sdlc adopt` first.");
  }

  const configPath = join(projectRoot, ".sdlc", "project.yml");
  const parsed = YAML.parse(readFileSync(configPath, "utf8")) as unknown;
  const config = validateProjectConfig(parsed);

  return { configPath, config };
}

export function validateProjectConfig(value: unknown): SdlcProjectConfig {
  if (!isRecord(value)) {
    throw new Error(".sdlc/project.yml must be a YAML object.");
  }

  if (value.version !== 1) {
    throw new Error(".sdlc/project.yml must set `version: 1`.");
  }

  if (typeof value.project !== "string" || value.project.trim() === "") {
    throw new Error(".sdlc/project.yml must set a non-empty `project`.");
  }

  validateProvider(value.tracker, "tracker.provider");
  validateProvider(value.local, "local.provider", true);
  validateProvider(value.preview, "preview.provider", true);

  return value as unknown as SdlcProjectConfig;
}

function validateProvider(container: unknown, key: string, optional = false): void {
  if (container === undefined && optional) {
    return;
  }

  if (container === undefined) {
    return;
  }

  if (!isRecord(container) || container.provider === undefined) {
    return;
  }

  const valid: ProviderName[] = ["github", "vercel", "cloudflare", "portless", "none"];
  if (!valid.includes(container.provider as ProviderName)) {
    throw new Error(`${key} must be one of: ${valid.join(", ")}.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
