import { readFileSync } from "node:fs";
import { loadProjectConfig } from "@sdlc-kit/core";

export interface CliOutput {
  stdout(message: string): void;
  stderr(message: string): void;
}

export interface RunCliOptions {
  cwd?: string;
  output?: CliOutput;
}

const plannedCommands = new Set([
  "init",
  "adopt",
  "blueprint",
  "worktree",
  "qa",
  "drift",
  "closeout",
  "route",
]);

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
    case "doctor":
      return runDoctor(options, output);
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

function runDoctor(options: RunCliOptions, output: CliOutput): number {
  try {
    const result = loadProjectConfig(options.cwd);
    output.stdout(`sdlc doctor: loaded ${result.configPath}`);
    output.stdout(`project: ${result.config.project}`);
    return 0;
  } catch (error) {
    output.stderr(toErrorMessage(error));
    return 1;
  }
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
