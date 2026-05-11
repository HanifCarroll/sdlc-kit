import { describe, expect, test } from "bun:test";
import {
  BLUEPRINT_COMMENT_MARKER,
  GitHubAdapter,
  GitHubAdapterError,
  buildBlueprintComment,
  buildCloseoutComment,
  hasIssueLabel,
  linkedPullRequestUrls,
  matchingIssueLabels,
  redactSecrets,
  type GitHubCommandOptions,
  type GitHubCommandResult,
  type GitHubCommandRunner,
} from "./index";

const fakeOpenAiKey = `sk-${"x".repeat(24)}`;
const fakeGitHubToken = `ghp_${"x".repeat(24)}`;
const fakeBearerToken = `Bearer ${"a".repeat(24)}`;

describe("GitHubAdapter", () => {
  test("resolves issue metadata, labels, and linked PRs from gh output", () => {
    const runner = createMockRunner({
      issue: {
        number: 5,
        title: "GitHub adapter",
        state: "OPEN",
        body: "body",
        url: "https://github.com/acme/example/issues/5",
        labels: [{ name: "area:adapter" }, { name: "type:feature" }],
        comments: [],
        closedByPullRequestsReferences: [
          {
            number: 15,
            title: "Adapter PR",
            url: "https://github.com/acme/example/pull/15",
            state: "MERGED",
          },
        ],
      },
    });

    const issue = new GitHubAdapter({ runner }).getIssue(5);

    expect(issue).toMatchObject({
      number: 5,
      title: "GitHub adapter",
      labels: ["area:adapter", "type:feature"],
    });
    expect(hasIssueLabel(issue, "area:adapter")).toBe(true);
    expect(matchingIssueLabels(issue, ["area:adapter", "missing"])).toEqual(["area:adapter"]);
    expect(linkedPullRequestUrls(issue)).toEqual(["https://github.com/acme/example/pull/15"]);
  });

  test("updates an existing blueprint comment with the stable marker", () => {
    const runner = createMockRunner({
      issue: {
        number: 5,
        title: "GitHub adapter",
        state: "OPEN",
        body: "",
        url: "https://github.com/acme/example/issues/5",
        labels: [],
        comments: [
          {
            id: "IC_existing",
            body: `${BLUEPRINT_COMMENT_MARKER}\nold`,
            url: "https://github.com/acme/example/issues/5#issuecomment-1",
          },
        ],
        closedByPullRequestsReferences: [],
      },
    });

    const result = new GitHubAdapter({ runner }).upsertBlueprintComment(
      5,
      `Use OPENAI_API_KEY=${fakeOpenAiKey}`,
    );

    expect(result).toEqual({ action: "updated", commentId: "IC_existing" });
    const update = runner.calls.find((call) => call.args[0] === "api" && call.args[1] === "graphql");
    expect(update).toBeDefined();
    expect(update?.args.join(" ")).toBe("api graphql --input -");
    expect(update?.options?.input).toContain("IC_existing");
    expect(update?.options?.input).not.toContain(fakeOpenAiKey);
    expect(update?.options?.input).toContain("[REDACTED]");
  });

  test("creates a blueprint comment when no marker exists", () => {
    const runner = createMockRunner({
      issue: {
        number: 5,
        title: "GitHub adapter",
        state: "OPEN",
        body: "",
        url: "https://github.com/acme/example/issues/5",
        labels: [],
        comments: [],
        closedByPullRequestsReferences: [],
      },
    });

    const result = new GitHubAdapter({ runner }).upsertBlueprintComment(5, "Plan body");

    expect(result).toEqual({ action: "created" });
    const create = runner.calls.find((call) => call.args.join(" ") === "issue comment 5 --body-file -");
    expect(create?.options?.input).toContain(BLUEPRINT_COMMENT_MARKER);
    expect(create?.options?.input).toContain("Plan body");
  });

  test("writes closeout comments with redacted verification evidence", () => {
    const runner = createMockRunner();

    new GitHubAdapter({ runner }).writeCloseoutComment(5, {
      summary: "Merged PR #15",
      verification: ["bun test", fakeBearerToken],
      production: "Not required",
      notes: [`TOKEN=${"s".repeat(24)}`],
    });

    const create = runner.calls.find((call) => call.args.join(" ") === "issue comment 5 --body-file -");
    expect(create?.options?.input).toContain("## SDLC Closeout");
    expect(create?.options?.input).toContain("Bearer [REDACTED]");
    expect(create?.options?.input).toContain("TOKEN=[REDACTED]");
  });

  test("reports missing gh and missing auth as actionable errors", () => {
    const missingGh = createMockRunner({ versionExitCode: 127 });
    expect(() => new GitHubAdapter({ runner: missingGh }).checkHealth()).toThrow(
      "GitHub CLI `gh` is required",
    );

    const missingAuth = createMockRunner({ authExitCode: 1 });
    expect(() => new GitHubAdapter({ runner: missingAuth }).checkHealth()).toThrow(
      "Run `gh auth login`",
    );
  });

  test("redacts secret-like output in gh command failures", () => {
    const runner = createMockRunner({
      issueExitCode: 1,
      issueStderr: `failed with OPENAI_API_KEY=${fakeOpenAiKey}`,
    });

    expect(() => new GitHubAdapter({ runner }).getIssue(5)).toThrow(GitHubAdapterError);
    expect(() => new GitHubAdapter({ runner }).getIssue(5)).toThrow("[REDACTED]");
  });
});

describe("comment builders", () => {
  test("builds marked blueprint comments", () => {
    expect(buildBlueprintComment("Do the thing")).toContain(BLUEPRINT_COMMENT_MARKER);
    expect(buildBlueprintComment("Do the thing")).toContain("Do the thing");
  });

  test("redacts common secret shapes", () => {
    expect(
      redactSecrets(`${fakeGitHubToken} OPENAI_API_KEY=${fakeOpenAiKey}`),
    ).toBe("[REDACTED] OPENAI_API_KEY=[REDACTED]");
  });

  test("builds closeout comments with verification items", () => {
    expect(
      buildCloseoutComment({
        verification: ["bun run ci"],
      }),
    ).toContain("- bun run ci");
  });
});

interface MockRunnerOptions {
  versionExitCode?: number;
  authExitCode?: number;
  issueExitCode?: number;
  issueStderr?: string;
  issue?: unknown;
}

interface MockRunner extends GitHubCommandRunner {
  calls: Array<{ args: string[]; options?: GitHubCommandOptions }>;
}

function createMockRunner(options: MockRunnerOptions = {}): MockRunner {
  const calls: MockRunner["calls"] = [];

  return {
    calls,
    run(args, callOptions) {
      calls.push(callOptions === undefined ? { args } : { args, options: callOptions });

      if (args[0] === "--version") {
        return result(options.versionExitCode ?? 0, "gh version 2.0.0");
      }
      if (args[0] === "auth" && args[1] === "status") {
        return result(options.authExitCode ?? 0, "Logged in");
      }
      if (args[0] === "issue" && args[1] === "view") {
        return result(
          options.issueExitCode ?? 0,
          JSON.stringify(options.issue ?? defaultIssue()),
          options.issueStderr ?? "",
        );
      }

      return result(0, "{}");
    },
  };
}

function defaultIssue(): unknown {
  return {
    number: 5,
    title: "Default",
    state: "OPEN",
    body: "",
    url: "https://github.com/acme/example/issues/5",
    labels: [],
    comments: [],
    closedByPullRequestsReferences: [],
  };
}

function result(exitCode: number, stdout = "", stderr = ""): GitHubCommandResult {
  return { exitCode, stdout, stderr };
}
