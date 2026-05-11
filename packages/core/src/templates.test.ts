import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import YAML from "yaml";
import {
  planTemplateWrites,
  presetNames,
  renderPreset,
  writeTemplateFiles,
  type PresetName,
} from "./templates";

const expectedFileSetSnapshot = [
  ".sdlc/project.yml",
  ".sdlc/blueprints/.gitignore",
  ".sdlc/blueprints/README.md",
  ".sdlc/qa/.gitignore",
  ".sdlc/qa/README.md",
  "docs/constitution.md",
  "docs/current-state.md",
  "docs/capabilities/README.md",
  "docs/capabilities/_template.md",
  "docs/plans/README.md",
  "docs/adr/README.md",
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/feature.yml",
  ".github/ISSUE_TEMPLATE/task.yml",
  ".github/pull_request_template.md",
  ".github/workflows/sdlc-drift.yml",
];

describe("template presets", () => {
  test("renders the expected generated file set for every preset", () => {
    const snapshots = Object.fromEntries(
      presetNames.map((preset) => [
        preset,
        renderPreset({ preset, project: "example" }).map((file) => file.path),
      ]),
    );

    expect(snapshots).toEqual(
      Object.fromEntries(presetNames.map((preset) => [preset, expectedFileSetSnapshot])),
    );
  });

  test("renders preset-specific manifest settings", () => {
    const snapshots = Object.fromEntries(
      presetNames.map((preset) => {
        const manifest = readManifestSnapshot(preset);
        return [
          preset,
          {
            tracker: manifest.tracker?.provider,
            local: manifest.local?.provider,
            localRequired: manifest.local?.required_before_push,
            preview: manifest.preview?.provider,
            previewRequired: manifest.preview?.required_before_merge,
            productionRequired: manifest.production?.required_before_issue_close,
            driftMode: manifest.drift?.mode,
          },
        ];
      }),
    );

    expect(snapshots).toEqual({
      full: {
        tracker: "github",
        local: "portless",
        localRequired: false,
        preview: "vercel",
        previewRequired: true,
        productionRequired: true,
        driftMode: "warn",
      },
      hanif: {
        tracker: "github",
        local: "portless",
        localRequired: true,
        preview: "vercel",
        previewRequired: true,
        productionRequired: true,
        driftMode: "warn",
      },
      "github-vercel": {
        tracker: "github",
        local: "none",
        localRequired: false,
        preview: "vercel",
        previewRequired: true,
        productionRequired: true,
        driftMode: "warn",
      },
      "github-cloudflare": {
        tracker: "github",
        local: "none",
        localRequired: false,
        preview: "cloudflare",
        previewRequired: true,
        productionRequired: true,
        driftMode: "warn",
      },
      "local-only": {
        tracker: "none",
        local: "portless",
        localRequired: true,
        preview: "none",
        previewRequired: false,
        productionRequired: false,
        driftMode: "warn",
      },
      library: {
        tracker: "github",
        local: "none",
        localRequired: false,
        preview: "none",
        previewRequired: false,
        productionRequired: false,
        driftMode: "warn",
      },
    });
  });

  test("renders package-manager-specific drift workflow commands", () => {
    const bunWorkflow = readTemplateFile(
      renderPreset({ preset: "full", project: "example", packageManager: "bun" }),
      ".github/workflows/sdlc-drift.yml",
    );
    const pnpmWorkflow = readTemplateFile(
      renderPreset({ preset: "full", project: "example", packageManager: "pnpm" }),
      ".github/workflows/sdlc-drift.yml",
    );
    const npmWorkflow = readTemplateFile(
      renderPreset({ preset: "full", project: "example", packageManager: "npm" }),
      ".github/workflows/sdlc-drift.yml",
    );

    expect(bunWorkflow).toContain("uses: oven-sh/setup-bun@v2");
    expect(bunWorkflow).toContain("output=$(bunx sdlc-kit drift 2>&1)");
    expect(pnpmWorkflow).toContain("run: corepack enable");
    expect(pnpmWorkflow).toContain("output=$(pnpm dlx sdlc-kit drift 2>&1)");
    expect(npmWorkflow).toContain("output=$(npx --yes sdlc-kit drift 2>&1)");
    expect(pnpmWorkflow).toContain("skipping drift check");
    expect(npmWorkflow).not.toContain("setup-bun");
  });

  test("refuses to overwrite existing files unless explicitly approved", () => {
    const targetRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-template-"));
    const files = renderPreset({ preset: "full", project: "example" });
    writeTemplateFiles(targetRoot, files);

    expect(() => planTemplateWrites(targetRoot, files)).toThrow(
      "Refusing to overwrite .sdlc/project.yml",
    );

    expect(planTemplateWrites(targetRoot, files, { overwrite: true })[0]).toMatchObject({
      path: ".sdlc/project.yml",
      action: "overwrite",
    });
  });

  test("writes generated files into nested directories", () => {
    const targetRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-template-"));
    const plan = writeTemplateFiles(targetRoot, renderPreset({ preset: "library", project: "library" }));

    expect(plan).toHaveLength(expectedFileSetSnapshot.length);
    expect(existsSync(join(targetRoot, ".github", "pull_request_template.md"))).toBe(true);
    expect(readFileSync(join(targetRoot, ".sdlc", "project.yml"), "utf8")).toContain("project: library");
  });

  test("rejects template paths that escape the target root", () => {
    const targetRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-template-"));

    expect(() =>
      planTemplateWrites(targetRoot, [{ path: "../escape.md", content: "" }]),
    ).toThrow("Template path must be repo-relative");
  });
});

function readManifestSnapshot(preset: PresetName): {
  tracker?: { provider?: string };
  local?: { provider?: string; required_before_push?: boolean };
  preview?: { provider?: string; required_before_merge?: boolean };
  production?: { required_before_issue_close?: boolean };
  drift?: { mode?: string };
} {
  const file = renderPreset({ preset, project: "example" }).find(
    (candidate) => candidate.path === ".sdlc/project.yml",
  );
  if (!file) {
    throw new Error(`Missing manifest for ${preset}`);
  }
  return YAML.parse(file.content) as {
    tracker?: { provider?: string };
    local?: { provider?: string; required_before_push?: boolean };
    preview?: { provider?: string; required_before_merge?: boolean };
    production?: { required_before_issue_close?: boolean };
    drift?: { mode?: string };
  };
}

function readTemplateFile(files: Array<{ path: string; content: string }>, path: string): string {
  const file = files.find((candidate) => candidate.path === path);
  if (!file) {
    throw new Error(`Missing template file: ${path}`);
  }
  return file.content;
}
