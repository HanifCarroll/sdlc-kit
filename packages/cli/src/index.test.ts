import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, test } from "bun:test";
import type {
  GitHubCommandOptions,
  GitHubCommandResult,
  GitHubCommandRunner,
} from "@sdlc-kit/github-adapter";
import { BLUEPRINT_COMMENT_MARKER } from "@sdlc-kit/github-adapter";
import type {
  PortlessCommandOptions,
  PortlessCommandResult,
  PortlessCommandRunner,
} from "@sdlc-kit/portless-adapter";
import {
  cliPackage,
  runCli,
  type GitCommandOptions,
  type GitCommandResult,
  type GitCommandRunner,
} from "./cli";

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

    expect(runCli(["closeout", "123"], { output: capture.output })).toBe(1);
    expect(capture.stdout).toEqual([]);
    expect(capture.stderr).toEqual([
      "sdlc closeout: planned command, not implemented yet.\nargs: 123",
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

  test("doctor does not warn for a worktree root when run inside a linked worktree", () => {
    const projectRoot = createLinkedWorktreeFixture();
    const capture = createOutputCapture();

    expect(runCli(["doctor"], { cwd: projectRoot, output: capture.output })).toBe(0);
    expect(capture.stdout[0]).not.toContain("worktrees.root does not exist yet");
    expect(capture.stderr).toEqual([]);
  });

  test("doctor still warns for a genuinely missing worktree root", () => {
    const projectRoot = createMissingWorktreeRootFixture();
    const capture = createOutputCapture();

    expect(runCli(["doctor"], { cwd: projectRoot, output: capture.output })).toBe(0);
    expect(capture.stdout[0]).toContain("worktrees.root does not exist yet");
    expect(capture.stderr).toEqual([]);
  });

  test("returns a useful doctor error when no project contract exists", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-empty-"));
    const capture = createOutputCapture();

    expect(runCli(["doctor"], { cwd: projectRoot, output: capture.output })).toBe(1);
    expect(capture.stderr[0]).toContain("No .sdlc/project.yml found from");
    expect(capture.stderr[0]).toContain("Run `sdlc init` or `sdlc adopt` first.");
  });

  test("doctor warns when Vercel preview checks point at production", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-vercel-preview-"));
    mkdirSync(join(projectRoot, ".sdlc"));
    writeFileSync(
      join(projectRoot, ".sdlc", "project.yml"),
      `version: 1
project: fixture
preview:
  provider: vercel
  required_before_merge: true
  environment: production
  require_preview_secrets: true
`,
    );
    const capture = createOutputCapture();

    expect(runCli(["doctor"], { cwd: projectRoot, output: capture.output })).toBe(0);
    expect(capture.stdout[0]).toContain(
      "vercel preview checks are configured for the production environment",
    );
  });

  test("doctor warns when Cloudflare preview binding separation is not confirmed", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-cloudflare-preview-"));
    mkdirSync(join(projectRoot, ".sdlc"));
    writeFileSync(
      join(projectRoot, ".sdlc", "project.yml"),
      `version: 1
project: fixture
preview:
  provider: cloudflare
  required_before_merge: true
  environment: production
  require_preview_secrets: false
`,
    );
    const capture = createOutputCapture();

    expect(runCli(["doctor"], { cwd: projectRoot, output: capture.output })).toBe(0);
    expect(capture.stdout[0]).toContain(
      "cloudflare preview checks are configured for the production environment",
    );
    expect(capture.stdout[0]).toContain(
      "cloudflare preview checks require explicit preview/prod binding separation confirmation",
    );
    expect(capture.stdout[0]).not.toContain(
      "preview is required before merge but preview secret/binding confirmation is not required",
    );
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

    expect(capture.stdout[0]).toContain("sdlc init: wrote 14 files");
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

    expect(capture.stdout[0]).toContain("sdlc adopt --apply: wrote 13 files");
    expect(capture.stdout[0]).toContain("preserved existing files: 1");
    expect(readFileSync(join(projectRoot, ".sdlc", "project.yml"), "utf8")).toContain("project: existing");
    expect(existsSync(join(projectRoot, ".github", "pull_request_template.md"))).toBe(true);
  });

  test("blueprint writes a local issue plan without syncing by default", () => {
    const projectRoot = createProjectFixture();
    const capture = createOutputCapture();
    const githubRunner = createGitHubRunner();

    expect(runCli(["blueprint", "6"], { cwd: projectRoot, output: capture.output, githubRunner })).toBe(0);

    const blueprintPath = join(projectRoot, ".sdlc", "blueprints", "issue-6.md");
    expect(existsSync(blueprintPath)).toBe(true);
    expect(readFileSync(blueprintPath, "utf8")).toContain("# Blueprint: #6 Blueprint handling");
    expect(readFileSync(join(projectRoot, ".sdlc", "blueprints", ".gitignore"), "utf8")).toContain("*.md");
    expect(capture.stdout[0]).toContain("github: skipped");
    expect(githubRunner.calls.some((call) => call.args.join(" ") === "issue comment 6 --body-file -")).toBe(false);
  });

  test("blueprint sync posts the generated payload through the GitHub adapter", () => {
    const projectRoot = createProjectFixture();
    const capture = createOutputCapture();
    const githubRunner = createGitHubRunner();

    expect(
      runCli(["blueprint", "6", "--sync"], {
        cwd: projectRoot,
        output: capture.output,
        githubRunner,
      }),
    ).toBe(0);

    const comment = githubRunner.calls.find((call) => call.args.join(" ") === "issue comment 6 --body-file -");
    expect(comment?.options?.input).toContain(BLUEPRINT_COMMENT_MARKER);
    expect(comment?.options?.input).toContain("# Blueprint: #6 Blueprint handling");
    expect(capture.stdout[0]).toContain("github: created blueprint comment");
  });

  test("worktree list formats git worktree output", () => {
    const projectRoot = createProjectFixture();
    const capture = createOutputCapture();
    const gitRunner = createGitRunner([
      gitResult(
        0,
        `worktree ${projectRoot}
HEAD abc123
branch refs/heads/main

worktree ${projectRoot}-worktrees/issue-26-worktree-command
HEAD def456
branch refs/heads/codex/26-worktree-command
`,
      ),
    ]);

    expect(runCli(["worktree", "list"], { cwd: projectRoot, output: capture.output, gitRunner })).toBe(0);
    expect(capture.stdout[0]).toContain("sdlc worktree list:");
    expect(capture.stdout[0]).toContain(`- main: ${projectRoot}`);
    expect(capture.stdout[0]).toContain("- codex/26-worktree-command:");
    expect(gitRunner.calls.map((call) => call.args)).toEqual([
      ["worktree", "list", "--porcelain"],
    ]);
  });

  test("worktree start dry run plans deterministic branch and path", () => {
    const projectRoot = createWorktreeProjectFixture();
    const capture = createOutputCapture();
    const githubRunner = createGitHubRunner({ number: 26, title: "Implement sdlc worktree command" });
    const gitRunner = createGitRunner([]);

    expect(
      runCli(["worktree", "start", "26", "--dry-run"], {
        cwd: projectRoot,
        output: capture.output,
        githubRunner,
        gitRunner,
      }),
    ).toBe(0);

    expect(capture.stdout[0]).toContain("sdlc worktree start: dry run");
    expect(capture.stdout[0]).toContain("branch: codex/26-implement-sdlc-worktree-command");
    expect(capture.stdout[0]).toContain("path:");
    expect(capture.stdout[0]).toContain("issue-26-implement-sdlc-worktree-command");
    expect(gitRunner.calls).toEqual([]);
  });

  test("worktree start creates a branch worktree from the configured base branch", () => {
    const projectRoot = createWorktreeProjectFixture();
    const capture = createOutputCapture();
    const githubRunner = createGitHubRunner({ number: 26, title: "Implement sdlc worktree command" });
    const gitRunner = createGitRunner([
      gitResult(1, "", "branch missing"),
      gitResult(0, "created"),
    ]);

    expect(
      runCli(["worktree", "start", "26"], {
        cwd: projectRoot,
        output: capture.output,
        githubRunner,
        gitRunner,
      }),
    ).toBe(0);

    expect(capture.stdout[0]).toContain("sdlc worktree start: created");
    expect(gitRunner.calls.map((call) => call.args)).toEqual([
      ["rev-parse", "--verify", "codex/26-implement-sdlc-worktree-command"],
      [
        "worktree",
        "add",
        "-b",
        "codex/26-implement-sdlc-worktree-command",
        `${projectRoot}-worktrees/issue-26-implement-sdlc-worktree-command`,
        "main",
      ],
    ]);
  });

  test("route list skips projects without local routes configured", () => {
    const projectRoot = createProjectFixture();
    const capture = createOutputCapture();

    expect(runCli(["route", "list"], { cwd: projectRoot, output: capture.output })).toBe(0);
    expect(capture.stdout[0]).toContain("local routes are not configured");
    expect(capture.stderr).toEqual([]);
  });

  test("route ensure registers an owned Portless route", () => {
    const projectRoot = createPortlessProjectFixture();
    const capture = createOutputCapture();
    const portlessRunner = createPortlessRunner([
      portlessResult("[]"),
      portlessResult("registered"),
    ]);

    expect(
      runCli(["route", "ensure", "--issue", "9", "--port", "4321"], {
        cwd: projectRoot,
        output: capture.output,
        portlessRunner,
      }),
    ).toBe(0);

    expect(capture.stdout[0]).toContain("Created Portless route https://fixture-issue-9.localhost -> 4321");
    expect(portlessRunner.calls.map((call) => call.args)).toEqual([
      ["list"],
      ["alias", "fixture-issue-9", "4321"],
    ]);
    expect(JSON.parse(readFileSync(join(projectRoot, ".sdlc", "routes.local.json"), "utf8")).routes).toHaveLength(1);
  });

  test("route ensure reports port conflicts as command failures", () => {
    const projectRoot = createPortlessProjectFixture();
    const capture = createOutputCapture();
    const portlessRunner = createPortlessRunner([
      portlessResult(JSON.stringify({ routes: [{ name: "fixture-issue-9", port: 3000 }] })),
    ]);

    expect(
      runCli(["route", "ensure", "--issue=9", "--port=4321"], {
        cwd: projectRoot,
        output: capture.output,
        portlessRunner,
      }),
    ).toBe(1);

    expect(capture.stdout[0]).toContain("already points at port 3000");
    expect(capture.stdout[0]).toContain("pass --force");
    expect(capture.stderr).toEqual([]);
  });

  test("drift reports mapped source changes without docs in warn mode", () => {
    const projectRoot = createDriftProjectFixture("warn");
    const capture = createOutputCapture();

    expect(
      runCli(["drift", "--changed", "src/routes/login.ts"], {
        cwd: projectRoot,
        output: capture.output,
      }),
    ).toBe(0);

    expect(capture.stdout[0]).toContain("sdlc drift: warning");
    expect(capture.stdout[0]).toContain("missing-doc-ack");
    expect(capture.stderr).toEqual([]);
  });

  test("drift can fail CI on warnings when requested", () => {
    const projectRoot = createDriftProjectFixture("warn");
    const capture = createOutputCapture();

    expect(
      runCli(["drift", "--changed=src/routes/login.ts", "--fail-on-warn"], {
        cwd: projectRoot,
        output: capture.output,
      }),
    ).toBe(1);

    expect(capture.stdout[0]).toContain("sdlc drift: warning");
  });

  test("drift accepts no-doc-impact reasons and json output", () => {
    const projectRoot = createDriftProjectFixture("error");
    const capture = createOutputCapture();

    expect(
      runCli(
        [
          "drift",
          "--changed",
          "src/routes/login.ts",
          "--no-doc-impact",
          "Internal rename only; no behavior or docs contract changed.",
          "--json",
        ],
        {
          cwd: projectRoot,
          output: capture.output,
        },
      ),
    ).toBe(0);

    const json = capture.stdout[0];
    expect(json).toBeDefined();
    expect(JSON.parse(json ?? "")).toMatchObject({
      status: "pass",
      mode: "error",
    });
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

function createWorktreeProjectFixture(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-worktree-project-"));
  mkdirSync(join(projectRoot, ".sdlc"));
  writeFileSync(
    join(projectRoot, ".sdlc", "project.yml"),
    `version: 1
project: fixture
base_branch: main
tracker:
  provider: github
worktrees:
  root: ../${basename(projectRoot)}-worktrees
  branch_prefix: codex
commands:
  check: bun run check
`,
  );
  return projectRoot;
}

function createMissingWorktreeRootFixture(): string {
  return createWorktreeRootFixture(mkdtempSync(join(tmpdir(), "sdlc-kit-missing-worktree-root-")));
}

function createLinkedWorktreeFixture(): string {
  const tempRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-linked-"));
  const worktreesRoot = join(tempRoot, "fixture-worktrees");
  return createWorktreeRootFixture(join(worktreesRoot, "issue-23-linked-worktree"));
}

function createWorktreeRootFixture(projectRoot: string): string {
  mkdirSync(join(projectRoot, ".sdlc"), { recursive: true });
  writeFileSync(
    join(projectRoot, ".sdlc", "project.yml"),
    `version: 1
project: fixture
worktrees:
  root: ../fixture-worktrees
commands:
  check: bun run check
`,
  );
  return projectRoot;
}

function createPortlessProjectFixture(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-portless-project-"));
  mkdirSync(join(projectRoot, ".sdlc"));
  writeFileSync(
    join(projectRoot, ".sdlc", "project.yml"),
    `version: 1
project: fixture
local:
  provider: portless
  route_pattern: fixture-issue-{issue}.localhost
  required_before_push: true
commands:
  check: bun run check
  test: bun test
`,
  );
  return projectRoot;
}

function createDriftProjectFixture(mode: "warn" | "error"): string {
  const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-drift-project-"));
  mkdirSync(join(projectRoot, ".sdlc"));
  writeFileSync(
    join(projectRoot, ".sdlc", "project.yml"),
    `version: 1
project: fixture
drift:
  mode: ${mode}
  mappings:
    - source_paths:
        - src/routes/**
      docs:
        - docs/capabilities/auth.md
`,
  );
  return projectRoot;
}

interface MockGitHubRunner extends GitHubCommandRunner {
  calls: Array<{ args: string[]; options?: GitHubCommandOptions }>;
}

function createGitHubRunner(issue: { number: number; title: string } = { number: 6, title: "Blueprint handling" }): MockGitHubRunner {
  const calls: MockGitHubRunner["calls"] = [];

  return {
    calls,
    run(args, options) {
      calls.push(options === undefined ? { args } : { args, options });

      if (args[0] === "--version") {
        return githubResult(0, "gh version 2.0.0");
      }
      if (args[0] === "auth" && args[1] === "status") {
        return githubResult(0, "Logged in");
      }
      if (args[0] === "issue" && args[1] === "view") {
        return githubResult(
          0,
          JSON.stringify({
            number: issue.number,
            title: issue.title,
            state: "OPEN",
            body: "Acceptance criteria",
            url: `https://github.com/acme/example/issues/${issue.number}`,
            labels: [{ name: "type:feature" }, { name: "area:core" }],
            comments: [],
            closedByPullRequestsReferences: [],
          }),
        );
      }

      return githubResult(0, "{}");
    },
  };
}

function githubResult(exitCode: number, stdout = "", stderr = ""): GitHubCommandResult {
  return { exitCode, stdout, stderr };
}

interface MockGitRunner extends GitCommandRunner {
  calls: Array<{ args: string[]; options?: GitCommandOptions }>;
}

function createGitRunner(results: GitCommandResult[]): MockGitRunner {
  const calls: MockGitRunner["calls"] = [];

  return {
    calls,
    run(args, options) {
      calls.push(options === undefined ? { args } : { args, options });
      return results.shift() ?? gitResult(0, "");
    },
  };
}

function gitResult(exitCode: number, stdout = "", stderr = ""): GitCommandResult {
  return { exitCode, stdout, stderr };
}

interface MockPortlessRunner extends PortlessCommandRunner {
  calls: Array<{ args: string[]; options?: PortlessCommandOptions }>;
}

function createPortlessRunner(results: PortlessCommandResult[]): MockPortlessRunner {
  const calls: MockPortlessRunner["calls"] = [];

  return {
    calls,
    run(args, options) {
      calls.push(options === undefined ? { args } : { args, options });
      return results.shift() ?? portlessResult("");
    },
  };
}

function portlessResult(stdout = "", stderr = "", exitCode = 0): PortlessCommandResult {
  return { exitCode, stdout, stderr };
}
