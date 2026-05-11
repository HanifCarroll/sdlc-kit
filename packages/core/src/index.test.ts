import { describe, expect, test } from "bun:test";
import { validateProjectConfig } from "./index";

describe("validateProjectConfig", () => {
  test("accepts the v1 project contract", () => {
    expect(
      validateProjectConfig({
        version: 1,
        project: "example",
        tracker: { provider: "github" },
        preview: { provider: "vercel" },
        local: { provider: "portless" },
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
});
