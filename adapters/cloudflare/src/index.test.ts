import { describe, expect, test } from "bun:test";
import { CloudflarePreviewAdapter } from "./index";

describe("CloudflarePreviewAdapter", () => {
  test("finds ready Pages preview deployments from Cloudflare evidence", () => {
    const adapter = new CloudflarePreviewAdapter({ productionDomains: ["app.example.com"] });

    expect(
      adapter.resolvePreview({
        branch: "feature/reader",
        cloudflareEvidence: {
          result: [
            deployment({
              url: "abc123.app.pages.dev",
              environment: "preview",
              branch: "feature/reader",
              status: "success",
            }),
          ],
        },
      }),
    ).toMatchObject({
      status: "found",
      source: "cloudflare",
      url: "https://abc123.app.pages.dev",
      authRequired: false,
    });
  });

  test("reports pending previews when the matching deployment is still building", () => {
    const adapter = new CloudflarePreviewAdapter();

    expect(
      adapter.resolvePreview({
        sha: "abc123",
        cloudflareEvidence: [deployment({ status: "building", sha: "abc123def456" })],
      }),
    ).toMatchObject({
      status: "pending",
      source: "cloudflare",
      reason: "Cloudflare preview deployment is building.",
    });
  });

  test("reports missing previews when no matching evidence exists", () => {
    const adapter = new CloudflarePreviewAdapter();

    expect(
      adapter.resolvePreview({
        branch: "feature/missing",
        cloudflareEvidence: [deployment({ branch: "other-branch" })],
      }),
    ).toEqual({
      status: "missing",
      reason: "No matching Cloudflare preview deployment evidence found.",
    });
  });

  test("records auth requirements for Cloudflare Access protected previews", () => {
    const adapter = new CloudflarePreviewAdapter();

    expect(
      adapter.resolvePreview({
        cloudflareEvidence: [
          {
            ...deployment({ status: "success" }),
            access_policy: { enabled: true },
          },
        ],
      }),
    ).toMatchObject({
      status: "found",
      authRequired: true,
      authRequirement: "cloudflare-access",
    });
  });

  test("rejects production deployments as preview evidence", () => {
    const adapter = new CloudflarePreviewAdapter({ productionDomains: ["app.example.com"] });

    expect(
      adapter.resolvePreview({
        githubEvidence: [
          {
            environment: "production",
            targetUrl: "https://app.example.com",
            state: "success",
          },
        ],
        cloudflareEvidence: [deployment({ url: "app.example.com", environment: "production" })],
      }),
    ).toEqual({
      status: "missing",
      reason: "Only production Cloudflare deployment evidence was found; preview evidence is required.",
    });
  });

  test("finds preview URLs from GitHub evidence text", () => {
    const adapter = new CloudflarePreviewAdapter();

    expect(
      adapter.resolvePreview({
        githubEvidence: [
          {
            text: "Preview: https://fix-api.app.pages.dev",
            state: "success",
          },
        ],
      }),
    ).toMatchObject({
      status: "found",
      source: "github",
      url: "https://fix-api.app.pages.dev",
    });
  });

  test("supports Workers preview URL evidence", () => {
    const adapter = new CloudflarePreviewAdapter();

    expect(
      adapter.resolvePreview({
        cloudflareEvidence: [
          deployment({
            url: "staging-api.hanif.workers.dev",
            environment: "preview",
            status: "ready",
          }),
        ],
      }),
    ).toMatchObject({
      status: "found",
      url: "https://staging-api.hanif.workers.dev",
    });
  });
});

function deployment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    url: "abc123.app.pages.dev",
    status: "success",
    environment: "preview",
    branch: "feature/reader",
    sha: "abc123def456",
    ...overrides,
  };
}
