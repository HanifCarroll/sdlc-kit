import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { cliPackage, runCli } from "./cli";

describe("runCli", () => {
  test("prints help", () => {
    const capture = createOutputCapture();

    expect(runCli(["--help"], { output: capture.output })).toBe(0);
    expect(capture.stdout.join("\n")).toContain("sdlc-kit");
    expect(capture.stdout.join("\n")).toContain("doctor     Validate the local SDLC contract");
    expect(capture.stderr).toEqual([]);
  });

  test("prints package version", () => {
    const capture = createOutputCapture();

    expect(runCli(["--version"], { output: capture.output })).toBe(0);
    expect(capture.stdout).toEqual([`${cliPackage.name} ${cliPackage.version}`]);
    expect(capture.stderr).toEqual([]);
  });

  test("reports unknown commands", () => {
    const capture = createOutputCapture();

    expect(runCli(["missing"], { output: capture.output })).toBe(1);
    expect(capture.stderr).toEqual([
      "Unknown command: missing",
      "Run `sdlc --help` for available commands.",
    ]);
  });

  test("keeps planned commands visible without pretending they are implemented", () => {
    const capture = createOutputCapture();

    expect(runCli(["init", "--preset", "full"], { output: capture.output })).toBe(1);
    expect(capture.stdout).toEqual([]);
    expect(capture.stderr).toEqual([
      "sdlc init: planned command, not implemented yet.\nargs: --preset full",
    ]);
  });

  test("loads a project contract for doctor", () => {
    const projectRoot = createProjectFixture();
    const capture = createOutputCapture();

    expect(runCli(["doctor"], { cwd: projectRoot, output: capture.output })).toBe(0);
    expect(capture.stdout[0]).toContain(".sdlc/project.yml");
    expect(capture.stdout[1]).toBe("project: fixture");
    expect(capture.stderr).toEqual([]);
  });

  test("returns a useful doctor error when no project contract exists", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-empty-"));
    const capture = createOutputCapture();

    expect(runCli(["doctor"], { cwd: projectRoot, output: capture.output })).toBe(1);
    expect(capture.stderr[0]).toContain("No .sdlc/project.yml found from");
    expect(capture.stderr[0]).toContain("Run `sdlc init` or `sdlc adopt` first.");
  });
});

function createOutputCapture(): {
  stdout: string[];
  stderr: string[];
  output: { stdout(message: string): void; stderr(message: string): void };
} {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    stdout,
    stderr,
    output: {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    },
  };
}

function createProjectFixture(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-project-"));
  mkdirSync(join(projectRoot, ".sdlc"));
  writeFileSync(
    join(projectRoot, ".sdlc", "project.yml"),
    `version: 1
project: fixture
tracker:
  provider: github
`,
  );
  return projectRoot;
}
