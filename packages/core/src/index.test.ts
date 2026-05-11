import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import { findProjectRoot, loadProjectConfig, validateProjectConfig } from "./index";

describe("validateProjectConfig", () => {
  test("accepts the v1 project contract", () => {
    expect(
      validateProjectConfig({
        version: 1,
        project: "example",
        tracker: { provider: "github" },
        preview: { provider: "vercel" },
        local: { provider: "portless" },
        docs: {
          current_state: "docs/current-state.md",
          capabilities_dir: "docs/capabilities",
        },
        production: {
          required_before_issue_close: true,
          smoke_paths: ["/", "/health"],
        },
        commands: {
          test: "bun test",
        },
      }),
    ).toMatchObject({ version: 1, project: "example" });
  });

  test("rejects invalid providers", () => {
    expect(() =>
      validateProjectConfig({
        version: 1,
        project: "example",
        tracker: { provider: "jira" },
      }),
    ).toThrow("tracker.provider must be one of");
  });

  test("rejects missing required fields", () => {
    expect(() => validateProjectConfig({ version: 1 })).toThrow(
      ".sdlc/project.yml must set a non-empty `project`.",
    );
  });

  test("rejects unsupported keys", () => {
    expect(() =>
      validateProjectConfig({
        version: 1,
        project: "example",
        typo: true,
      }),
    ).toThrow("root contains unsupported key `typo`.");
  });

  test("rejects invalid command values", () => {
    expect(() =>
      validateProjectConfig({
        version: 1,
        project: "example",
        commands: {
          test: "",
        },
      }),
    ).toThrow("commands.test must be a non-empty string.");
  });
});

describe("project discovery and loading", () => {
  test("finds a project root from nested directories", () => {
    const projectRoot = createProjectFixture();
    const nestedDir = join(projectRoot, "apps", "web", "src");
    mkdirSync(nestedDir, { recursive: true });

    expect(findProjectRoot(nestedDir)).toBe(projectRoot);
  });

  test("finds a project root from a file path", () => {
    const projectRoot = createProjectFixture();
    const filePath = join(projectRoot, "packages", "cli", "src", "index.ts");
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, "");

    expect(findProjectRoot(filePath)).toBe(projectRoot);
  });

  test("loads a manifest from a nested path with normalized project paths", () => {
    const projectRoot = createProjectFixture();
    const nestedDir = join(projectRoot, "packages", "core");
    mkdirSync(nestedDir, { recursive: true });

    const result = loadProjectConfig(nestedDir);

    expect(result.projectRoot).toBe(projectRoot);
    expect(result.configPath).toBe(join(projectRoot, ".sdlc", "project.yml"));
    expect(result.config.project).toBe("fixture");
    expect(result.paths.currentState).toBe(resolve(projectRoot, "docs/current-state.md"));
    expect(result.paths.capabilitiesDir).toBe(resolve(projectRoot, "docs/capabilities"));
    expect(result.paths.plansDir).toBe(resolve(projectRoot, "docs/plans"));
    expect(result.paths.worktreesRoot).toBe(resolve(projectRoot, "../fixture-worktrees"));
  });

  test("returns an actionable error for a missing manifest", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-empty-"));

    expect(() => loadProjectConfig(projectRoot)).toThrow(
      `No .sdlc/project.yml found from ${projectRoot}`,
    );
  });

  test("returns an actionable error for invalid YAML", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-invalid-"));
    mkdirSync(join(projectRoot, ".sdlc"));
    writeFileSync(join(projectRoot, ".sdlc", "project.yml"), "version: 1\nproject: [");

    expect(() => loadProjectConfig(projectRoot)).toThrow("Failed to parse");
  });
});

function createProjectFixture(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-project-"));
  mkdirSync(join(projectRoot, ".sdlc"));
  writeFileSync(
    join(projectRoot, ".sdlc", "project.yml"),
    `version: 1
project: fixture
base_branch: main

tracker:
  provider: github

docs:
  current_state: docs/current-state.md
  capabilities_dir: docs/capabilities
  plans_dir: docs/plans

worktrees:
  root: ../fixture-worktrees
  branch_prefix: codex

local:
  provider: portless
  route_pattern: issue-{issue}.fixture.localhost
  required_before_push: true

preview:
  provider: vercel
  required_before_merge: true
  environment: preview
  require_preview_secrets: false

production:
  required_before_issue_close: true
  smoke_paths:
    - /
    - /health

commands:
  check: bun run check
  test: bun test
`,
  );
  return projectRoot;
}
