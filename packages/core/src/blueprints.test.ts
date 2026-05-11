import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  blueprintFilePath,
  renderIssueBlueprint,
  writeIssueBlueprint,
} from "./blueprints";

describe("issue blueprints", () => {
  test("renders an issue-level blueprint with frontmatter and work sections", () => {
    const content = renderIssueBlueprint({
      issue: issueFixture(),
    });

    expect(content).toContain("issue: 6");
    expect(content).toContain("status: draft");
    expect(content).toContain("# Blueprint: #6 Blueprint handling");
    expect(content).toContain("## Intended Change");
    expect(content).toContain("## Verification");
  });

  test("writes blueprints under .sdlc/blueprints and preserves existing plans by default", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-blueprint-"));
    const first = writeIssueBlueprint(projectRoot, issueFixture());

    expect(first.action).toBe("created");
    expect(first.path).toBe(blueprintFilePath(projectRoot, 6));
    expect(existsSync(first.path)).toBe(true);
    expect(readFileSync(first.gitignorePath, "utf8")).toContain("*.md");

    writeFileSync(first.path, "local edits");
    const second = writeIssueBlueprint(projectRoot, issueFixture());
    expect(second.action).toBe("kept");
    expect(second.content).toBe("local edits");
  });
});

function issueFixture() {
  return {
    number: 6,
    title: "Blueprint handling",
    state: "OPEN",
    body: "Acceptance criteria",
    url: "https://github.com/acme/example/issues/6",
    labels: ["type:feature"],
  };
}
