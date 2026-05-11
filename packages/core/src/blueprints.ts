import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

export type BlueprintStatus = "draft" | "ready" | "implemented" | "superseded";

export interface BlueprintIssueInput {
  number: number;
  title: string;
  state: string;
  body: string;
  url: string;
  labels?: string[];
}

export interface RenderIssueBlueprintOptions {
  issue: BlueprintIssueInput;
  status?: BlueprintStatus;
}

export interface WriteIssueBlueprintOptions {
  overwrite?: boolean;
}

export interface WriteIssueBlueprintResult {
  path: string;
  action: "created" | "overwritten" | "kept";
  content: string;
  gitignorePath: string;
  gitignoreAction: "created" | "kept";
}

export function blueprintsDirectory(projectRoot: string): string {
  return join(projectRoot, ".sdlc", "blueprints");
}

export function blueprintFileName(issueNumber: number): string {
  return `issue-${issueNumber}.md`;
}

export function blueprintFilePath(projectRoot: string, issueNumber: number): string {
  return join(blueprintsDirectory(projectRoot), blueprintFileName(issueNumber));
}

export function blueprintGitignoreContent(): string {
  return `*.md
!README.md
`;
}

export function renderIssueBlueprint(options: RenderIssueBlueprintOptions): string {
  const { issue } = options;
  const frontmatter = YAML.stringify({
    issue: issue.number,
    title: issue.title,
    status: options.status ?? "draft",
    source: "github",
  }).trim();
  const labels = issue.labels && issue.labels.length > 0 ? issue.labels.join(", ") : "none";

  return `---
${frontmatter}
---

# Blueprint: #${issue.number} ${issue.title}

Issue: ${issue.url}
State: ${issue.state}
Labels: ${labels}

## Issue Context

${issue.body.trim() || "_No issue body provided._"}

## Intended Change

- [ ] Describe the implementation approach.

## Files And Boundaries

- path/to/file: Expected change.

## Verification

- [ ] List the commands, tests, or QA checks that prove the change.

## Risks And Rollback

- Risk:
- Rollback:

## Closeout Notes

- PR:
- Verification:
- Production:
`;
}

export function ensureBlueprintGitignore(projectRoot: string): {
  path: string;
  action: "created" | "kept";
} {
  const directory = blueprintsDirectory(projectRoot);
  mkdirSync(directory, { recursive: true });

  const gitignorePath = join(directory, ".gitignore");
  if (existsSync(gitignorePath)) {
    return { path: gitignorePath, action: "kept" };
  }

  writeFileSync(gitignorePath, blueprintGitignoreContent());
  return { path: gitignorePath, action: "created" };
}

export function writeIssueBlueprint(
  projectRoot: string,
  issue: BlueprintIssueInput,
  options: WriteIssueBlueprintOptions = {},
): WriteIssueBlueprintResult {
  const gitignore = ensureBlueprintGitignore(projectRoot);
  const path = blueprintFilePath(projectRoot, issue.number);

  if (existsSync(path) && options.overwrite !== true) {
    return {
      path,
      action: "kept",
      content: readFileSync(path, "utf8"),
      gitignorePath: gitignore.path,
      gitignoreAction: gitignore.action,
    };
  }

  const existed = existsSync(path);
  const content = renderIssueBlueprint({ issue });
  writeFileSync(path, content);

  return {
    path,
    action: existed ? "overwritten" : "created",
    content,
    gitignorePath: gitignore.path,
    gitignoreAction: gitignore.action,
  };
}
