export type VercelDeploymentState =
  | "READY"
  | "BUILDING"
  | "QUEUED"
  | "INITIALIZING"
  | "ERROR"
  | "CANCELED";

export interface VercelPreviewAdapterOptions {
  productionDomains?: string[];
}

export interface ResolveVercelPreviewOptions {
  branch?: string;
  sha?: string;
  githubEvidence?: GitHubPreviewEvidence[];
  vercelEvidence?: unknown;
}

export interface GitHubPreviewEvidence {
  url?: string;
  targetUrl?: string;
  text?: string;
  environment?: string;
  state?: string;
  protected?: boolean;
}

export interface VercelPreviewDeployment {
  url: string;
  state: VercelDeploymentState | string;
  target?: string;
  branch?: string;
  sha?: string;
  protected: boolean;
}

export type VercelPreviewResolution =
  | {
      status: "found";
      url: string;
      source: "github" | "vercel";
      authRequired: boolean;
      authRequirement?: "vercel-protection";
      deployment?: VercelPreviewDeployment;
    }
  | {
      status: "pending";
      source: "github" | "vercel";
      reason: string;
      url?: string;
      deployment?: VercelPreviewDeployment;
    }
  | {
      status: "missing";
      reason: string;
    };

const pendingStates = new Set(["BUILDING", "QUEUED", "INITIALIZING", "PENDING", "IN_PROGRESS"]);
const readyStates = new Set(["READY", "SUCCESS", "SUCCEEDED"]);

export class VercelPreviewAdapter {
  private readonly productionHosts: Set<string>;

  constructor(options: VercelPreviewAdapterOptions = {}) {
    this.productionHosts = new Set(options.productionDomains?.map(normalizeHost).filter(isString) ?? []);
  }

  resolvePreview(options: ResolveVercelPreviewOptions): VercelPreviewResolution {
    const github = this.resolveFromGitHub(options.githubEvidence ?? []);
    if (github.status === "found") {
      return github;
    }

    const deployments = normalizeVercelDeployments(options.vercelEvidence).filter((deployment) =>
      deploymentMatches(deployment, options),
    );
    const productionOnly = deployments.some((deployment) => this.isProductionDeployment(deployment));
    const previewDeployments = deployments.filter((deployment) => !this.isProductionDeployment(deployment));
    const ready = previewDeployments.find((deployment) => readyStates.has(deployment.state.toUpperCase()));
    if (ready) {
      return {
        status: "found",
        source: "vercel",
        url: withProtocol(ready.url),
        authRequired: ready.protected,
        ...(ready.protected ? { authRequirement: "vercel-protection" as const } : {}),
        deployment: ready,
      };
    }

    const pending = previewDeployments.find((deployment) => pendingStates.has(deployment.state.toUpperCase()));
    if (pending) {
      return {
        status: "pending",
        source: "vercel",
        reason: `Preview deployment is ${pending.state}.`,
        url: withProtocol(pending.url),
        deployment: pending,
      };
    }

    if (productionOnly || github.status === "missing-production-only") {
      return {
        status: "missing",
        reason: "Only production deployment evidence was found; preview evidence is required.",
      };
    }

    return {
      status: "missing",
      reason: "No matching Vercel preview deployment evidence found.",
    };
  }

  private resolveFromGitHub(evidence: GitHubPreviewEvidence[]): VercelPreviewResolution | { status: "missing-production-only" } {
    let productionOnly = false;

    for (const item of evidence) {
      const urls = extractUrls([item.url, item.targetUrl, item.text]);
      for (const url of urls) {
        if (isProductionEnvironment(item.environment) || this.isProductionUrl(url)) {
          productionOnly = true;
          continue;
        }

        const state = item.state?.toUpperCase() ?? "READY";
        if (pendingStates.has(state)) {
          return {
            status: "pending",
            source: "github",
            reason: `GitHub preview evidence is ${state}.`,
            url: withProtocol(url),
          };
        }

        if (readyStates.has(state) || state === "ACTIVE") {
          return {
            status: "found",
            source: "github",
            url: withProtocol(url),
            authRequired: item.protected === true,
            ...(item.protected === true ? { authRequirement: "vercel-protection" as const } : {}),
          };
        }
      }
    }

    return productionOnly ? { status: "missing-production-only" } : missing("No GitHub preview evidence found.");
  }

  private isProductionDeployment(deployment: VercelPreviewDeployment): boolean {
    return deployment.target?.toLowerCase() === "production" || this.isProductionUrl(deployment.url);
  }

  private isProductionUrl(url: string): boolean {
    const host = normalizeHost(url);
    return host !== undefined && this.productionHosts.has(host);
  }
}

function normalizeVercelDeployments(value: unknown): VercelPreviewDeployment[] {
  const rawDeployments = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.deployments)
      ? value.deployments
      : [];

  return rawDeployments.flatMap((deployment) => {
    if (!isRecord(deployment)) {
      return [];
    }

    const url = stringValue(deployment.url) ?? stringValue(deployment.inspectorUrl);
    if (!url) {
      return [];
    }

    const normalized: VercelPreviewDeployment = {
      url,
      state: stringValue(deployment.state) ?? stringValue(deployment.readyState) ?? "UNKNOWN",
      protected: protectedFromDeployment(deployment),
    };
    const target = stringValue(deployment.target);
    const branch = branchFromDeployment(deployment);
    const sha = shaFromDeployment(deployment);

    if (target) {
      normalized.target = target;
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

function deploymentMatches(deployment: VercelPreviewDeployment, options: ResolveVercelPreviewOptions): boolean {
  if (options.sha && deployment.sha && !deployment.sha.startsWith(options.sha) && !options.sha.startsWith(deployment.sha)) {
    return false;
  }
  if (options.branch && deployment.branch && deployment.branch !== options.branch) {
    return false;
  }
  return true;
}

function branchFromDeployment(deployment: Record<string, unknown>): string | undefined {
  const meta = isRecord(deployment.meta) ? deployment.meta : {};
  return (
    stringValue(deployment.branch) ??
    stringValue(deployment.gitSourceBranch) ??
    stringValue(meta.githubCommitRef) ??
    stringValue(meta.gitBranch)
  );
}

function shaFromDeployment(deployment: Record<string, unknown>): string | undefined {
  const meta = isRecord(deployment.meta) ? deployment.meta : {};
  return (
    stringValue(deployment.sha) ??
    stringValue(deployment.gitSourceSha) ??
    stringValue(meta.githubCommitSha) ??
    stringValue(meta.gitCommitSha)
  );
}

function protectedFromDeployment(deployment: Record<string, unknown>): boolean {
  if (deployment.protected === true || deployment.passwordProtection === true) {
    return true;
  }
  if (isRecord(deployment.protection) || isRecord(deployment.deploymentProtection)) {
    return true;
  }
  return false;
}

function extractUrls(values: Array<string | undefined>): string[] {
  const urls = new Set<string>();
  for (const value of values) {
    if (!value) {
      continue;
    }

    const matches = value.match(/https?:\/\/[^\s)]+|[a-z0-9-]+(?:-[a-z0-9-]+)*\.vercel\.app\b/gi) ?? [];
    for (const match of matches) {
      urls.add(match);
    }
  }
  return [...urls];
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

function missing(reason: string): VercelPreviewResolution {
  return { status: "missing", reason };
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
