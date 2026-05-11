#!/usr/bin/env bun
import { loadProjectConfig } from "@sdlc-kit/core";

const [command, ...args] = Bun.argv.slice(2);

switch (command) {
  case undefined:
  case "-h":
  case "--help":
    printHelp();
    break;
  case "-v":
  case "--version":
    console.log("sdlc-kit 0.0.0");
    break;
  case "doctor":
    runDoctor();
    break;
  case "init":
  case "adopt":
  case "blueprint":
  case "worktree":
  case "qa":
  case "drift":
  case "closeout":
  case "route":
    console.log(`sdlc ${command}: planned command, not implemented yet.`);
    if (args.length > 0) {
      console.log(`args: ${args.join(" ")}`);
    }
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error("Run `sdlc --help` for available commands.");
    process.exitCode = 1;
}

function printHelp(): void {
  console.log(`sdlc-kit

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
  route      Manage local QA routes
`);
}

function runDoctor(): void {
  const result = loadProjectConfig();
  console.log(`sdlc doctor: loaded ${result.configPath}`);
  console.log(`project: ${result.config.project}`);
}
