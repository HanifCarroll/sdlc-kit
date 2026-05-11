import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { GitHubAdapter, type CloseoutEvidence, type GitHubCommandRunner } from "@sdlc-kit/github-adapter";
import YAML from "yaml";
import {
  PortlessAdapter,
  type PortlessCommandRunner,
  type PortlessOwnedRoute,
} from "@sdlc-kit/portless-adapter";
import {
  checkDrift,
  formatDriftResult,
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
  gitRunner?: GitCommandRunner;
  portlessRunner?: PortlessCommandRunner;
}

export interface GitCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface GitCommandOptions {
  cwd?: string;
}

export interface GitCommandRunner {
  run(args: string[], options?: GitCommandOptions): GitCommandResult;
}

const plannedCommands = new Set<string>();

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
    case "worktree":
      return runWorktree(args, options, output);
    case "qa":
      return runQa(args, options, output);
    case "route":
      return runRoute(args, options, output);
    case "drift":
      return runDrift(args, options, output);
    case "closeout":
      return runCloseout(args, options, output);
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

function runWorktree(args: string[], options: RunCliOptions, output: CliOutput): number {
  if (isHelpRequest(args)) {
    output.stdout(worktreeCommandHelp());
    return 0;
  }

  try {
    const [subcommand = "list", ...rest] = args;
    const project = loadProjectConfig(options.cwd);
    const git = options.gitRunner ?? createGitCommandRunner();

    if (subcommand === "list") {
      const result = runGit(git, ["worktree", "list", "--porcelain"], project.projectRoot);
      output.stdout(formatWorktreeList(result.stdout));
      return 0;
    }

    if (subcommand === "start") {
      const parsed = parseWorktreeStartOptions(rest);
      const issue = loadIssueForWorktree(project, parsed.issueNumber, options.githubRunner);
      const plan = buildWorktreeStartPlan(project, parsed, issue?.title);

      if (parsed.dryRun) {
        output.stdout(formatWorktreeDryRun(plan));
        return 0;
      }

      mkdirSync(plan.root, { recursive: true });
      if (existsSync(plan.path)) {
        output.stdout(formatWorktreeAlreadyExists(plan));
        return 0;
      }

      const branchExists = git.run(["rev-parse", "--verify", plan.branch], { cwd: project.projectRoot }).exitCode === 0;
      const args = branchExists
        ? ["worktree", "add", plan.path, plan.branch]
        : ["worktree", "add", "-b", plan.branch, plan.path, plan.baseBranch];
      runGit(git, args, project.projectRoot);
      output.stdout(formatWorktreeCreated(plan, branchExists));
      return 0;
    }

    throw new Error(`Unknown subcommand for sdlc worktree: ${subcommand}`);
  } catch (error) {
    output.stderr(toErrorMessage(error));
    return 1;
  }
}

function runQa(args: string[], options: RunCliOptions, output: CliOutput): number {
  if (isHelpRequest(args)) {
    output.stdout(qaCommandHelp());
    return 0;
  }

  try {
    const [subcommand = "list", ...rest] = args;
    const project = loadProjectConfig(options.cwd);

    if (subcommand === "record") {
      const parsed = parseQaRecordOptions(rest);
      const evidence = writeQaEvidence(project.projectRoot, parsed);
      output.stdout(`sdlc qa record: wrote ${relative(project.projectRoot, evidence.path)}`);
      return 0;
    }

    if (subcommand === "list") {
      const parsed = parseQaListOptions(rest);
      output.stdout(formatQaEvidenceList(readQaEvidence(project.projectRoot, parsed.issue)));
      return 0;
    }

    throw new Error(`Unknown subcommand for sdlc qa: ${subcommand}`);
  } catch (error) {
    output.stderr(toErrorMessage(error));
    return 1;
  }
}

function runCloseout(args: string[], options: RunCliOptions, output: CliOutput): number {
  if (isHelpRequest(args)) {
    output.stdout(closeoutCommandHelp());
    return 0;
  }

  try {
    const parsed = parseCloseoutOptions(args);
    const project = loadProjectConfig(options.cwd);
    if (project.config.tracker?.provider !== "github") {
      throw new Error("sdlc closeout currently requires tracker.provider: github.");
    }

    const qaEvidence = parsed.includeQa ? readQaEvidence(project.projectRoot, parsed.issueNumber) : [];
    const verification = [...parsed.verification, ...qaEvidence.map(formatQaEvidenceVerification)];
    if (verification.length === 0) {
      throw new Error("sdlc closeout requires --verification or --include-qa evidence.");
    }

    const github =
      options.githubRunner === undefined
        ? new GitHubAdapter({ cwd: project.projectRoot })
        : new GitHubAdapter({ cwd: project.projectRoot, runner: options.githubRunner });
    const evidence: CloseoutEvidence = {
      verification,
      ...(parsed.summary ? { summary: parsed.summary } : {}),
      ...(parsed.production ? { production: parsed.production } : {}),
      ...(parsed.notes.length > 0 ? { notes: parsed.notes } : {}),
    };

    github.writeCloseoutComment(parsed.issueNumber, evidence);
    if (parsed.closeIssue) {
      github.closeIssue(parsed.issueNumber);
    }

    output.stdout(formatCloseoutResult(parsed, qaEvidence.length));
    return 0;
  } catch (error) {
    output.stderr(toErrorMessage(error));
    return 1;
  }
}

function runRoute(args: string[], options: RunCliOptions, output: CliOutput): number {
  if (isHelpRequest(args)) {
    output.stdout(routeCommandHelp());
    return 0;
  }

  try {
    const [subcommand = "list", ...rest] = args;
    const project = loadProjectConfig(options.cwd);

    if (project.config.local?.provider !== "portless") {
      output.stdout(`sdlc route: local routes are not configured for this project (local.provider: ${project.config.local?.provider ?? "none"}).`);
      return 0;
    }

    const adapter = new PortlessAdapter({
      projectRoot: project.projectRoot,
      ...(options.portlessRunner ? { runner: options.portlessRunner } : {}),
    });

    if (subcommand === "list") {
      output.stdout(formatOwnedRoutes(adapter.listOwnedRoutes()));
      return 0;
    }

    if (subcommand === "ensure") {
      const parsed = parseRouteEnsureOptions(rest);
      const route = adapter.ensureRoute({
        project: project.config.project,
        port: parsed.port,
        ...(project.config.local.route_pattern ? { routePattern: project.config.local.route_pattern } : {}),
        ...(parsed.issue !== undefined ? { issue: parsed.issue } : {}),
        ...(parsed.branch ? { branch: parsed.branch } : {}),
        force: parsed.force,
      });
      output.stdout(route.message);
      return route.status === "port-conflict" ? 1 : 0;
    }

    if (subcommand === "cleanup") {
      const parsed = parseRouteCleanupOptions(rest);
      const cleanup = adapter.cleanupRoutes(parsed);
      output.stdout(cleanup.message);
      return 0;
    }

    throw new Error(`Unknown subcommand for sdlc route: ${subcommand}`);
  } catch (error) {
    output.stderr(toErrorMessage(error));
    return 1;
  }
}

function runDrift(args: string[], options: RunCliOptions, output: CliOutput): number {
  if (isHelpRequest(args)) {
    output.stdout(driftCommandHelp());
    return 0;
  }

  try {
    const parsed = parseDriftOptions(args);
    const project = loadProjectConfig(options.cwd);
    const changedFiles =
      parsed.changedFiles.length > 0
        ? parsed.changedFiles
        : readChangedFilesFromGit(project.projectRoot, parsed.base ?? project.config.base_branch ?? "main");
    const result = checkDrift({
      config: project.config,
      changedFiles,
      ...(parsed.noDocImpactReason ? { noDocImpactReason: parsed.noDocImpactReason } : {}),
    });

    output.stdout(parsed.json ? JSON.stringify(result, null, 2) : formatDriftResult(result));
    if (result.status === "error" || (parsed.failOnWarn && result.status === "warning")) {
      return 1;
    }
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

interface RouteEnsureOptions {
  issue?: number;
  port: number;
  branch?: string;
  force: boolean;
}

interface RouteCleanupOptions {
  issue?: number;
}

interface WorktreeStartOptions {
  issueNumber: number;
  branch?: string;
  dryRun: boolean;
}

interface WorktreeStartPlan {
  issueNumber: number;
  issueTitle?: string;
  branch: string;
  baseBranch: string;
  root: string;
  path: string;
}

type QaSurface = "local" | "preview" | "production";
type QaStatus = "pass" | "fail" | "blocked";

interface QaRecordOptions {
  issue: number;
  surface: QaSurface;
  status: QaStatus;
  url?: string;
  command?: string;
  screenshots: string[];
  videos: string[];
  notes: string[];
  overwrite: boolean;
}

interface QaListOptions {
  issue?: number;
}

interface QaEvidenceSummary {
  issue: number;
  surface: QaSurface;
  status: QaStatus;
  path: string;
  url?: string;
  screenshots: string[];
  videos: string[];
}

interface CloseoutOptions {
  issueNumber: number;
  summary?: string;
  verification: string[];
  production?: string;
  notes: string[];
  includeQa: boolean;
  closeIssue: boolean;
}

interface DriftOptions {
  base?: string;
  changedFiles: string[];
  noDocImpactReason?: string;
  json: boolean;
  failOnWarn: boolean;
}

function parseCloseoutOptions(args: string[]): CloseoutOptions {
  let issueNumber: number | undefined;
  let summary: string | undefined;
  const verification: string[] = [];
  let production: string | undefined;
  const notes: string[] = [];
  let includeQa = false;
  let closeIssue = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--include-qa") {
      includeQa = true;
      continue;
    }
    if (arg === "--close") {
      closeIssue = true;
      continue;
    }
    if (arg?.startsWith("--summary=")) {
      summary = requiredOptionValue(arg.slice("--summary=".length), "--summary");
      continue;
    }
    if (arg === "--summary") {
      index += 1;
      summary = requiredOptionValue(args[index], "--summary");
      continue;
    }
    if (arg?.startsWith("--verification=")) {
      verification.push(requiredOptionValue(arg.slice("--verification=".length), "--verification"));
      continue;
    }
    if (arg === "--verification") {
      index += 1;
      verification.push(requiredOptionValue(args[index], "--verification"));
      continue;
    }
    if (arg?.startsWith("--production=")) {
      production = requiredOptionValue(arg.slice("--production=".length), "--production");
      continue;
    }
    if (arg === "--production") {
      index += 1;
      production = requiredOptionValue(args[index], "--production");
      continue;
    }
    if (arg?.startsWith("--note=")) {
      notes.push(requiredOptionValue(arg.slice("--note=".length), "--note"));
      continue;
    }
    if (arg === "--note") {
      index += 1;
      notes.push(requiredOptionValue(args[index], "--note"));
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option for sdlc closeout: ${arg}`);
    }
    if (issueNumber !== undefined) {
      throw new Error(`Unexpected extra argument for sdlc closeout: ${arg}`);
    }

    issueNumber = parsePositiveInteger(arg, "issue");
  }

  if (issueNumber === undefined) {
    throw new Error("sdlc closeout requires an issue number.");
  }

  return {
    issueNumber,
    verification,
    notes,
    includeQa,
    closeIssue,
    ...(summary ? { summary } : {}),
    ...(production ? { production } : {}),
  };
}

function parseQaRecordOptions(args: string[]): QaRecordOptions {
  let issue: number | undefined;
  let surface: QaSurface | undefined;
  let status: QaStatus | undefined;
  let url: string | undefined;
  let command: string | undefined;
  const screenshots: string[] = [];
  const videos: string[] = [];
  const notes: string[] = [];
  let overwrite = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--overwrite" || arg === "--force") {
      overwrite = true;
      continue;
    }
    if (arg?.startsWith("--issue=")) {
      issue = parsePositiveInteger(arg.slice("--issue=".length), "--issue");
      continue;
    }
    if (arg === "--issue") {
      index += 1;
      issue = parsePositiveInteger(requiredOptionValue(args[index], "--issue"), "--issue");
      continue;
    }
    if (arg?.startsWith("--surface=")) {
      surface = parseQaSurface(arg.slice("--surface=".length));
      continue;
    }
    if (arg === "--surface") {
      index += 1;
      surface = parseQaSurface(requiredOptionValue(args[index], "--surface"));
      continue;
    }
    if (arg?.startsWith("--status=")) {
      status = parseQaStatus(arg.slice("--status=".length));
      continue;
    }
    if (arg === "--status") {
      index += 1;
      status = parseQaStatus(requiredOptionValue(args[index], "--status"));
      continue;
    }
    if (arg?.startsWith("--url=")) {
      url = requiredOptionValue(arg.slice("--url=".length), "--url");
      continue;
    }
    if (arg === "--url") {
      index += 1;
      url = requiredOptionValue(args[index], "--url");
      continue;
    }
    if (arg?.startsWith("--command=")) {
      command = requiredOptionValue(arg.slice("--command=".length), "--command");
      continue;
    }
    if (arg === "--command") {
      index += 1;
      command = requiredOptionValue(args[index], "--command");
      continue;
    }
    if (arg?.startsWith("--screenshot=")) {
      screenshots.push(requiredOptionValue(arg.slice("--screenshot=".length), "--screenshot"));
      continue;
    }
    if (arg === "--screenshot") {
      index += 1;
      screenshots.push(requiredOptionValue(args[index], "--screenshot"));
      continue;
    }
    if (arg?.startsWith("--video=")) {
      videos.push(requiredOptionValue(arg.slice("--video=".length), "--video"));
      continue;
    }
    if (arg === "--video") {
      index += 1;
      videos.push(requiredOptionValue(args[index], "--video"));
      continue;
    }
    if (arg?.startsWith("--note=")) {
      notes.push(requiredOptionValue(arg.slice("--note=".length), "--note"));
      continue;
    }
    if (arg === "--note") {
      index += 1;
      notes.push(requiredOptionValue(args[index], "--note"));
      continue;
    }

    throw new Error(`Unknown option for sdlc qa record: ${arg}`);
  }

  if (issue === undefined) {
    throw new Error("sdlc qa record requires --issue.");
  }
  if (surface === undefined) {
    throw new Error("sdlc qa record requires --surface.");
  }
  if (status === undefined) {
    throw new Error("sdlc qa record requires --status.");
  }

  return {
    issue,
    surface,
    status,
    screenshots,
    videos,
    notes,
    overwrite,
    ...(url ? { url } : {}),
    ...(command ? { command } : {}),
  };
}

function parseQaListOptions(args: string[]): QaListOptions {
  let issue: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg?.startsWith("--issue=")) {
      issue = parsePositiveInteger(arg.slice("--issue=".length), "--issue");
      continue;
    }
    if (arg === "--issue") {
      index += 1;
      issue = parsePositiveInteger(requiredOptionValue(args[index], "--issue"), "--issue");
      continue;
    }
    throw new Error(`Unknown option for sdlc qa list: ${arg}`);
  }

  return issue === undefined ? {} : { issue };
}

function parseQaSurface(value: string): QaSurface {
  if (value === "local" || value === "preview" || value === "production") {
    return value;
  }
  throw new Error("--surface must be one of: local, preview, production.");
}

function parseQaStatus(value: string): QaStatus {
  if (value === "pass" || value === "fail" || value === "blocked") {
    return value;
  }
  throw new Error("--status must be one of: pass, fail, blocked.");
}

function parseWorktreeStartOptions(args: string[]): WorktreeStartOptions {
  let issueNumber: number | undefined;
  let branch: string | undefined;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg?.startsWith("--branch=")) {
      branch = requiredOptionValue(arg.slice("--branch=".length), "--branch");
      continue;
    }
    if (arg === "--branch") {
      index += 1;
      branch = requiredOptionValue(args[index], "--branch");
      continue;
    }
    if (arg?.startsWith("-")) {
      throw new Error(`Unknown option for sdlc worktree start: ${arg}`);
    }
    if (issueNumber !== undefined) {
      throw new Error(`Unexpected extra argument for sdlc worktree start: ${arg}`);
    }

    issueNumber = parsePositiveInteger(arg, "issue");
  }

  if (issueNumber === undefined) {
    throw new Error("sdlc worktree start requires an issue number.");
  }

  return {
    issueNumber,
    dryRun,
    ...(branch ? { branch } : {}),
  };
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

function parseRouteEnsureOptions(args: string[]): RouteEnsureOptions {
  let issue: number | undefined;
  let port: number | undefined;
  let branch: string | undefined;
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg?.startsWith("--issue=")) {
      issue = parsePositiveInteger(arg.slice("--issue=".length), "--issue");
      continue;
    }
    if (arg === "--issue") {
      index += 1;
      issue = parsePositiveInteger(requiredOptionValue(args[index], "--issue"), "--issue");
      continue;
    }

    if (arg?.startsWith("--port=")) {
      port = parsePort(arg.slice("--port=".length));
      continue;
    }
    if (arg === "--port") {
      index += 1;
      port = parsePort(requiredOptionValue(args[index], "--port"));
      continue;
    }

    if (arg?.startsWith("--branch=")) {
      branch = requiredOptionValue(arg.slice("--branch=".length), "--branch");
      continue;
    }
    if (arg === "--branch") {
      index += 1;
      branch = requiredOptionValue(args[index], "--branch");
      continue;
    }

    throw new Error(`Unknown option for sdlc route ensure: ${arg}`);
  }

  if (port === undefined) {
    throw new Error("sdlc route ensure requires --port.");
  }

  return {
    port,
    force,
    ...(issue !== undefined ? { issue } : {}),
    ...(branch ? { branch } : {}),
  };
}

function parseRouteCleanupOptions(args: string[]): RouteCleanupOptions {
  let issue: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg?.startsWith("--issue=")) {
      issue = parsePositiveInteger(arg.slice("--issue=".length), "--issue");
      continue;
    }
    if (arg === "--issue") {
      index += 1;
      issue = parsePositiveInteger(requiredOptionValue(args[index], "--issue"), "--issue");
      continue;
    }
    throw new Error(`Unknown option for sdlc route cleanup: ${arg}`);
  }

  return issue === undefined ? {} : { issue };
}

function parseDriftOptions(args: string[]): DriftOptions {
  let base: string | undefined;
  const changedFiles: string[] = [];
  let noDocImpactReason: string | undefined;
  let json = false;
  let failOnWarn = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--fail-on-warn") {
      failOnWarn = true;
      continue;
    }

    if (arg?.startsWith("--base=")) {
      base = requiredOptionValue(arg.slice("--base=".length), "--base");
      continue;
    }
    if (arg === "--base") {
      index += 1;
      base = requiredOptionValue(args[index], "--base");
      continue;
    }

    if (arg?.startsWith("--changed=")) {
      changedFiles.push(requiredOptionValue(arg.slice("--changed=".length), "--changed"));
      continue;
    }
    if (arg === "--changed") {
      index += 1;
      changedFiles.push(requiredOptionValue(args[index], "--changed"));
      continue;
    }

    if (arg?.startsWith("--no-doc-impact=")) {
      noDocImpactReason = requiredOptionValue(arg.slice("--no-doc-impact=".length), "--no-doc-impact");
      continue;
    }
    if (arg === "--no-doc-impact") {
      index += 1;
      noDocImpactReason = requiredOptionValue(args[index], "--no-doc-impact");
      continue;
    }

    throw new Error(`Unknown option for sdlc drift: ${arg}`);
  }

  return {
    changedFiles,
    json,
    failOnWarn,
    ...(base ? { base } : {}),
    ...(noDocImpactReason ? { noDocImpactReason } : {}),
  };
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

function parsePositiveInteger(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return parsed;
}

function parsePort(value: string): number {
  const parsed = parsePositiveInteger(value, "--port");
  if (parsed > 65535) {
    throw new Error("--port must be between 1 and 65535.");
  }
  return parsed;
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

function createGitCommandRunner(): GitCommandRunner {
  return {
    run(args, options = {}) {
      try {
        const result = Bun.spawnSync(["git", ...args], {
          ...spawnCwdOption(options.cwd),
          stdout: "pipe",
          stderr: "pipe",
        });

        return {
          exitCode: result.exitCode,
          stdout: decodeOutput(result.stdout),
          stderr: decodeOutput(result.stderr),
        };
      } catch (error) {
        return {
          exitCode: 127,
          stdout: "",
          stderr: toErrorMessage(error),
        };
      }
    },
  };
}

function spawnCwdOption(cwd: string | undefined): { cwd?: string } {
  return cwd === undefined ? {} : { cwd };
}

function runGit(runner: GitCommandRunner, args: string[], cwd: string): GitCommandResult {
  const result = runner.run(args, { cwd });
  if (result.exitCode !== 0) {
    throw new Error(`Git command failed: git ${args.join(" ")}\n${result.stderr || result.stdout}`);
  }
  return result;
}

function loadIssueForWorktree(
  project: LoadProjectConfigResult,
  issueNumber: number,
  githubRunner: GitHubCommandRunner | undefined,
): { title: string } | undefined {
  if (project.config.tracker?.provider !== "github") {
    return undefined;
  }

  const github =
    githubRunner === undefined
      ? new GitHubAdapter({ cwd: project.projectRoot })
      : new GitHubAdapter({ cwd: project.projectRoot, runner: githubRunner });
  return github.getIssue(issueNumber);
}

function buildWorktreeStartPlan(
  project: LoadProjectConfigResult,
  options: WorktreeStartOptions,
  issueTitle: string | undefined,
): WorktreeStartPlan {
  const slug = slugifyIssueName(issueTitle ?? `issue-${options.issueNumber}`);
  const baseBranch = project.config.base_branch ?? "main";
  const prefix = normalizeBranchPrefix(project.config.worktrees?.branch_prefix ?? "codex");
  const branch = options.branch ?? `${prefix}/${options.issueNumber}-${slug}`;
  const root = project.paths.worktreesRoot ?? resolve(project.projectRoot, `../${project.config.project}-worktrees`);
  const path = join(root, `issue-${options.issueNumber}-${slug}`);

  return {
    issueNumber: options.issueNumber,
    ...(issueTitle ? { issueTitle } : {}),
    branch,
    baseBranch,
    root,
    path,
  };
}

function slugifyIssueName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return slug || "issue";
}

function normalizeBranchPrefix(value: string): string {
  return value.replace(/^\/+|\/+$/g, "") || "codex";
}

function templateCommandHelp(command: "init" | "adopt"): string {
  const apply = command === "adopt" ? " [--apply]" : "";
  return `sdlc ${command}

Usage:
  sdlc ${command} [--preset full] [--project name] [--base-branch main] [--package-manager bun]${apply} [--overwrite]

Presets:
  full, hanif, github-vercel, github-cloudflare, local-only, library`;
}

function routeCommandHelp(): string {
  return `sdlc route

Usage:
  sdlc route list
  sdlc route ensure --issue 123 --port 3000 [--branch name] [--force]
  sdlc route cleanup [--issue 123]

Manages owned Portless local QA routes in .sdlc/routes.local.json. Cleanup only removes routes recorded in that state file.`;
}

function worktreeCommandHelp(): string {
  return `sdlc worktree

Usage:
  sdlc worktree list
  sdlc worktree start <issue-number> [--branch name] [--dry-run]

Creates and inspects Git worktrees from the local .sdlc/project.yml contract. Worktree paths are created under worktrees.root, or ../<project>-worktrees when no root is configured.`;
}

function qaCommandHelp(): string {
  return `sdlc qa

Usage:
  sdlc qa list [--issue 123]
  sdlc qa record --issue 123 --surface local --status pass [--url url] [--command command] [--screenshot path-or-url] [--video path-or-url] [--note text] [--overwrite]

Records local, preview, and production QA evidence under .sdlc/qa/. Screenshots and videos are rendered into the evidence Markdown. Existing evidence for the same issue and surface requires --overwrite.`;
}

function closeoutCommandHelp(): string {
  return `sdlc closeout

Usage:
  sdlc closeout <issue-number> --verification text [--summary text] [--production text] [--note text] [--include-qa] [--close]

Posts an SDLC closeout comment to the configured GitHub issue. Pass --include-qa to include recorded .sdlc/qa/ evidence for the issue. Pass --close to close the issue after the comment is posted.`;
}

function driftCommandHelp(): string {
  return `sdlc drift

Usage:
  sdlc drift [--base main] [--changed path] [--no-doc-impact reason] [--json] [--fail-on-warn]

Checks changed source paths against drift.mappings in .sdlc/project.yml. Adopted repos should start with drift.mode: warn, then move to drift.mode: error after mappings are trustworthy.`;
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

function formatOwnedRoutes(routes: PortlessOwnedRoute[]): string {
  if (routes.length === 0) {
    return "sdlc route list: no owned Portless routes recorded.";
  }

  return [
    "sdlc route list:",
    ...routes.map((route) => `- ${route.url} -> ${route.port}${route.issue ? ` (issue #${route.issue})` : ""}`),
  ].join("\n");
}

function formatWorktreeList(output: string): string {
  const entries = parseGitWorktreePorcelain(output);
  if (entries.length === 0) {
    return "sdlc worktree list: no worktrees found.";
  }

  return [
    "sdlc worktree list:",
    ...entries.map((entry) => `- ${entry.branch ?? "(detached)"}: ${entry.path}`),
  ].join("\n");
}

function parseGitWorktreePorcelain(output: string): Array<{ path: string; branch?: string }> {
  return output
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .flatMap((block) => {
      const lines = block.split("\n");
      const worktreeLine = lines.find((line) => line.startsWith("worktree "));
      if (!worktreeLine) {
        return [];
      }
      const branchLine = lines.find((line) => line.startsWith("branch "));
      return [{
        path: worktreeLine.slice("worktree ".length),
        ...(branchLine ? { branch: branchLine.slice("branch refs/heads/".length) } : {}),
      }];
    });
}

function writeQaEvidence(projectRoot: string, evidence: QaRecordOptions): { path: string } {
  const directory = join(projectRoot, ".sdlc", "qa");
  const path = join(directory, `issue-${evidence.issue}-${evidence.surface}.md`);
  if (existsSync(path) && !evidence.overwrite) {
    throw new Error(`QA evidence already exists: ${relative(projectRoot, path)}. Pass --overwrite to replace it.`);
  }

  mkdirSync(directory, { recursive: true });
  writeFileSync(path, renderQaEvidence(evidence));
  return { path };
}

function readQaEvidence(projectRoot: string, issue: number | undefined): QaEvidenceSummary[] {
  const directory = join(projectRoot, ".sdlc", "qa");
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory)
    .filter((file) => file.endsWith(".md"))
    .filter((file) => issue === undefined || file.startsWith(`issue-${issue}-`))
    .flatMap((file) => parseQaEvidenceSummary(join(directory, file), projectRoot));
}

function renderQaEvidence(evidence: QaRecordOptions): string {
  const frontmatter: Record<string, unknown> = {
    issue: evidence.issue,
    surface: evidence.surface,
    status: evidence.status,
    recorded_at: new Date().toISOString(),
  };
  if (evidence.url) {
    frontmatter.url = evidence.url;
  }
  if (evidence.command) {
    frontmatter.command = evidence.command;
  }
  if (evidence.screenshots.length > 0) {
    frontmatter.screenshots = evidence.screenshots;
  }
  if (evidence.videos.length > 0) {
    frontmatter.videos = evidence.videos;
  }

  const lines = [
    "---",
    YAML.stringify(frontmatter).trimEnd(),
    "---",
    "",
    `# QA Evidence: #${evidence.issue} ${evidence.surface}`,
    "",
    `Status: ${evidence.status}`,
  ];

  if (evidence.url) {
    lines.push("", "## URL", "", evidence.url);
  }
  if (evidence.command) {
    lines.push("", "## Command", "", `\`${evidence.command}\``);
  }
  if (evidence.screenshots.length > 0) {
    lines.push("", "## Screenshots", "", ...evidence.screenshots.map((item, index) => `![Screenshot ${index + 1}](${item})`));
  }
  if (evidence.videos.length > 0) {
    lines.push("", "## Videos", "", ...evidence.videos.map((item, index) => `![Video ${index + 1}](${item})`));
  }
  if (evidence.notes.length > 0) {
    lines.push("", "## Notes", "", ...evidence.notes.map((note) => `- ${note}`));
  }

  return `${lines.join("\n")}\n`;
}

function parseQaEvidenceSummary(path: string, projectRoot: string): QaEvidenceSummary[] {
  const content = readFileSync(path, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return [];
  }

  const parsed = YAML.parse(match[1] ?? "") as unknown;
  if (!isQaEvidenceFrontmatter(parsed)) {
    return [];
  }

  return [{
    issue: parsed.issue,
    surface: parsed.surface,
    status: parsed.status,
    path: relative(projectRoot, path),
    screenshots: parsed.screenshots ?? [],
    videos: parsed.videos ?? [],
    ...(parsed.url ? { url: parsed.url } : {}),
  }];
}

function isQaEvidenceFrontmatter(value: unknown): value is {
  issue: number;
  surface: QaSurface;
  status: QaStatus;
  url?: string;
  screenshots?: string[];
  videos?: string[];
} {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.issue === "number" &&
    (record.surface === "local" || record.surface === "preview" || record.surface === "production") &&
    (record.status === "pass" || record.status === "fail" || record.status === "blocked") &&
    (record.url === undefined || typeof record.url === "string") &&
    (record.screenshots === undefined || isStringArray(record.screenshots)) &&
    (record.videos === undefined || isStringArray(record.videos))
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function formatQaEvidenceList(evidence: QaEvidenceSummary[]): string {
  if (evidence.length === 0) {
    return "sdlc qa list: no QA evidence recorded.";
  }

  return [
    "sdlc qa list:",
    ...evidence.map((item) => {
      const media = [
        item.screenshots.length > 0 ? `${item.screenshots.length} screenshot${item.screenshots.length === 1 ? "" : "s"}` : "",
        item.videos.length > 0 ? `${item.videos.length} video${item.videos.length === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      return `- #${item.issue} ${item.surface}: ${item.status}${item.url ? ` ${item.url}` : ""}${media.length > 0 ? ` [${media.join(", ")}]` : ""} (${item.path})`;
    }),
  ].join("\n");
}

function formatQaEvidenceVerification(evidence: QaEvidenceSummary): string {
  const media = [
    evidence.screenshots.length > 0 ? `${evidence.screenshots.length} screenshot${evidence.screenshots.length === 1 ? "" : "s"}` : "",
    evidence.videos.length > 0 ? `${evidence.videos.length} video${evidence.videos.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return [
    `QA ${evidence.surface}: ${evidence.status}`,
    evidence.url ? `url=${evidence.url}` : "",
    media.length > 0 ? `media=${media.join(", ")}` : "",
    `file=${evidence.path}`,
  ].filter(Boolean).join("; ");
}

function formatCloseoutResult(options: CloseoutOptions, qaEvidenceCount: number): string {
  return [
    "sdlc closeout: posted SDLC closeout comment",
    `issue: #${options.issueNumber}`,
    `verification items: ${options.verification.length + qaEvidenceCount}`,
    `qa evidence included: ${qaEvidenceCount}`,
    `closed: ${String(options.closeIssue)}`,
  ].join("\n");
}

function formatWorktreeDryRun(plan: WorktreeStartPlan): string {
  return [
    "sdlc worktree start: dry run",
    `issue: #${plan.issueNumber}${plan.issueTitle ? ` ${plan.issueTitle}` : ""}`,
    `branch: ${plan.branch}`,
    `base branch: ${plan.baseBranch}`,
    `path: ${plan.path}`,
  ].join("\n");
}

function formatWorktreeAlreadyExists(plan: WorktreeStartPlan): string {
  return [
    "sdlc worktree start: already exists",
    `branch: ${plan.branch}`,
    `path: ${plan.path}`,
  ].join("\n");
}

function formatWorktreeCreated(plan: WorktreeStartPlan, branchExists: boolean): string {
  return [
    "sdlc worktree start: created",
    `branch: ${plan.branch}`,
    `base branch: ${branchExists ? "(existing branch)" : plan.baseBranch}`,
    `path: ${plan.path}`,
  ].join("\n");
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
    if (!path || existsSync(path)) {
      continue;
    }
    if (label === "worktreesRoot" && isCurrentCheckoutInsideConfiguredWorktreeRoot(result, path)) {
      continue;
    }
    warnings.push(`${pathLabels[label] ?? label} does not exist yet: ${relative(projectRoot, path)}`);
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

  if (previewProvider === "cloudflare" && config.preview?.required_before_merge === true) {
    if (config.preview.environment?.toLowerCase() === "production") {
      warnings.push("cloudflare preview checks are configured for the production environment; use preview or a non-production environment.");
    }
    if (config.preview.require_preview_secrets !== true) {
      warnings.push("cloudflare preview checks require explicit preview/prod binding separation confirmation.");
    }
  }

  if (
    previewProvider !== "none" &&
    previewProvider !== "cloudflare" &&
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

function isCurrentCheckoutInsideConfiguredWorktreeRoot(
  result: LoadProjectConfigResult,
  resolvedWorktreesRoot: string,
): boolean {
  const configuredRoot = result.config.worktrees?.root;
  if (!configuredRoot || isAbsolute(configuredRoot)) {
    return false;
  }

  const currentParent = dirname(result.projectRoot);
  return existsSync(currentParent) && basename(currentParent) === basename(resolvedWorktreesRoot);
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

function readChangedFilesFromGit(projectRoot: string, base: string): string[] {
  const diffRange = `${base}...HEAD`;
  const result = Bun.spawnSync(["git", "diff", "--name-only", diffRange], {
    cwd: projectRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(`git diff failed for ${diffRange}: ${decodeOutput(result.stderr || result.stdout)}`);
  }

  return decodeOutput(result.stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function commandAvailable(command: string): boolean {
  const result = Bun.spawnSync({
    cmd: ["sh", "-lc", `command -v ${command}`],
    stdout: "ignore",
    stderr: "ignore",
  });
  return result.exitCode === 0;
}

function decodeOutput(value: Uint8Array): string {
  return new TextDecoder().decode(value);
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
