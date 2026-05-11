import { describe, expect, test } from "bun:test";
import { checkDrift, formatDriftResult } from "./drift";
import type { SdlcProjectConfig } from "./index";

describe("checkDrift", () => {
  test("passes when mapped source and docs change together", () => {
    const result = checkDrift({
      config: projectConfig("error"),
      changedFiles: ["src/routes/login.ts", "docs/capabilities/auth.md"],
    });

    expect(result.status).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  test("requires mapped docs acknowledgement for source changes", () => {
    const result = checkDrift({
      config: projectConfig("warn"),
      changedFiles: ["src/routes/login.ts"],
    });

    expect(result.status).toBe("warning");
    expect(result.findings[0]).toMatchObject({
      code: "missing-doc-ack",
      severity: "warning",
      files: ["src/routes/login.ts"],
      docs: ["docs/capabilities/auth.md"],
    });
  });

  test("supports no-doc-impact reasons when they are concrete", () => {
    const result = checkDrift({
      config: projectConfig("error"),
      changedFiles: ["src/routes/login.ts"],
      noDocImpactReason: "Internal rename only; behavior and contracts are unchanged.",
    });

    expect(result.status).toBe("pass");
    expect(result.noDocImpactReason).toContain("Internal rename");
  });

  test("rejects empty no-doc-impact markers", () => {
    const result = checkDrift({
      config: projectConfig("warn"),
      changedFiles: ["src/routes/login.ts"],
      noDocImpactReason: "too short",
    });

    expect(result.status).toBe("error");
    expect(result.findings[0]).toMatchObject({
      code: "invalid-no-doc-impact",
      severity: "error",
    });
  });

  test("reports missing path mappings as setup gaps", () => {
    const result = checkDrift({
      config: {
        version: 1,
        project: "fixture",
        drift: {
          mode: "warn",
          mappings: [],
        },
      },
      changedFiles: ["src/unmapped.ts"],
    });

    expect(result.status).toBe("warning");
    expect(result.findings[0]).toMatchObject({
      code: "missing-mapping",
      severity: "warning",
      files: ["src/unmapped.ts"],
    });
  });

  test("formats output for CI and local agents", () => {
    const result = checkDrift({
      config: projectConfig("warn"),
      changedFiles: ["src/routes/login.ts"],
    });

    expect(formatDriftResult(result)).toContain("sdlc drift: warning");
    expect(formatDriftResult(result)).toContain("[warning] missing-doc-ack");
  });
});

function projectConfig(mode: "warn" | "error"): SdlcProjectConfig {
  return {
    version: 1,
    project: "fixture",
    drift: {
      mode,
      mappings: [
        {
          source_paths: ["src/routes/**"],
          docs: ["docs/capabilities/auth.md"],
        },
      ],
    },
  };
}
