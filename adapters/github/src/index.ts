export const BLUEPRINT_COMMENT_MARKER = "<!-- sdlc-kit:blueprint:v1 -->";

const UPDATE_ISSUE_COMMENT_MUTATION = `
mutation UpdateIssueComment($id: ID!, $body: String!) {
  updateIssueComment(input: { id: $id, body: $body }) {
    issueComment {
      id
      url
    }
  }
}`;

export interface GitHubCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface GitHubCommandOptions {
  cwd?: string;
  input?: string;
}

export interface GitHubCommandRunner {
  run(args: string[], options?: GitHubCommandOptions): GitHubCommandResult;
}

export interface GitHubAdapterOptions {
  cwd?: string;
  runner?: GitHubCommandRunner;
}

export interface GitHubLabel {
  name: string;
}

export interface GitHubComment {
  id: string;
  body: string;
  url?: string;
  author?: {
    login?: string;
  };
}

export interface GitHubPullRequestLink {
  number: number;
  title?: string;
  url: string;
  state?: string;
}

export interface GitHubIssueMetadata {
  number: number;
  title: string;
  state: string;
  body: string;
  url: string;
  labels: string[];
  comments: GitHubComment[];
  pullRequests: GitHubPullRequestLink[];
}

export interface BlueprintCommentResult {
  action: "created" | "updated";
  commentId?: string;
}

export interface CloseoutEvidence {
  summary?: string;
  verification: string[];
  production?: string;
  notes?: string[];
}

export class GitHubAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: "missing-gh" | "auth-required" | "gh-failed" | "invalid-json",
  ) {
    super(message);
    this.name = "GitHubAdapterError";
  }
}

export class GitHubAdapter {
  private readonly runner: GitHubCommandRunner;
  private readonly cwd: string | undefined;

  constructor(options: GitHubAdapterOptions = {}) {
    this.runner = options.runner ?? createGhCommandRunner();
    this.cwd = options.cwd;
  }

  checkHealth(): void {
    const version = this.runner.run(["--version"], this.commandOptions());
    if (version.exitCode !== 0) {
      throw new GitHubAdapterError(
        "GitHub CLI `gh` is required for the GitHub adapter. Install `gh` and ensure it is on PATH.",
        "missing-gh",
      );
    }

    const auth = this.runner.run(["auth", "status"], this.commandOptions());
    if (auth.exitCode !== 0) {
      throw new GitHubAdapterError(
        "GitHub CLI auth is not ready. Run `gh auth login` and try again.",
        "auth-required",
      );
    }
  }

  getIssue(issueNumber: number): GitHubIssueMetadata {
    this.checkHealth();
    const raw = this.runJson<RawIssue>([
      "issue",
      "view",
      String(issueNumber),
      "--json",
      "number,title,state,body,url,labels,comments,closedByPullRequestsReferences",
    ]);

    return normalizeIssue(raw);
  }

  upsertBlueprintComment(issueNumber: number, blueprintMarkdown: string): BlueprintCommentResult {
    const issue = this.getIssue(issueNumber);
    const existing = issue.comments.find((comment) => comment.body.includes(BLUEPRINT_COMMENT_MARKER));
    const body = buildBlueprintComment(blueprintMarkdown);

    if (existing) {
      this.runGh(["api", "graphql", "--input", "-"], {
        input: JSON.stringify({
          query: UPDATE_ISSUE_COMMENT_MUTATION,
          variables: {
            id: existing.id,
            body,
          },
        }),
      });
      return { action: "updated", commentId: existing.id };
    }

    this.runGh(["issue", "comment", String(issueNumber), "--body-file", "-"], { input: body });
    return { action: "created" };
  }

  writeCloseoutComment(issueNumber: number, evidence: CloseoutEvidence): void {
    this.checkHealth();
    this.runGh(["issue", "comment", String(issueNumber), "--body-file", "-"], {
      input: buildCloseoutComment(evidence),
    });
  }

  closeIssue(issueNumber: number): void {
    this.checkHealth();
    this.runGh(["issue", "close", String(issueNumber), "--reason", "completed"]);
  }

  private runJson<T>(args: string[]): T {
    const result = this.runGh(args);
    try {
      return JSON.parse(result.stdout) as T;
    } catch (error) {
      throw new GitHubAdapterError(
        `GitHub CLI returned invalid JSON for \`gh ${args.join(" ")}\`: ${toErrorMessage(error)}`,
        "invalid-json",
      );
    }
  }

  private runGh(args: string[], options: GitHubCommandOptions = {}): GitHubCommandResult {
    const result = this.runner.run(args, this.commandOptions(options));
    if (result.exitCode !== 0) {
      throw new GitHubAdapterError(
        `GitHub CLI command failed: gh ${args.join(" ")}\n${redactSecrets(result.stderr || result.stdout)}`,
        "gh-failed",
      );
    }
    return result;
  }

  private commandOptions(options: GitHubCommandOptions = {}): GitHubCommandOptions {
    const merged: GitHubCommandOptions = {};
    const cwd = options.cwd ?? this.cwd;

    if (cwd !== undefined) {
      merged.cwd = cwd;
    }
    if (options.input !== undefined) {
      merged.input = options.input;
    }

    return merged;
  }
}

export function createGhCommandRunner(): GitHubCommandRunner {
  return {
    run(args, options = {}) {
      try {
        const result = Bun.spawnSync(["gh", ...args], {
          ...spawnCwdOption(options.cwd),
          stdin: options.input === undefined ? "ignore" : new TextEncoder().encode(options.input),
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

export function hasIssueLabel(issue: GitHubIssueMetadata, label: string): boolean {
  return issue.labels.includes(label);
}

export function matchingIssueLabels(issue: GitHubIssueMetadata, labels: string[]): string[] {
  const available = new Set(issue.labels);
  return labels.filter((label) => available.has(label));
}

export function linkedPullRequestUrls(issue: GitHubIssueMetadata): string[] {
  return issue.pullRequests.map((pullRequest) => pullRequest.url);
}

export function buildBlueprintComment(blueprintMarkdown: string): string {
  return `${BLUEPRINT_COMMENT_MARKER}

## SDLC Blueprint

${redactSecrets(blueprintMarkdown).trim()}
`;
}

export function buildCloseoutComment(evidence: CloseoutEvidence): string {
  const lines = ["## SDLC Closeout"];

  if (evidence.summary) {
    lines.push("", evidence.summary.trim());
  }

  lines.push("", "### Verification");
  for (const item of evidence.verification) {
    lines.push(`- ${item}`);
  }

  if (evidence.production) {
    lines.push("", "### Production");
    lines.push(evidence.production);
  }

  if (evidence.notes && evidence.notes.length > 0) {
    lines.push("", "### Notes");
    for (const item of evidence.notes) {
      lines.push(`- ${item}`);
    }
  }

  return redactSecrets(lines.join("\n").trim() + "\n");
}

export function redactSecrets(value: string): string {
  return value
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,})\b/g, "[REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/gi, "Bearer [REDACTED]")
    .replace(/\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*)=([^\s]+)/gi, "$1=[REDACTED]");
}

interface RawIssue {
  number?: unknown;
  title?: unknown;
  state?: unknown;
  body?: unknown;
  url?: unknown;
  labels?: unknown;
  comments?: unknown;
  closedByPullRequestsReferences?: unknown;
}

function normalizeIssue(raw: RawIssue): GitHubIssueMetadata {
  return {
    number: numberValue(raw.number),
    title: stringValue(raw.title),
    state: stringValue(raw.state),
    body: stringValue(raw.body),
    url: stringValue(raw.url),
    labels: normalizeLabels(raw.labels),
    comments: normalizeComments(raw.comments),
    pullRequests: normalizePullRequests(raw.closedByPullRequestsReferences),
  };
}

function normalizeLabels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((label) => (isRecord(label) ? label.name : undefined))
    .filter((name): name is string => typeof name === "string");
}

function normalizeComments(value: unknown): GitHubComment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((comment) => {
    if (!isRecord(comment) || typeof comment.id !== "string" || typeof comment.body !== "string") {
      return [];
    }

    const normalized: GitHubComment = {
      id: comment.id,
      body: comment.body,
    };
    if (typeof comment.url === "string") {
      normalized.url = comment.url;
    }

    const author = normalizeAuthor(comment.author);
    if (author) {
      normalized.author = author;
    }

    return [normalized];
  });
}

function normalizePullRequests(value: unknown): GitHubPullRequestLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((pullRequest) => {
    if (!isRecord(pullRequest) || typeof pullRequest.url !== "string") {
      return [];
    }

    const normalized: GitHubPullRequestLink = {
      number: numberValue(pullRequest.number),
      url: pullRequest.url,
    };
    if (typeof pullRequest.title === "string") {
      normalized.title = pullRequest.title;
    }
    if (typeof pullRequest.state === "string") {
      normalized.state = pullRequest.state;
    }

    return [normalized];
  });
}

function normalizeAuthor(value: unknown): { login?: string } | undefined {
  if (!isRecord(value) || typeof value.login !== "string") {
    return undefined;
  }
  return { login: value.login };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function decodeOutput(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
