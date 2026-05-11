import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

    expect(runCli(["blueprint", "123"], { output: capture.output })).toBe(1);
    expect(capture.stdout).toEqual([]);
    expect(capture.stderr).toEqual([
      "sdlc blueprint: planned command, not implemented yet.\nargs: 123",
    ]);
  });

  test("loads a project contract for doctor", () => {
    const projectRoot = createProjectFixture();
    const capture = createOutputCapture();

    expect(runCli(["doctor"], { cwd: projectRoot, output: capture.output })).toBe(0);
    expect(capture.stdout[0]).toContain(".sdlc/project.yml");
    expect(capture.stdout[0]).toContain("project: fixture");
    expect(capture.stdout[0]).toContain("commands:");
    expect(capture.stderr).toEqual([]);
  });

  test("returns a useful doctor error when no project contract exists", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-empty-"));
    const capture = createOutputCapture();

    expect(runCli(["doctor"], { cwd: projectRoot, output: capture.output })).toBe(1);
    expect(capture.stderr[0]).toContain("No .sdlc/project.yml found from");
    expect(capture.stderr[0]).toContain("Run `sdlc init` or `sdlc adopt` first.");
  });

  test("init writes new-project artifacts", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-init-"));
    const capture = createOutputCapture();

    expect(
      runCli(["init", "--preset", "library", "--project", "demo"], {
        cwd: projectRoot,
        output: capture.output,
      }),
    ).toBe(0);

    expect(capture.stdout[0]).toContain("sdlc init: wrote 13 files");
    expect(existsSync(join(projectRoot, ".sdlc", "project.yml"))).toBe(true);
    expect(readFileSync(join(projectRoot, ".sdlc", "project.yml"), "utf8")).toContain("project: demo");
  });

  test("init refuses to overwrite existing artifacts", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-init-"));
    const first = createOutputCapture();
    const second = createOutputCapture();

    expect(runCli(["init", "--project", "demo"], { cwd: projectRoot, output: first.output })).toBe(0);
    expect(runCli(["init", "--project", "demo"], { cwd: projectRoot, output: second.output })).toBe(1);
    expect(second.stderr[0]).toContain("Refusing to overwrite .sdlc/project.yml");
  });

  test("adopt reports missing files without writing", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-adopt-"));
    const capture = createOutputCapture();

    expect(
      runCli(["adopt", "--preset", "local-only", "--project", "demo"], {
        cwd: projectRoot,
        output: capture.output,
      }),
    ).toBe(0);

    expect(capture.stdout[0]).toContain("sdlc adopt: report only");
    expect(capture.stdout[0]).toContain("No files written.");
    expect(existsSync(join(projectRoot, ".sdlc", "project.yml"))).toBe(false);
  });

  test("adopt apply writes missing files without overwriting existing files", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-adopt-"));
    mkdirSync(join(projectRoot, ".sdlc"));
    writeFileSync(join(projectRoot, ".sdlc", "project.yml"), "version: 1\nproject: existing\n");
    const capture = createOutputCapture();

    expect(
      runCli(["adopt", "--project", "demo", "--apply"], {
        cwd: projectRoot,
        output: capture.output,
      }),
    ).toBe(0);

    expect(capture.stdout[0]).toContain("sdlc adopt --apply: wrote 12 files");
    expect(capture.stdout[0]).toContain("preserved existing files: 1");
    expect(readFileSync(join(projectRoot, ".sdlc", "project.yml"), "utf8")).toContain("project: existing");
    expect(existsSync(join(projectRoot, ".github", "pull_request_template.md"))).toBe(true);
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
commands:
  check: bun run check
  test: bun test
`,
  );
  return projectRoot;
}
