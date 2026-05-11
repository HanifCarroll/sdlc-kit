import type { SdlcProjectConfig } from "./index";

export type DriftMode = "warn" | "error";
export type DriftStatus = "pass" | "warning" | "error";
export type DriftFindingCode =
  | "missing-doc-ack"
  | "missing-mapping"
  | "invalid-no-doc-impact";

export interface DriftCheckOptions {
  config: SdlcProjectConfig;
  changedFiles: string[];
  noDocImpactReason?: string;
}

export interface DriftFinding {
  code: DriftFindingCode;
  severity: "warning" | "error";
  message: string;
  files: string[];
  docs?: string[];
}

export interface DriftCheckResult {
  status: DriftStatus;
  mode: DriftMode;
  changedFiles: string[];
  findings: DriftFinding[];
  noDocImpactReason?: string;
}

export function checkDrift(options: DriftCheckOptions): DriftCheckResult {
  const changedFiles = uniqueNormalizedPaths(options.changedFiles);
  const mode = options.config.drift?.mode ?? "warn";
  const severity = mode === "error" ? "error" : "warning";
  const mappings = options.config.drift?.mappings ?? [];
  const noDocImpactReason = normalizeReason(options.noDocImpactReason);
  const hasValidNoDocImpactReason =
    noDocImpactReason !== undefined && isUsefulReason(noDocImpactReason);
  const findings: DriftFinding[] = [];

  if (noDocImpactReason !== undefined && !hasValidNoDocImpactReason) {
    findings.push({
      code: "invalid-no-doc-impact",
      severity: "error",
      message: "No-doc-impact markers must include a concrete reason of at least 12 characters.",
      files: [],
    });
  }

  const sourceChanges = changedFiles.filter((file) => !isDocumentationPath(file));
  if (sourceChanges.length > 0 && mappings.length === 0) {
    findings.push({
      code: "missing-mapping",
      severity: "warning",
      message: "drift.mappings has no entries, so source-to-doc drift cannot be checked yet.",
      files: sourceChanges,
    });
  }

  const matchedSources = new Set<string>();
  for (const mapping of mappings) {
    const changedSources = sourceChanges.filter((file) => matchesAny(file, mapping.source_paths));
    if (changedSources.length === 0) {
      continue;
    }

    for (const file of changedSources) {
      matchedSources.add(file);
    }

    const changedDocs = changedFiles.filter((file) => matchesAny(file, mapping.docs));
    if (changedDocs.length > 0 || hasValidNoDocImpactReason) {
      continue;
    }

    findings.push({
      code: "missing-doc-ack",
      severity,
      message: `Source changes in ${changedSources.join(", ")} require a mapped docs/capability update or a no-doc-impact reason.`,
      files: changedSources,
      docs: mapping.docs,
    });
  }

  const unmappedSources = sourceChanges.filter((file) => !matchedSources.has(file));
  if (mappings.length > 0 && unmappedSources.length > 0) {
    findings.push({
      code: "missing-mapping",
      severity: "warning",
      message: "Some changed source paths are not covered by drift.mappings.",
      files: unmappedSources,
    });
  }

  return {
    status: statusFromFindings(findings),
    mode,
    changedFiles,
    findings,
    ...(noDocImpactReason !== undefined ? { noDocImpactReason } : {}),
  };
}

function uniqueNormalizedPaths(paths: string[]): string[] {
  return Array.from(new Set(paths.map(normalizePath).filter((path) => path !== ""))).sort();
}

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

function normalizeReason(reason: string | undefined): string | undefined {
  const normalized = reason?.trim();
  return normalized === "" ? undefined : normalized;
}

function isUsefulReason(reason: string): boolean {
  return reason.trim().length >= 12;
}

function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesPattern(path, pattern));
}

function matchesPattern(path: string, pattern: string): boolean {
  return globToRegExp(normalizePath(pattern)).test(path);
}

function globToRegExp(pattern: string): RegExp {
  let source = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];

    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
      continue;
    }
    if (char === "*") {
      source += "[^/]*";
      continue;
    }
    source += escapeRegExp(char ?? "");
  }

  return new RegExp(`^${source}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function isDocumentationPath(file: string): boolean {
  return (
    file.startsWith("docs/") ||
    file.startsWith(".github/") ||
    file.startsWith(".sdlc/") ||
    file === "README.md" ||
    file.endsWith(".md")
  );
}

function statusFromFindings(findings: DriftFinding[]): DriftStatus {
  if (findings.some((finding) => finding.severity === "error")) {
    return "error";
  }
  if (findings.length > 0) {
    return "warning";
  }
  return "pass";
}

export function formatDriftResult(result: DriftCheckResult): string {
  const lines = [
    `sdlc drift: ${result.status}`,
    `mode: ${result.mode}`,
    `changed files: ${result.changedFiles.length}`,
  ];

  if (result.noDocImpactReason) {
    lines.push(`no-doc-impact: ${result.noDocImpactReason}`);
  }

  if (result.findings.length > 0) {
    lines.push("findings:");
    for (const finding of result.findings) {
      lines.push(`- [${finding.severity}] ${finding.code}: ${finding.message}`);
      if (finding.docs && finding.docs.length > 0) {
        lines.push(`  docs: ${finding.docs.join(", ")}`);
      }
    }
  }

  return lines.join("\n");
}
