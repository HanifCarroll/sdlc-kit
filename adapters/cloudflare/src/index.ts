export type CloudflarePreviewState =
  | "success"
  | "active"
  | "ready"
  | "queued"
  | "building"
  | "initializing"
  | "pending"
  | "failure"
  | "failed"
  | "canceled";

export interface CloudflarePreviewAdapterOptions {
  productionDomains?: string[];
}

export interface ResolveCloudflarePreviewOptions {
  branch?: string;
  sha?: string;
  githubEvidence?: CloudflareGitHubEvidence[];
  cloudflareEvidence?: unknown;
}

export interface CloudflareGitHubEvidence {
  url?: string;
  targetUrl?: string;
  text?: string;
  environment?: string;
  state?: string;
  protected?: boolean;
}

export interface CloudflarePreviewDeployment {
  url: string;
  state: CloudflarePreviewState | string;
  environment?: string;
  branch?: string;
  sha?: string;
  protected: boolean;
}

export type CloudflarePreviewResolution =
  | {
      status: "found";
      url: string;
      source: "github" | "cloudflare";
      authRequired: boolean;
      authRequirement?: "cloudflare-access";
      deployment?: CloudflarePreviewDeployment;
    }
  | {
      status: "pending";
      source: "github" | "cloudflare";
      reason: string;
      url?: string;
      deployment?: CloudflarePreviewDeployment;
    }
  | {
      status: "missing";
      reason: string;
    };

const pendingStates = new Set(["queued", "building", "initializing", "pending", "in_progress"]);
const readyStates = new Set(["success", "active", "ready", "succeeded"]);

export class CloudflarePreviewAdapter {
  private readonly productionHosts: Set<string>;

  constructor(options: CloudflarePreviewAdapterOptions = {}) {
    this.productionHosts = new Set(options.productionDomains?.map(normalizeHost).filter(isString) ?? []);
  }

  resolvePreview(options: ResolveCloudflarePreviewOptions): CloudflarePreviewResolution {
    const github = this.resolveFromGitHub(options.githubEvidence ?? []);
    if (github.status === "found") {
      return github;
    }

    const deployments = normalizeCloudflareDeployments(options.cloudflareEvidence).filter((deployment) =>
      deploymentMatches(deployment, options),
    );
    const productionOnly = deployments.some((deployment) => this.isProductionDeployment(deployment));
    const previewDeployments = deployments.filter((deployment) => !this.isProductionDeployment(deployment));
    const ready = previewDeployments.find((deployment) => readyStates.has(normalizeState(deployment.state)));
    if (ready) {
      return {
        status: "found",
        source: "cloudflare",
        url: withProtocol(ready.url),
        authRequired: ready.protected,
        ...(ready.protected ? { authRequirement: "cloudflare-access" as const } : {}),
        deployment: ready,
      };
    }

    const pending = previewDeployments.find((deployment) => pendingStates.has(normalizeState(deployment.state)));
    if (pending) {
      return {
        status: "pending",
        source: "cloudflare",
        reason: `Cloudflare preview deployment is ${pending.state}.`,
        url: withProtocol(pending.url),
        deployment: pending,
      };
    }

    if (productionOnly || github.status === "missing-production-only") {
      return {
        status: "missing",
        reason: "Only production Cloudflare deployment evidence was found; preview evidence is required.",
      };
    }

    return {
      status: "missing",
      reason: "No matching Cloudflare preview deployment evidence found.",
    };
  }

  private resolveFromGitHub(
    evidence: CloudflareGitHubEvidence[],
  ): CloudflarePreviewResolution | { status: "missing-production-only" } {
    let productionOnly = false;

    for (const item of evidence) {
      const urls = extractUrls([item.url, item.targetUrl, item.text]);
      for (const url of urls) {
        if (isProductionEnvironment(item.environment) || this.isProductionUrl(url)) {
          productionOnly = true;
          continue;
        }

        const state = normalizeState(item.state ?? "success");
        if (pendingStates.has(state)) {
          return {
            status: "pending",
            source: "github",
            reason: `GitHub Cloudflare preview evidence is ${item.state ?? state}.`,
            url: withProtocol(url),
          };
        }

        if (readyStates.has(state)) {
          return {
            status: "found",
            source: "github",
            url: withProtocol(url),
            authRequired: item.protected === true,
            ...(item.protected === true ? { authRequirement: "cloudflare-access" as const } : {}),
          };
        }
      }
    }

    return productionOnly ? { status: "missing-production-only" } : { status: "missing", reason: "No GitHub Cloudflare preview evidence found." };
  }

  private isProductionDeployment(deployment: CloudflarePreviewDeployment): boolean {
    return isProductionEnvironment(deployment.environment) || this.isProductionUrl(deployment.url);
  }

  private isProductionUrl(url: string): boolean {
    const host = normalizeHost(url);
    return host !== undefined && this.productionHosts.has(host);
  }
}

function normalizeCloudflareDeployments(value: unknown): CloudflarePreviewDeployment[] {
  const rawDeployments = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.deployments)
      ? value.deployments
      : isRecord(value) && Array.isArray(value.result)
        ? value.result
        : [];

  return rawDeployments.flatMap((deployment) => {
    if (!isRecord(deployment)) {
      return [];
    }

    const url = urlFromDeployment(deployment);
    if (!url) {
      return [];
    }

    const normalized: CloudflarePreviewDeployment = {
      url,
      state: stringValue(deployment.status) ?? stringValue(deployment.state) ?? "unknown",
      protected: protectedFromDeployment(deployment),
    };
    const environment = environmentFromDeployment(deployment);
    const branch = branchFromDeployment(deployment);
    const sha = shaFromDeployment(deployment);

    if (environment) {
      normalized.environment = environment;
    }
    if (branch) {
      normalized.branch = branch;
    }
    if (sha) {
      normalized.sha = sha;
    }

    return [normalized];
  });
}

function deploymentMatches(
  deployment: CloudflarePreviewDeployment,
  options: ResolveCloudflarePreviewOptions,
): boolean {
  if (options.sha && deployment.sha && !deployment.sha.startsWith(options.sha) && !options.sha.startsWith(deployment.sha)) {
    return false;
  }
  if (options.branch && deployment.branch && deployment.branch !== options.branch) {
    return false;
  }
  return true;
}

function urlFromDeployment(deployment: Record<string, unknown>): string | undefined {
  const aliases = Array.isArray(deployment.aliases) ? deployment.aliases : [];
  return (
    stringValue(deployment.url) ??
    stringValue(deployment.deployment_url) ??
    stringValue(deployment.preview_url) ??
    aliases.map(stringValue).find(isString)
  );
}

function environmentFromDeployment(deployment: Record<string, unknown>): string | undefined {
  return (
    stringValue(deployment.environment) ??
    stringValue(deployment.env) ??
    (deployment.production === true ? "production" : undefined)
  );
}

function branchFromDeployment(deployment: Record<string, unknown>): string | undefined {
  const source = isRecord(deployment.source) ? deployment.source : {};
  const sourceConfig = isRecord(source.config) ? source.config : {};
  return (
    stringValue(deployment.branch) ??
    stringValue(deployment.branch_name) ??
    stringValue(source.branch) ??
    stringValue(sourceConfig["deployments.branch"])
  );
}

function shaFromDeployment(deployment: Record<string, unknown>): string | undefined {
  const source = isRecord(deployment.source) ? deployment.source : {};
  return (
    stringValue(deployment.sha) ??
    stringValue(deployment.commit_hash) ??
    stringValue(source.commit_hash) ??
    stringValue(source.sha)
  );
}

function protectedFromDeployment(deployment: Record<string, unknown>): boolean {
  if (deployment.protected === true || deployment.access === true) {
    return true;
  }
  return isRecord(deployment.accessPolicy) || isRecord(deployment.access_policy);
}

function extractUrls(values: Array<string | undefined>): string[] {
  const urls = new Set<string>();
  for (const value of values) {
    if (!value) {
      continue;
    }

    const matches =
      value.match(/https?:\/\/[^\s)]+|[a-z0-9-]+(?:-[a-z0-9-]+)*\.(?:pages\.dev|workers\.dev)\b/gi) ?? [];
    for (const match of matches) {
      urls.add(match);
    }
  }
  return [...urls];
}

function normalizeState(value: string): string {
  return value.toLowerCase();
}

function normalizeHost(value: string): string | undefined {
  try {
    return new URL(withProtocol(value)).host.toLowerCase();
  } catch {
    return undefined;
  }
}

function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function isProductionEnvironment(value: string | undefined): boolean {
  return value?.toLowerCase() === "production";
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
