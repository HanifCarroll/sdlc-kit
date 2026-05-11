import { existsSync, readFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { GitHubAdapter, type GitHubCommandRunner } from "@sdlc-kit/github-adapter";
import {
  inspectTemplateFiles,
  isPresetName,
  loadProjectConfig,
  renderPreset,
  validatePlanDocuments,
  writeIssueBlueprint,
  writeTemplateFiles,
  type LoadProjectConfigResult,
  type PresetName,
  type TemplateFile,
  type TemplateFileInspection,
  type TemplateWritePlan,
} from "@sdlc-kit/core";

export interface CliOutput {
  stdout(message: string): void;
  stderr(message: string): void;
}

export interface RunCliOptions {
  cwd?: string;
  output?: CliOutput;
  githubRunner?: GitHubCommandRunner;
}

const plannedCommands = new Set(["worktree", "qa", "drift", "closeout", "route"]);

const defaultOutput: CliOutput = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
};

export const cliPackage = readPackageMetadata();

export function runCli(argv: string[], options: RunCliOptions = {}): number {
  const [command, ...args] = argv;
  const output = options.output ?? defaultOutput;

  switch (command) {
    case undefined:
    case "-h":
    case "--help":
      output.stdout(helpText());
      return 0;
    case "-v":
    case "--version":
      output.stdout(`${cliPackage.name} ${cliPackage.version}`);
      return 0;
    case "init":
      return runInit(args, options, output);
    case "adopt":
      return runAdopt(args, options, output);
    case "doctor":
      return runDoctor(args, options, output);
    case "blueprint":
      return runBlueprint(args, options, output);
    default:
      if (command && plannedCommands.has(command)) {
        output.stderr(plannedCommandText(command, args));
        return 1;
      }

      output.stderr(`Unknown command: ${command}`);
      output.stderr("Run `sdlc --help` for available commands.");
      return 1;
  }
}

export function helpText(): string {
  return `sdlc-kit

Usage:
  sdlc <command>

Commands:
  init       Install the SDLC contract in a new project
  adopt      Inspect an existing project and propose a safe adoption plan
  doctor     Validate the local SDLC contract
  blueprint  Generate or sync an issue-level blueprint
  worktree   Create or inspect issue worktrees
  qa         Capture local, preview, or production QA evidence
  drift      Check docs/capability drift
  closeout   Write issue closeout evidence
  route      Manage local QA routes`;
}

function runInit(args: string[], options: RunCliOptions, output: CliOutput): number {
  if (isHelpRequest(args)) {
    output.stdout(templateCommandHelp("init"));
    return 0;
  }

  try {
    const parsed = parseTemplateCommandOptions(args, options, "init");
    const files = renderPreset({
      preset: parsed.preset,
      project: parsed.project,
      baseBranch: parsed.baseBranch,
      packageManager: parsed.packageManager,
    });
    const plan = writeTemplateFiles(parsed.cwd, files, { overwrite: parsed.overwrite });

    output.stdout(formatWriteSummary("sdlc init", parsed, plan));
    return 0;
  } catch (error) {
    output.stderr(toErrorMessage(error));
    return 1;
  }
}

function runAdopt(args: string[], options: RunCliOptions, output: CliOutput): number {
  if (isHelpRequest(args)) {
    output.stdout(templateCommandHelp("adopt"));
    return 0;
  }

  try {
    const parsed = parseTemplateCommandOptions(args, options, "adopt");
    const files = renderPreset({
      preset: parsed.preset,
      project: parsed.project,
      baseBranch: parsed.baseBranch,
      packageManager: parsed.packageManager,
    });
    const inspection = inspectTemplateFiles(parsed.cwd, files);

    if (!parsed.apply) {
      output.stdout(formatAdoptReport(parsed, inspection));
      return 0;
    }

    const filesToWrite = parsed.overwrite ? files : missingTemplateFiles(files, inspection);
    const plan = writeTemplateFiles(parsed.cwd, filesToWrite, { overwrite: parsed.overwrite });
    output.stdout(formatAdoptApplySummary(parsed, plan, inspection));
    return 0;
  } catch (error) {
    output.stderr(toErrorMessage(error));
    return 1;
  }
}

function runDoctor(args: string[], options: RunCliOptions, output: CliOutput): number {
  if (args.includes("--help") || args.includes("-h")) {
    output.stdout(`sdlc doctor

Usage:
  sdlc doctor

Validates the local .sdlc/project.yml manifest and reports command, provider, docs, preview, and production closeout warnings.`);
    return 0;
  }

  try {
    const result = loadProjectConfig(options.cwd);
    output.stdout(doctorReport(result).join("\n"));
    return 0;
  } catch (error) {
    output.stderr(toErrorMessage(error));
    return 1;
  }
}

function runBlueprint(args: string[], options: RunCliOptions, output: CliOutput): number {
  if (isHelpRequest(args)) {
    output.stdout(`sdlc blueprint

Usage:
  sdlc blueprint <issue-number> [--sync] [--overwrite]

Writes .sdlc/blueprints/issue-<number>.md from the configured GitHub issue. Pass --sync to post or update the marked blueprint comment on the issue.`);
    return 0;
  }

  try {
    const parsed = parseBlueprintCommandOptions(args);
    const project = loadProjectConfig(options.cwd);

    if (project.config.tracker?.provider !== "github") {
      throw new Error("sdlc blueprint currently requires tracker.provider: github.");
    }

    const github =
      options.githubRunner === undefined
        ? new GitHubAdapter({ cwd: project.projectRoot })
        : new GitHubAdapter({ cwd: project.projectRoot, runner: options.githubRunner });
    const issue = github.getIssue(parsed.issueNumber);
    const write = writeIssueBlueprint(project.projectRoot, issue, { overwrite: parsed.overwrite });
    const lines = [
      `sdlc blueprint: ${write.action} ${relative(project.projectRoot, write.path)}`,
      `gitignore: ${write.gitignoreAction} ${relative(project.projectRoot, write.gitignorePath)}`,
    ];

    if (parsed.sync) {
      const sync = github.upsertBlueprintComment(parsed.issueNumber, write.content);
      lines.push(`github: ${sync.action} blueprint comment`);
    } else {
      lines.push("github: skipped (pass --sync to update the issue comment)");
    }

    output.stdout(lines.join("\n"));
    return 0;
  } catch (error) {
    output.stderr(toErrorMessage(error));
    return 1;
  }
}

interface TemplateCommandOptions {
  cwd: string;
  preset: PresetName;
  project: string;
  baseBranch: string;
  packageManager: "bun" | "npm" | "pnpm";
  apply: boolean;
  overwrite: boolean;
}

interface BlueprintCommandOptions {
  issueNumber: number;
  sync: boolean;
  overwrite: boolean;
}

function parseBlueprintCommandOptions(args: string[]): BlueprintCommandOptions {
  let issueNumber: number | undefined;
  let sync = false;
  let overwrite = false;

  for (const arg of args) {
    if (arg === "--sync") {
      sync = true;
      continue;
    }
    if (arg === "--overwrite" || arg === "--force") {
      overwrite = true;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option for sdlc blueprint: ${arg}`);
    }
    if (issueNumber !== undefined) {
      throw new Error(`Unexpected extra argument for sdlc blueprint: ${arg}`);
    }

    const parsed = Number(arg);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error("sdlc blueprint requires a positive GitHub issue number.");
    }
    issueNumber = parsed;
  }

  if (issueNumber === undefined) {
    throw new Error("sdlc blueprint requires an issue number.");
  }

  return { issueNumber, sync, overwrite };
}

function parseTemplateCommandOptions(
  args: string[],
  options: RunCliOptions,
  command: "init" | "adopt",
): TemplateCommandOptions {
  const cwd = resolve(options.cwd ?? process.cwd());
  let preset: PresetName = "full";
  let project = inferProjectName(cwd);
  let baseBranch = "main";
  let packageManager: "bun" | "npm" | "pnpm" = "bun";
  let apply = false;
  let overwrite = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--apply") {
      if (command !== "adopt") {
        throw new Error("Unknown option for sdlc init: --apply");
      }
      apply = true;
      continue;
    }
    if (arg === "--overwrite" || arg === "--force") {
      overwrite = true;
      continue;
    }

    if (arg?.startsWith("--preset=")) {
      preset = parsePreset(arg.slice("--preset=".length));
      continue;
    }
    if (arg === "--preset") {
      index += 1;
      preset = parsePreset(requiredOptionValue(args[index], "--preset"));
      continue;
    }

    if (arg?.startsWith("--project=")) {
      project = requiredOptionValue(arg.slice("--project=".length), "--project");
      continue;
    }
    if (arg === "--project") {
      index += 1;
      project = requiredOptionValue(args[index], "--project");
      continue;
    }

    if (arg?.startsWith("--base-branch=")) {
      baseBranch = requiredOptionValue(arg.slice("--base-branch=".length), "--base-branch");
      continue;
    }
    if (arg === "--base-branch") {
      index += 1;
      baseBranch = requiredOptionValue(args[index], "--base-branch");
      continue;
    }

    if (arg?.startsWith("--package-manager=")) {
      packageManager = parsePackageManager(arg.slice("--package-manager=".length));
      continue;
    }
    if (arg === "--package-manager") {
      index += 1;
      packageManager = parsePackageManager(requiredOptionValue(args[index], "--package-manager"));
      continue;
    }

    throw new Error(`Unknown option for sdlc ${command}: ${arg}`);
  }

  return {
    cwd,
    preset,
    project,
    baseBranch,
    packageManager,
    apply,
    overwrite,
  };
}

function isHelpRequest(args: string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

function parsePreset(value: string): PresetName {
  if (!isPresetName(value)) {
    throw new Error("Preset must be one of: full, hanif, github-vercel, github-cloudflare, local-only, library.");
  }
  return value;
}

function parsePackageManager(value: string): "bun" | "npm" | "pnpm" {
  if (value === "bun" || value === "npm" || value === "pnpm") {
    return value;
  }
  throw new Error("Package manager must be one of: bun, npm, pnpm.");
}

function requiredOptionValue(value: string | undefined, option: string): string {
  if (!value || value.trim() === "") {
    throw new Error(`${option} requires a value.`);
  }
  return value.trim();
}

function inferProjectName(cwd: string): string {
  return basename(cwd) || "project";
}

function templateCommandHelp(command: "init" | "adopt"): string {
  const apply = command === "adopt" ? " [--apply]" : "";
  return `sdlc ${command}

Usage:
  sdlc ${command} [--preset full] [--project name] [--base-branch main] [--package-manager bun]${apply} [--overwrite]

Presets:
  full, hanif, github-vercel, github-cloudflare, local-only, library`;
}

function formatWriteSummary(
  label: string,
  options: TemplateCommandOptions,
  plan: TemplateWritePlan[],
): string {
  const lines = [
    `${label}: wrote ${plan.length} files`,
    `project: ${options.project}`,
    `preset: ${options.preset}`,
  ];

  for (const item of plan) {
    lines.push(`- ${item.action}: ${item.path}`);
  }

  return lines.join("\n");
}

function formatAdoptReport(options: TemplateCommandOptions, inspection: TemplateFileInspection[]): string {
  const missing = inspection.filter((file) => file.state === "missing");
  const existing = inspection.filter((file) => file.state === "exists");
  const lines = [
    "sdlc adopt: report only",
    `project: ${options.project}`,
    `preset: ${options.preset}`,
    "No files written. Re-run with `sdlc adopt --apply` to create missing files.",
    "Adopted repos start with drift checks warn-only.",
    `missing: ${missing.length}`,
  ];

  for (const item of missing) {
    lines.push(`- create: ${item.path}`);
  }

  lines.push(`existing: ${existing.length}`);
  for (const item of existing) {
    lines.push(`- keep: ${item.path}`);
  }

  return lines.join("\n");
}

function formatAdoptApplySummary(
  options: TemplateCommandOptions,
  plan: TemplateWritePlan[],
  inspection: TemplateFileInspection[],
): string {
  const existing = inspection.filter((file) => file.state === "exists");
  const lines = [
    `sdlc adopt --apply: wrote ${plan.length} files`,
    `project: ${options.project}`,
    `preset: ${options.preset}`,
    "Adopted repos start with drift checks warn-only.",
  ];

  for (const item of plan) {
    lines.push(`- ${item.action}: ${item.path}`);
  }

  if (!options.overwrite && existing.length > 0) {
    lines.push(`preserved existing files: ${existing.length}`);
  }

  return lines.join("\n");
}

function missingTemplateFiles(files: TemplateFile[], inspection: TemplateFileInspection[]): TemplateFile[] {
  const missing = new Set(
    inspection.filter((file) => file.state === "missing").map((file) => file.path),
  );
  return files.filter((file) => missing.has(file.path));
}

function doctorReport(result: LoadProjectConfigResult): string[] {
  const { config } = result;
  const lines = [
    `sdlc doctor: loaded ${result.configPath}`,
    `project: ${config.project}`,
    `base branch: ${config.base_branch ?? "main"}`,
    `tracker: ${config.tracker?.provider ?? "none"}`,
    `local: ${config.local?.provider ?? "none"}`,
    `preview: ${config.preview?.provider ?? "none"}`,
    `production closeout required: ${String(config.production?.required_before_issue_close ?? false)}`,
  ];

  const commandEntries = Object.entries(config.commands ?? {});
  if (commandEntries.length > 0) {
    lines.push("commands:");
    for (const [name, command] of commandEntries) {
      lines.push(`- ${name}: ${command}`);
    }
  } else {
    lines.push("warning: no commands configured.");
  }

  const warnings = doctorWarnings(result);
  if (warnings.length > 0) {
    lines.push("warnings:");
    for (const warning of warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines;
}

function doctorWarnings(result: LoadProjectConfigResult): string[] {
  const warnings: string[] = [];
  const { config, paths, projectRoot } = result;
  const pathLabels: Record<string, string> = {
    constitution: "docs.constitution",
    currentState: "docs.current_state",
    capabilitiesDir: "docs.capabilities_dir",
    plansDir: "docs.plans_dir",
    decisionsDir: "docs.decisions_dir",
    worktreesRoot: "worktrees.root",
  };

  for (const [label, path] of Object.entries(paths)) {
    if (path && !existsSync(path)) {
      warnings.push(`${pathLabels[label] ?? label} does not exist yet: ${relative(projectRoot, path)}`);
    }
  }

  if (paths.plansDir && existsSync(paths.plansDir)) {
    for (const plan of validatePlanDocuments(paths.plansDir)) {
      for (const error of plan.errors) {
        warnings.push(`docs.plans_dir ${plan.relativePath}: ${error}`);
      }
    }
  }

  const previewProvider = config.preview?.provider ?? "none";
  if (
    previewProvider === "vercel" &&
    config.preview?.required_before_merge === true &&
    config.preview.environment?.toLowerCase() === "production"
  ) {
    warnings.push("vercel preview checks are configured for the production environment; use preview or a non-production custom environment.");
  }

  if (
    previewProvider !== "none" &&
    config.preview?.required_before_merge === true &&
    config.preview.require_preview_secrets !== true
  ) {
    warnings.push("preview is required before merge but preview secret/binding confirmation is not required.");
  }

  if (
    config.production?.required_before_issue_close === true &&
    (!config.production.smoke_paths || config.production.smoke_paths.length === 0)
  ) {
    warnings.push("production closeout is required but no production smoke paths are configured.");
  }

  warnings.push(...providerWarnings(config.tracker?.provider, "tracker"));
  warnings.push(...providerWarnings(config.local?.provider, "local"));
  warnings.push(...providerWarnings(config.preview?.provider, "preview"));

  return warnings;
}

function providerWarnings(provider: string | undefined, surface: string): string[] {
  if (!provider || provider === "none") {
    return [];
  }

  const commandByProvider: Record<string, string> = {
    github: "gh",
    vercel: "vercel",
    cloudflare: "wrangler",
    portless: "portless",
  };
  const command = commandByProvider[provider];
  if (!command || commandAvailable(command)) {
    return [];
  }

  return [`${surface} provider '${provider}' is configured but '${command}' was not found on PATH.`];
}

function commandAvailable(command: string): boolean {
  const result = Bun.spawnSync({
    cmd: ["sh", "-lc", `command -v ${command}`],
    stdout: "ignore",
    stderr: "ignore",
  });
  return result.exitCode === 0;
}

function plannedCommandText(command: string, args: string[]): string {
  const lines = [`sdlc ${command}: planned command, not implemented yet.`];
  if (args.length > 0) {
    lines.push(`args: ${args.join(" ")}`);
  }
  return lines.join("\n");
}

function readPackageMetadata(): { name: string; version: string } {
  const rawPackage = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  const parsed = JSON.parse(rawPackage) as { name?: unknown; version?: unknown };

  return {
    name: typeof parsed.name === "string" ? parsed.name : "sdlc-kit",
    version: typeof parsed.version === "string" ? parsed.version : "0.0.0",
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
