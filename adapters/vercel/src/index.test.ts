import { describe, expect, test } from "bun:test";
import { VercelPreviewAdapter } from "./index";

describe("VercelPreviewAdapter", () => {
  test("finds ready preview deployments from Vercel evidence", () => {
    const adapter = new VercelPreviewAdapter({ productionDomains: ["app.example.com"] });

    expect(
      adapter.resolvePreview({
        branch: "feature/reader",
        vercelEvidence: {
          deployments: [
            deployment({
              url: "app-git-feature-reader-team.vercel.app",
              state: "READY",
              target: "preview",
              branch: "feature/reader",
            }),
          ],
        },
      }),
    ).toMatchObject({
      status: "found",
      source: "vercel",
      url: "https://app-git-feature-reader-team.vercel.app",
      authRequired: false,
    });
  });

  test("reports pending previews when the matching deployment is still building", () => {
    const adapter = new VercelPreviewAdapter();

    expect(
      adapter.resolvePreview({
        sha: "abc123",
        vercelEvidence: [deployment({ state: "BUILDING", sha: "abc123def456" })],
      }),
    ).toMatchObject({
      status: "pending",
      source: "vercel",
      reason: "Preview deployment is BUILDING.",
    });
  });

  test("reports missing previews when no matching evidence exists", () => {
    const adapter = new VercelPreviewAdapter();

    expect(
      adapter.resolvePreview({
        branch: "feature/missing",
        vercelEvidence: [deployment({ branch: "other-branch" })],
      }),
    ).toEqual({
      status: "missing",
      reason: "No matching Vercel preview deployment evidence found.",
    });
  });

  test("records auth requirements for protected previews", () => {
    const adapter = new VercelPreviewAdapter();

    expect(
      adapter.resolvePreview({
        vercelEvidence: [
          {
            ...deployment({ state: "READY" }),
            protection: { type: "password" },
          },
        ],
      }),
    ).toMatchObject({
      status: "found",
      authRequired: true,
      authRequirement: "vercel-protection",
    });
  });

  test("rejects production deployments as preview evidence", () => {
    const adapter = new VercelPreviewAdapter({ productionDomains: ["app.example.com"] });

    expect(
      adapter.resolvePreview({
        githubEvidence: [
          {
            environment: "production",
            targetUrl: "https://app.example.com",
            state: "SUCCESS",
          },
        ],
        vercelEvidence: [deployment({ url: "app.example.com", target: "production" })],
      }),
    ).toEqual({
      status: "missing",
      reason: "Only production deployment evidence was found; preview evidence is required.",
    });
  });

  test("finds preview URLs from GitHub evidence text", () => {
    const adapter = new VercelPreviewAdapter();

    expect(
      adapter.resolvePreview({
        githubEvidence: [
          {
            text: "Preview: https://app-git-branch-team.vercel.app",
            state: "SUCCESS",
          },
        ],
      }),
    ).toMatchObject({
      status: "found",
      source: "github",
      url: "https://app-git-branch-team.vercel.app",
    });
  });
});

function deployment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    url: "app-git-feature-team.vercel.app",
    state: "READY",
    target: "preview",
    meta: {
      githubCommitRef: "feature/reader",
      githubCommitSha: "abc123def456",
    },
    ...overrides,
  };
}
