import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import YAML from "yaml";
import type { ProviderName, SdlcProjectConfig } from "./index";

export const presetNames = [
  "full",
  "hanif",
  "github-vercel",
  "github-cloudflare",
  "local-only",
  "library",
] as const;

export type PresetName = (typeof presetNames)[number];

export interface RenderPresetOptions {
  preset: PresetName;
  project: string;
  baseBranch?: string;
  packageManager?: "bun" | "npm" | "pnpm";
}

export interface TemplateFile {
  path: string;
  content: string;
}

export interface TemplateWriteOptions {
  overwrite?: boolean;
}

export interface TemplateWritePlan {
  path: string;
  targetPath: string;
  action: "create" | "overwrite";
}

export interface TemplateFileInspection {
  path: string;
  targetPath: string;
  state: "missing" | "exists";
}

interface PresetDefinition {
  trackerProvider: ProviderName;
  localProvider: ProviderName;
  localRequiredBeforePush: boolean;
  previewProvider: ProviderName;
  previewRequiredBeforeMerge: boolean;
  previewRequiresSecrets: boolean;
  productionRequiredBeforeClose: boolean;
}

const presetDefinitions: Record<PresetName, PresetDefinition> = {
  full: {
    trackerProvider: "github",
    localProvider: "portless",
    localRequiredBeforePush: false,
    previewProvider: "vercel",
    previewRequiredBeforeMerge: true,
    previewRequiresSecrets: true,
    productionRequiredBeforeClose: true,
  },
  hanif: {
    trackerProvider: "github",
    localProvider: "portless",
    localRequiredBeforePush: true,
    previewProvider: "vercel",
    previewRequiredBeforeMerge: true,
    previewRequiresSecrets: true,
    productionRequiredBeforeClose: true,
  },
  "github-vercel": {
    trackerProvider: "github",
    localProvider: "none",
    localRequiredBeforePush: false,
    previewProvider: "vercel",
    previewRequiredBeforeMerge: true,
    previewRequiresSecrets: true,
    productionRequiredBeforeClose: true,
  },
  "github-cloudflare": {
    trackerProvider: "github",
    localProvider: "none",
    localRequiredBeforePush: false,
    previewProvider: "cloudflare",
    previewRequiredBeforeMerge: true,
    previewRequiresSecrets: true,
    productionRequiredBeforeClose: true,
  },
  "local-only": {
    trackerProvider: "none",
    localProvider: "portless",
    localRequiredBeforePush: true,
    previewProvider: "none",
    previewRequiredBeforeMerge: false,
    previewRequiresSecrets: false,
    productionRequiredBeforeClose: false,
  },
  library: {
    trackerProvider: "github",
    localProvider: "none",
    localRequiredBeforePush: false,
    previewProvider: "none",
    previewRequiredBeforeMerge: false,
    previewRequiresSecrets: false,
    productionRequiredBeforeClose: false,
  },
};

export function renderPreset(options: RenderPresetOptions): TemplateFile[] {
  const project = options.project.trim();
  if (project === "") {
    throw new Error("Template project name must be a non-empty string.");
  }

  const definition = getPresetDefinition(options.preset);
  const packageManager = options.packageManager ?? "bun";
  const baseBranch = options.baseBranch ?? "main";

  return [
    templateFile(".sdlc/project.yml", renderProjectManifest(project, baseBranch, definition, packageManager)),
    templateFile(".sdlc/blueprints/.gitignore", blueprintsGitignore()),
    templateFile(".sdlc/blueprints/README.md", blueprintsReadme()),
    templateFile("docs/constitution.md", constitutionDoc(project)),
    templateFile("docs/current-state.md", currentStateDoc(project)),
    templateFile("docs/capabilities/README.md", capabilitiesReadme()),
    templateFile("docs/capabilities/_template.md", capabilityTemplate()),
    templateFile("docs/plans/README.md", plansReadme()),
    templateFile("docs/adr/README.md", adrReadme()),
    templateFile(".github/ISSUE_TEMPLATE/bug.yml", bugIssueTemplate()),
    templateFile(".github/ISSUE_TEMPLATE/feature.yml", featureIssueTemplate()),
    templateFile(".github/ISSUE_TEMPLATE/task.yml", taskIssueTemplate()),
    templateFile(".github/pull_request_template.md", pullRequestTemplate()),
    templateFile(".github/workflows/sdlc-drift.yml", driftWorkflow()),
  ];
}

export function isPresetName(value: string): value is PresetName {
  return presetNames.includes(value as PresetName);
}

export function inspectTemplateFiles(targetRoot: string, files: TemplateFile[]): TemplateFileInspection[] {
  return files.map((file) => {
    const targetPath = resolveTemplateTarget(targetRoot, file.path);
    return {
      path: file.path,
      targetPath,
      state: existsSync(targetPath) ? "exists" : "missing",
    };
  });
}

export function planTemplateWrites(
  targetRoot: string,
  files: TemplateFile[],
  options: TemplateWriteOptions = {},
): TemplateWritePlan[] {
  return inspectTemplateFiles(targetRoot, files).map((file) => {
    const exists = file.state === "exists";

    if (exists && !options.overwrite) {
      throw new Error(`Refusing to overwrite ${file.path}. Pass overwrite: true to replace existing files.`);
    }

    return {
      path: file.path,
      targetPath: file.targetPath,
      action: exists ? "overwrite" : "create",
    };
  });
}

export function writeTemplateFiles(
  targetRoot: string,
  files: TemplateFile[],
  options: TemplateWriteOptions = {},
): TemplateWritePlan[] {
  const plan = planTemplateWrites(targetRoot, files, options);

  for (const file of files) {
    const targetPath = resolveTemplateTarget(targetRoot, file.path);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, file.content);
  }

  return plan;
}

function getPresetDefinition(preset: PresetName): PresetDefinition {
  const definition = presetDefinitions[preset];
  if (!definition) {
    throw new Error(`Unknown preset: ${preset}`);
  }
  return definition;
}

function renderProjectManifest(
  project: string,
  baseBranch: string,
  definition: PresetDefinition,
  packageManager: "bun" | "npm" | "pnpm",
): string {
  const manifest: SdlcProjectConfig = {
    version: 1,
    project,
    base_branch: baseBranch,
    tracker: {
      provider: definition.trackerProvider,
    },
    docs: {
      constitution: "docs/constitution.md",
      current_state: "docs/current-state.md",
      capabilities_dir: "docs/capabilities",
      plans_dir: "docs/plans",
      decisions_dir: "docs/adr",
    },
    worktrees: {
      root: `../${project}-worktrees`,
      branch_prefix: "codex",
    },
    local: localConfig(project, definition),
    preview: previewConfig(definition),
    production: productionConfig(definition),
    commands: commandSet(packageManager),
  };

  return YAML.stringify(manifest);
}

function localConfig(project: string, definition: PresetDefinition): NonNullable<SdlcProjectConfig["local"]> {
  if (definition.localProvider === "none") {
    return {
      provider: "none",
      required_before_push: false,
    };
  }

  return {
    provider: definition.localProvider,
    route_pattern: `${project}-issue-{issue}.localhost`,
    required_before_push: definition.localRequiredBeforePush,
  };
}

function previewConfig(definition: PresetDefinition): NonNullable<SdlcProjectConfig["preview"]> {
  if (definition.previewProvider === "none") {
    return {
      provider: "none",
      required_before_merge: false,
      require_preview_secrets: false,
    };
  }

  return {
    provider: definition.previewProvider,
    required_before_merge: definition.previewRequiredBeforeMerge,
    environment: "preview",
    require_preview_secrets: definition.previewRequiresSecrets,
  };
}

function productionConfig(definition: PresetDefinition): NonNullable<SdlcProjectConfig["production"]> {
  if (!definition.productionRequiredBeforeClose) {
    return {
      required_before_issue_close: false,
    };
  }

  return {
    required_before_issue_close: true,
    smoke_paths: ["/"],
  };
}

function commandSet(packageManager: "bun" | "npm" | "pnpm"): Record<string, string> {
  if (packageManager === "npm") {
    return {
      install: "npm install",
      check: "npm run check",
      test: "npm test",
    };
  }

  if (packageManager === "pnpm") {
    return {
      install: "pnpm install",
      check: "pnpm check",
      test: "pnpm test",
    };
  }

  return {
    install: "bun install",
    check: "bun run check",
    test: "bun test",
  };
}

function templateFile(path: string, content: string): TemplateFile {
  return { path, content: content.trimEnd() + "\n" };
}

function resolveTemplateTarget(targetRoot: string, relativePath: string): string {
  if (isAbsolute(relativePath) || relativePath.split(/[\\/]+/).includes("..")) {
    throw new Error(`Template path must be repo-relative: ${relativePath}`);
  }

  const root = resolve(targetRoot);
  const targetPath = resolve(root, relativePath);
  if (targetPath !== root && !targetPath.startsWith(root + sep)) {
    throw new Error(`Template path escapes target root: ${relativePath}`);
  }
  return targetPath;
}

function blueprintsReadme(): string {
  return `# Blueprints

Issue blueprints are tactical execution plans. Keep them local by default and sync the useful summary back to the issue audit trail.

Generated issue blueprints are ignored by default. Commit only README/convention files here unless your team intentionally promotes a blueprint into durable docs.
`;
}

function blueprintsGitignore(): string {
  return `*.md
!README.md
`;
}

function constitutionDoc(project: string): string {
  return `# ${project} Constitution

This file captures non-negotiable engineering principles for this repo.

## Production Ready Means

- The linked issue has clear acceptance criteria.
- Relevant tests, evals, or smoke checks pass.
- Docs that describe changed behavior are updated.
- Risk and rollback notes are captured before merge when the change is risky.

## Human Gates

- Scope approval before broad implementation.
- Review approval before merge.
- Production verification before issue closeout when required by the project manifest.
`;
}

function currentStateDoc(project: string): string {
  return `# ${project} Current State

Describe what the system currently does, ships, limits, and guarantees.

Update this file when user-visible behavior, system guarantees, or known limitations change.
`;
}

function capabilitiesReadme(): string {
  return `# Capabilities

Create one file per major domain. Each capability doc should include current behavior, limitations, source files, tests or evals, related issues, and agent context.
`;
}

function capabilityTemplate(): string {
  return `# Capability: <name>

## Current Behavior

## Limitations

## Source Files

## Tests and Evals

## Related Issues

## Agent Context
`;
}

function plansReadme(): string {
  return `# Plans

Historical plans preserve larger architecture, migration, or release reasoning. Plans may become stale; current-state and capability docs should not.

Every committed plan except README.md and underscore-prefixed templates must start with YAML frontmatter:

\`\`\`yaml
---
status: draft
created: "2026-05-10"
---
\`\`\`

Allowed statuses: draft, active, approved, superseded, archived.
`;
}

function adrReadme(): string {
  return `# ADRs

Durable decisions live here after they become policy.
`;
}

function bugIssueTemplate(): string {
  return `name: Bug
description: Track a defect with reproducible evidence
title: "[Bug]: "
labels: ["type:bug"]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What is broken?
    validations:
      required: true
  - type: textarea
    id: evidence
    attributes:
      label: Evidence
      description: Logs, screenshots, repro steps, or failing tests.
  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance Criteria
      description: What must be true before this closes?
`;
}

function featureIssueTemplate(): string {
  return `name: Feature
description: Track user-facing or workflow capability work
title: "[Feature]: "
labels: ["type:feature"]
body:
  - type: textarea
    id: outcome
    attributes:
      label: Desired Outcome
      description: What should exist when this is done?
    validations:
      required: true
  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance Criteria
      description: Observable conditions for completion.
    validations:
      required: true
  - type: textarea
    id: proof
    attributes:
      label: Required Proof
      description: Tests, evals, preview QA, production smoke, or docs updates.
`;
}

function taskIssueTemplate(): string {
  return `name: Task
description: Track maintenance, infrastructure, documentation, or follow-up work
title: "[Task]: "
labels: ["type:task"]
body:
  - type: textarea
    id: scope
    attributes:
      label: Scope
      description: What should change?
    validations:
      required: true
  - type: textarea
    id: verification
    attributes:
      label: Verification
      description: Commands or checks that prove the work.
`;
}

function pullRequestTemplate(): string {
  return `## Summary

- 

## Linked Issue

Refs #

## Verification

- [ ] Tests/checks run and listed
- [ ] Docs updated or no docs impact
- [ ] Local/preview QA captured when required

## Closeout Notes

Production verification is required before closing the linked issue when .sdlc/project.yml requires it.
`;
}

function driftWorkflow(): string {
  return `name: SDLC Drift

on:
  pull_request:
  workflow_dispatch:

jobs:
  drift:
    name: Drift placeholder
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Report drift check placeholder
        run: echo "sdlc drift checks are not wired yet"
`;
}
