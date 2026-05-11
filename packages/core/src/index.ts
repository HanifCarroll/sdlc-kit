import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import YAML from "yaml";

export type ProviderName = "github" | "vercel" | "cloudflare" | "portless" | "none";

const validProviders: ProviderName[] = ["github", "vercel", "cloudflare", "portless", "none"];

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

export interface SdlcProjectPaths {
  constitution?: string;
  currentState?: string;
  capabilitiesDir?: string;
  plansDir?: string;
  decisionsDir?: string;
  worktreesRoot?: string;
}

export interface LoadProjectConfigResult {
  projectRoot: string;
  configPath: string;
  config: SdlcProjectConfig;
  paths: SdlcProjectPaths;
}

export function findProjectRoot(start = process.cwd()): string | null {
  let current = resolve(start);

  if (existsSync(current) && statSync(current).isFile()) {
    current = dirname(current);
  }

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

export function loadProjectConfig(start = process.cwd()): LoadProjectConfigResult {
  const projectRoot = findProjectRoot(start);

  if (!projectRoot) {
    throw new Error(`No .sdlc/project.yml found from ${resolve(start)}. Run \`sdlc init\` or \`sdlc adopt\` first.`);
  }

  const configPath = join(projectRoot, ".sdlc", "project.yml");
  if (!existsSync(configPath)) {
    throw new Error(`No .sdlc/project.yml found at ${configPath}. Run \`sdlc init\` or \`sdlc adopt\` first.`);
  }

  const parsed = parseProjectConfig(readFileSync(configPath, "utf8"), configPath);
  const config = validateProjectConfig(parsed);

  return {
    projectRoot,
    configPath,
    config,
    paths: resolveProjectPaths(projectRoot, config),
  };
}

export function validateProjectConfig(value: unknown): SdlcProjectConfig {
  if (!isRecord(value)) {
    throw new Error(".sdlc/project.yml must be a YAML object.");
  }

  assertKnownKeys(value, "root", ["version", "project", "base_branch", "tracker", "docs", "worktrees", "local", "preview", "production", "commands"]);

  if (value.version !== 1) {
    throw new Error(".sdlc/project.yml must set `version: 1`.");
  }

  if (typeof value.project !== "string" || value.project.trim() === "") {
    throw new Error(".sdlc/project.yml must set a non-empty `project`.");
  }

  validateOptionalString(value.base_branch, "base_branch");
  validateTracker(value.tracker);
  validateDocs(value.docs);
  validateWorktrees(value.worktrees);
  validateLocal(value.local);
  validatePreview(value.preview);
  validateProduction(value.production);
  validateCommands(value.commands);

  return value as unknown as SdlcProjectConfig;
}

function parseProjectConfig(contents: string, configPath: string): unknown {
  try {
    return YAML.parse(contents) as unknown;
  } catch (error) {
    throw new Error(`Failed to parse ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function resolveProjectPaths(projectRoot: string, config: SdlcProjectConfig): SdlcProjectPaths {
  const paths: SdlcProjectPaths = {};

  if (config.docs?.constitution) {
    paths.constitution = resolveProjectPath(projectRoot, config.docs.constitution);
  }
  if (config.docs?.current_state) {
    paths.currentState = resolveProjectPath(projectRoot, config.docs.current_state);
  }
  if (config.docs?.capabilities_dir) {
    paths.capabilitiesDir = resolveProjectPath(projectRoot, config.docs.capabilities_dir);
  }
  if (config.docs?.plans_dir) {
    paths.plansDir = resolveProjectPath(projectRoot, config.docs.plans_dir);
  }
  if (config.docs?.decisions_dir) {
    paths.decisionsDir = resolveProjectPath(projectRoot, config.docs.decisions_dir);
  }
  if (config.worktrees?.root) {
    paths.worktreesRoot = resolveProjectPath(projectRoot, config.worktrees.root);
  }

  return paths;
}

function resolveProjectPath(projectRoot: string, pathValue: string): string {
  return resolve(projectRoot, pathValue);
}

function validateTracker(value: unknown): void {
  if (value === undefined) {
    return;
  }

  assertObject(value, "tracker");
  assertKnownKeys(value, "tracker", ["provider"]);
  validateProvider(value.provider, "tracker.provider", true);
}

function validateDocs(value: unknown): void {
  if (value === undefined) {
    return;
  }

  assertObject(value, "docs");
  assertKnownKeys(value, "docs", ["constitution", "current_state", "capabilities_dir", "plans_dir", "decisions_dir"]);
  validateOptionalString(value.constitution, "docs.constitution");
  validateOptionalString(value.current_state, "docs.current_state");
  validateOptionalString(value.capabilities_dir, "docs.capabilities_dir");
  validateOptionalString(value.plans_dir, "docs.plans_dir");
  validateOptionalString(value.decisions_dir, "docs.decisions_dir");
}

function validateWorktrees(value: unknown): void {
  if (value === undefined) {
    return;
  }

  assertObject(value, "worktrees");
  assertKnownKeys(value, "worktrees", ["root", "branch_prefix"]);
  validateOptionalString(value.root, "worktrees.root");
  validateOptionalString(value.branch_prefix, "worktrees.branch_prefix");
}

function validateLocal(value: unknown): void {
  if (value === undefined) {
    return;
  }

  assertObject(value, "local");
  assertKnownKeys(value, "local", ["provider", "route_pattern", "required_before_push"]);
  validateProvider(value.provider, "local.provider");
  validateOptionalString(value.route_pattern, "local.route_pattern");
  validateOptionalBoolean(value.required_before_push, "local.required_before_push");
}

function validatePreview(value: unknown): void {
  if (value === undefined) {
    return;
  }

  assertObject(value, "preview");
  assertKnownKeys(value, "preview", ["provider", "required_before_merge", "environment", "require_preview_secrets"]);
  validateProvider(value.provider, "preview.provider");
  validateOptionalBoolean(value.required_before_merge, "preview.required_before_merge");
  validateOptionalString(value.environment, "preview.environment");
  validateOptionalBoolean(value.require_preview_secrets, "preview.require_preview_secrets");
}

function validateProduction(value: unknown): void {
  if (value === undefined) {
    return;
  }

  assertObject(value, "production");
  assertKnownKeys(value, "production", ["required_before_issue_close", "smoke_paths"]);
  validateOptionalBoolean(value.required_before_issue_close, "production.required_before_issue_close");
  validateOptionalStringArray(value.smoke_paths, "production.smoke_paths");
}

function validateCommands(value: unknown): void {
  if (value === undefined) {
    return;
  }

  assertObject(value, "commands");

  for (const [name, command] of Object.entries(value)) {
    if (typeof command !== "string" || command.trim() === "") {
      throw new Error(`commands.${name} must be a non-empty string.`);
    }
  }
}

function validateProvider(value: unknown, key: string, required = false): void {
  if (value === undefined) {
    if (required) {
      throw new Error(`${key} is required.`);
    }
    return;
  }

  if (!validProviders.includes(value as ProviderName)) {
    throw new Error(`${key} must be one of: ${validProviders.join(", ")}.`);
  }
}

function validateOptionalString(value: unknown, key: string): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} must be a non-empty string.`);
  }
}

function validateOptionalBoolean(value: unknown, key: string): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${key} must be a boolean.`);
  }
}

function validateOptionalStringArray(value: unknown, key: string): void {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${key} must be a list of non-empty strings.`);
  }

  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.trim() === "") {
      throw new Error(`${key}[${index}] must be a non-empty string.`);
    }
  }
}

function assertObject(value: unknown, key: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${key} must be a YAML object.`);
  }
}

function assertKnownKeys(value: Record<string, unknown>, key: string, knownKeys: string[]): void {
  for (const candidate of Object.keys(value)) {
    if (!knownKeys.includes(candidate)) {
      throw new Error(`${key} contains unsupported key \`${candidate}\`.`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export * from "./templates";
export * from "./blueprints";
export * from "./plans";
