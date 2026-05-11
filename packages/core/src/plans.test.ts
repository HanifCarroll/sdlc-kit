import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { validatePlanDocuments } from "./plans";

describe("plan document validation", () => {
  test("accepts plans with required frontmatter conventions", () => {
    const plansDir = createPlansDir();
    writeFileSync(
      join(plansDir, "accepted-plan.md"),
      `---
status: approved
created: "2026-05-10"
---

# Accepted Plan
`,
    );

    expect(validatePlanDocuments(plansDir)).toEqual([
      {
        path: join(plansDir, "accepted-plan.md"),
        relativePath: "accepted-plan.md",
        status: "approved",
        errors: [],
      },
    ]);
  });

  test("reports missing or invalid plan frontmatter", () => {
    const plansDir = createPlansDir();
    writeFileSync(join(plansDir, "missing.md"), "# Missing");
    writeFileSync(
      join(plansDir, "invalid.md"),
      `---
status: maybe
created: soon
---

# Invalid
`,
    );

    const results = validatePlanDocuments(plansDir);
    expect(results.find((plan) => plan.relativePath === "missing.md")?.errors).toEqual([
      "missing YAML frontmatter",
    ]);
    expect(results.find((plan) => plan.relativePath === "invalid.md")?.errors).toEqual([
      "frontmatter.status must be one of: draft, active, approved, superseded, archived",
      "frontmatter.created must be a YYYY-MM-DD string",
    ]);
  });
});

function createPlansDir(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-plans-"));
  const plansDir = join(projectRoot, "docs", "plans");
  mkdirSync(plansDir, { recursive: true });
  return plansDir;
}
