import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface PortlessCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface PortlessCommandOptions {
  cwd?: string;
}

export interface PortlessCommandRunner {
  run(args: string[], options?: PortlessCommandOptions): PortlessCommandResult;
}

export interface PortlessAdapterOptions {
  projectRoot: string;
  statePath?: string;
  runner?: PortlessCommandRunner;
  now?: () => string;
}

export interface PortlessRouteContext {
  project: string;
  routePattern?: string;
  issue?: number | string;
  branch?: string;
  worktree?: string;
}

export interface EnsurePortlessRouteOptions extends PortlessRouteContext {
  port: number;
  force?: boolean;
}

export interface CleanupPortlessRoutesOptions {
  issue?: number | string;
}

export interface PortlessResolvedRoute {
  name: string;
  host: string;
  url: string;
}

export interface PortlessOwnedRoute extends PortlessResolvedRoute {
  port: number;
  project: string;
  issue?: string;
  branch?: string;
  worktree?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortlessRoutesState {
  version: 1;
  routes: PortlessOwnedRoute[];
}

export interface PortlessActiveRoute {
  name: string;
  port?: number;
  url?: string;
}

export type EnsurePortlessRouteResult =
  | {
      status: "created" | "updated";
      route: PortlessOwnedRoute;
      message: string;
    }
  | {
      status: "port-conflict";
      route: PortlessResolvedRoute;
      active: PortlessActiveRoute;
      message: string;
    }
  | {
      status: "service-missing";
      message: string;
    };

export type CleanupPortlessRoutesResult =
  | {
      status: "removed";
      removed: PortlessOwnedRoute[];
      message: string;
    }
  | {
      status: "empty";
      message: string;
    }
  | {
      status: "service-missing";
      message: string;
    };

export class PortlessAdapter {
  private readonly projectRoot: string;
  private readonly statePath: string;
  private readonly runner: PortlessCommandRunner;
  private readonly now: () => string;

  constructor(options: PortlessAdapterOptions) {
    this.projectRoot = options.projectRoot;
    this.statePath = options.statePath ?? join(options.projectRoot, ".sdlc", "routes.local.json");
    this.runner = options.runner ?? createPortlessCommandRunner();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  resolveRoute(context: PortlessRouteContext): PortlessResolvedRoute {
    return resolvePortlessRoute(context);
  }

  listOwnedRoutes(): PortlessOwnedRoute[] {
    return readRoutesState(this.statePath).routes;
  }

  ensureRoute(options: EnsurePortlessRouteOptions): EnsurePortlessRouteResult {
    assertValidPort(options.port);
    const route = resolvePortlessRoute(options);
    const active = this.listActiveRoutes();

    if (active.status === "service-missing") {
      return active;
    }

    const existingActive = active.routes.find((item) => item.name === route.name);
    if (existingActive?.port !== undefined && existingActive.port !== options.port && options.force !== true) {
      return {
        status: "port-conflict",
        route,
        active: existingActive,
        message: `Portless route '${route.name}' already points at port ${existingActive.port}. Stop that app, choose another route, or pass --force.`,
      };
    }

    const aliasArgs = ["alias", route.name, String(options.port)];
    if (options.force === true) {
      aliasArgs.push("--force");
    }
    const alias = this.runner.run(aliasArgs, { cwd: this.projectRoot });
    if (isMissingPortless(alias)) {
      return missingPortless();
    }
    if (isPortConflict(alias)) {
      return {
        status: "port-conflict",
        route,
        active: existingActive ?? { name: route.name },
        message: portConflictMessage(route.name, alias),
      };
    }
    if (alias.exitCode !== 0) {
      throw new Error(`portless alias failed: ${commandOutput(alias)}`);
    }

    const state = readRoutesState(this.statePath);
    const existingIndex = state.routes.findIndex((item) => item.name === route.name);
    const timestamp = this.now();
    const owned = ownedRouteFrom(route, options, timestamp, state.routes[existingIndex]);

    if (existingIndex === -1) {
      state.routes.push(owned);
      writeRoutesState(this.statePath, state);
      return {
        status: "created",
        route: owned,
        message: `Created Portless route ${owned.url} -> ${owned.port}.`,
      };
    }

    state.routes[existingIndex] = owned;
    writeRoutesState(this.statePath, state);
    return {
      status: "updated",
      route: owned,
      message: `Updated Portless route ${owned.url} -> ${owned.port}.`,
    };
  }

  cleanupRoutes(options: CleanupPortlessRoutesOptions = {}): CleanupPortlessRoutesResult {
    const state = readRoutesState(this.statePath);
    const issue = options.issue === undefined ? undefined : String(options.issue);
    const targets = issue === undefined ? state.routes : state.routes.filter((route) => route.issue === issue);

    if (targets.length === 0) {
      return {
        status: "empty",
        message: issue === undefined ? "No owned Portless routes to clean up." : `No owned Portless routes found for issue ${issue}.`,
      };
    }

    for (const route of targets) {
      const result = this.runner.run(["alias", "--remove", route.name], { cwd: this.projectRoot });
      if (isMissingPortless(result)) {
        return missingPortless();
      }
      if (result.exitCode !== 0 && !isMissingRoute(result)) {
        throw new Error(`portless alias --remove failed for ${route.name}: ${commandOutput(result)}`);
      }
    }

    const remaining = state.routes.filter((route) => !targets.some((target) => target.name === route.name));
    writeRoutesState(this.statePath, { version: 1, routes: remaining });
    return {
      status: "removed",
      removed: targets,
      message: `Removed ${targets.length} owned Portless route${targets.length === 1 ? "" : "s"}.`,
    };
  }

  private listActiveRoutes(): { status: "found"; routes: PortlessActiveRoute[] } | { status: "service-missing"; message: string } {
    const result = this.runner.run(["list"], { cwd: this.projectRoot });
    if (isMissingPortless(result)) {
      return missingPortless();
    }
    if (result.exitCode !== 0) {
      throw new Error(`portless list failed: ${commandOutput(result)}`);
    }
    return { status: "found", routes: parsePortlessList(result.stdout) };
  }
}

export function resolvePortlessRoute(context: PortlessRouteContext): PortlessResolvedRoute {
  const pattern = context.routePattern ?? `${context.project}-issue-{issue}.localhost`;
  const host = normalizeHost(renderRoutePattern(pattern, context));
  const name = routeNameFromHost(host);

  return {
    name,
    host,
    url: `https://${host}`,
  };
}

export function parsePortlessList(output: string): PortlessActiveRoute[] {
  const trimmed = output.trim();
  if (trimmed === "") {
    return [];
  }

  const parsed = parseJsonRoutes(trimmed);
  if (parsed) {
    return parsed;
  }

  return trimmed
    .split(/\r?\n/)
    .flatMap((line) => parseTextRoute(line))
    .filter((route): route is PortlessActiveRoute => route !== undefined);
}

export function createPortlessCommandRunner(): PortlessCommandRunner {
  return {
    run(args, options = {}) {
      try {
        const result = Bun.spawnSync(["portless", ...args], {
          ...spawnCwdOption(options.cwd),
          stdout: "pipe",
          stderr: "pipe",
        });

        return {
          exitCode: result.exitCode,
          stdout: decodeOutput(result.stdout),
          stderr: decodeOutput(result.stderr),
        };
      } catch (error) {
        return {
          exitCode: 127,
          stdout: "",
          stderr: toErrorMessage(error),
        };
      }
    },
  };
}

function renderRoutePattern(pattern: string, context: PortlessRouteContext): string {
  return pattern.replace(/\{([a-z_]+)\}/g, (_match, key: string) => {
    switch (key) {
      case "project":
        return slug(context.project, "project");
      case "issue":
        if (context.issue === undefined) {
          throw new Error("local.route_pattern uses {issue}, but no issue was provided.");
        }
        return slug(String(context.issue), "issue");
      case "branch":
        if (!context.branch) {
          throw new Error("local.route_pattern uses {branch}, but no branch was provided.");
        }
        return slug(context.branch, "branch");
      case "worktree":
        if (!context.worktree) {
          throw new Error("local.route_pattern uses {worktree}, but no worktree was provided.");
        }
        return slug(context.worktree, "worktree");
      default:
        throw new Error(`Unsupported local.route_pattern placeholder: {${key}}.`);
    }
  });
}

function normalizeHost(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error("local.route_pattern must render a non-empty host.");
  }

  const withoutProtocol = trimmed.includes("://") ? new URL(trimmed).host : trimmed;
  if (withoutProtocol.includes("/")) {
    throw new Error("local.route_pattern must render a host, not a URL path.");
  }

  const host = withoutProtocol.toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(host) || host.includes("..")) {
    throw new Error(`local.route_pattern rendered an invalid hostname: ${host}`);
  }
  return host;
}

function routeNameFromHost(host: string): string {
  return host.endsWith(".localhost") ? host.slice(0, -".localhost".length) : host;
}

function slug(value: string, label: string): string {
  const slugged = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (slugged === "") {
    throw new Error(`${label} must contain at least one hostname-safe character.`);
  }
  return slugged;
}

function readRoutesState(path: string): PortlessRoutesState {
  if (!existsSync(path)) {
    return { version: 1, routes: [] };
  }

  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.routes)) {
    throw new Error(`${path} must contain a version 1 Portless routes state object.`);
  }

  return {
    version: 1,
    routes: parsed.routes.flatMap((route) => (isOwnedRoute(route) ? [route] : [])),
  };
}

function writeRoutesState(path: string, state: PortlessRoutesState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}

function ownedRouteFrom(
  route: PortlessResolvedRoute,
  options: EnsurePortlessRouteOptions,
  timestamp: string,
  existing?: PortlessOwnedRoute,
): PortlessOwnedRoute {
  const owned: PortlessOwnedRoute = {
    ...route,
    port: options.port,
    project: options.project,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  if (options.issue !== undefined) {
    owned.issue = String(options.issue);
  }
  if (options.branch) {
    owned.branch = options.branch;
  }
  if (options.worktree) {
    owned.worktree = options.worktree;
  }

  return owned;
}

function parseJsonRoutes(output: string): PortlessActiveRoute[] | undefined {
  try {
    const parsed = JSON.parse(output) as unknown;
    const rawRoutes = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.routes)
        ? parsed.routes
        : undefined;

    if (!rawRoutes) {
      return undefined;
    }

    return rawRoutes.flatMap((route) => {
      if (!isRecord(route)) {
        return [];
      }
      const name = stringValue(route.name) ?? nameFromUrl(stringValue(route.url));
      if (!name) {
        return [];
      }
      const active: PortlessActiveRoute = { name };
      const port = numberValue(route.port) ?? numberValue(route.targetPort) ?? portFromUrl(stringValue(route.target));
      const url = stringValue(route.url);
      if (port !== undefined) {
        active.port = port;
      }
      if (url) {
        active.url = url;
      }
      return [active];
    });
  } catch {
    return undefined;
  }
}

function parseTextRoute(line: string): PortlessActiveRoute | undefined {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.toLowerCase().includes("no active routes")) {
    return undefined;
  }

  const urlMatch = trimmed.match(/https?:\/\/([a-z0-9.-]+)(?::\d+)?/i);
  const name = urlMatch?.[1] ? routeNameFromHost(urlMatch[1].toLowerCase()) : trimmed.split(/\s+/)[0];
  if (!name || name === "name" || name.startsWith("-")) {
    return undefined;
  }

  const portMatch = trimmed.match(/(?:localhost|127\.0\.0\.1|:|port\s+)(\d{2,5})\b/i);
  const active: PortlessActiveRoute = { name };
  if (portMatch?.[1]) {
    active.port = Number(portMatch[1]);
  }
  if (urlMatch?.[0]) {
    active.url = urlMatch[0];
  }
  return active;
}

function nameFromUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  try {
    return routeNameFromHost(new URL(url).host.toLowerCase());
  } catch {
    return undefined;
  }
}

function portFromUrl(url: string | undefined): number | undefined {
  if (!url) {
    return undefined;
  }
  const match = url.match(/:(\d{2,5})\b/);
  return match?.[1] ? Number(match[1]) : undefined;
}

function assertValidPort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Portless route port must be an integer between 1 and 65535.");
  }
}

function isMissingPortless(result: PortlessCommandResult): boolean {
  if (result.exitCode === 127) {
    return true;
  }
  return /command not found|enoent|cannot find portless|portless: not found|proxy.*not running/i.test(commandOutput(result));
}

function missingPortless(): { status: "service-missing"; message: string } {
  return {
    status: "service-missing",
    message: "Portless is not available. Install it globally or set local.provider: none when local routes are not required.",
  };
}

function isPortConflict(result: PortlessCommandResult): boolean {
  return /eaddrinuse|already in use|already points|address in use|port conflict/i.test(commandOutput(result));
}

function portConflictMessage(name: string, result: PortlessCommandResult): string {
  return `Portless could not register '${name}' because the route or port is already in use. Stop the conflicting app, choose another route, or pass --force. ${commandOutput(result)}`;
}

function isMissingRoute(result: PortlessCommandResult): boolean {
  return /no such route|not registered|not found/i.test(commandOutput(result));
}

function commandOutput(result: PortlessCommandResult): string {
  return [result.stderr, result.stdout].map((value) => value.trim()).filter(Boolean).join("\n");
}

function isOwnedRoute(value: unknown): value is PortlessOwnedRoute {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.name === "string" &&
    typeof value.host === "string" &&
    typeof value.url === "string" &&
    typeof value.port === "number" &&
    typeof value.project === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function spawnCwdOption(cwd: string | undefined): { cwd?: string } {
  return cwd === undefined ? {} : { cwd };
}

function decodeOutput(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
