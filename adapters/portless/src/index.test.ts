import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  PortlessAdapter,
  parsePortlessList,
  resolvePortlessRoute,
  type PortlessCommandOptions,
  type PortlessCommandResult,
  type PortlessCommandRunner,
} from "./index";

describe("PortlessAdapter", () => {
  test("resolves deterministic route names from manifest patterns", () => {
    const route = resolvePortlessRoute({
      project: "Example App",
      issue: 9,
      branch: "codex/9-portless-route",
      routePattern: "{project}-issue-{issue}-{branch}.localhost",
    });

    expect(route).toEqual({
      name: "example-app-issue-9-codex-9-portless-route",
      host: "example-app-issue-9-codex-9-portless-route.localhost",
      url: "https://example-app-issue-9-codex-9-portless-route.localhost",
    });
  });

  test("requires values used by route pattern placeholders", () => {
    expect(() =>
      resolvePortlessRoute({
        project: "demo",
        routePattern: "issue-{issue}.demo.localhost",
      }),
    ).toThrow("no issue was provided");
  });

  test("creates a portless alias and tracks the owned route state", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-portless-"));
    const runner = createRunner([
      result("[]"),
      result("registered"),
    ]);
    const adapter = new PortlessAdapter({
      projectRoot,
      runner,
      now: () => "2026-05-10T00:00:00.000Z",
    });

    const created = adapter.ensureRoute({
      project: "demo",
      issue: 9,
      port: 4321,
      routePattern: "demo-issue-{issue}.localhost",
    });

    expect(created.status).toBe("created");
    expect(runner.calls.map((call) => call.args)).toEqual([
      ["list"],
      ["alias", "demo-issue-9", "4321"],
    ]);
    const statePath = join(projectRoot, ".sdlc", "routes.local.json");
    expect(existsSync(statePath)).toBe(true);
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({
      version: 1,
      routes: [
        {
          name: "demo-issue-9",
          host: "demo-issue-9.localhost",
          url: "https://demo-issue-9.localhost",
          port: 4321,
          project: "demo",
          issue: "9",
          createdAt: "2026-05-10T00:00:00.000Z",
          updatedAt: "2026-05-10T00:00:00.000Z",
        },
      ],
    });
  });

  test("reports route port conflicts with an actionable message", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-portless-"));
    const runner = createRunner([
      result(JSON.stringify({ routes: [{ name: "demo-issue-9", port: 3000 }] })),
    ]);
    const adapter = new PortlessAdapter({ projectRoot, runner });

    const conflict = adapter.ensureRoute({
      project: "demo",
      issue: 9,
      port: 4321,
      routePattern: "demo-issue-{issue}.localhost",
    });

    expect(conflict.status).toBe("port-conflict");
    expect(conflict.message).toContain("already points at port 3000");
    expect(conflict.message).toContain("pass --force");
    expect(runner.calls.map((call) => call.args)).toEqual([["list"]]);
  });

  test("reports missing portless without throwing", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-portless-"));
    const runner = createRunner([result("", "portless: command not found", 127)]);
    const adapter = new PortlessAdapter({ projectRoot, runner });

    const status = adapter.ensureRoute({
      project: "demo",
      issue: 9,
      port: 4321,
      routePattern: "demo-issue-{issue}.localhost",
    });

    expect(status.status).toBe("service-missing");
    expect(status.message).toContain("Portless is not available");
  });

  test("cleanup removes only owned routes from local state", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-portless-"));
    const statePath = join(projectRoot, ".sdlc", "routes.local.json");
    mkdirSync(join(projectRoot, ".sdlc"));
    writeFileSync(
      statePath,
      JSON.stringify({
        version: 1,
        routes: [
          {
            name: "demo-issue-9",
            host: "demo-issue-9.localhost",
            url: "https://demo-issue-9.localhost",
            port: 4321,
            project: "demo",
            issue: "9",
            createdAt: "2026-05-10T00:00:00.000Z",
            updatedAt: "2026-05-10T00:00:00.000Z",
          },
          {
            name: "demo-issue-10",
            host: "demo-issue-10.localhost",
            url: "https://demo-issue-10.localhost",
            port: 4322,
            project: "demo",
            issue: "10",
            createdAt: "2026-05-10T00:00:00.000Z",
            updatedAt: "2026-05-10T00:00:00.000Z",
          },
        ],
      }),
    );
    const runner = createRunner([result("removed")]);
    const adapter = new PortlessAdapter({ projectRoot, runner });

    const cleanup = adapter.cleanupRoutes({ issue: 9 });

    expect(cleanup.status).toBe("removed");
    expect(runner.calls.map((call) => call.args)).toEqual([["alias", "--remove", "demo-issue-9"]]);
    expect(JSON.parse(readFileSync(statePath, "utf8")).routes.map((route: { name: string }) => route.name)).toEqual([
      "demo-issue-10",
    ]);
  });

  test("cleanup drops stale owned routes when Portless already forgot them", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sdlc-kit-portless-"));
    const statePath = join(projectRoot, ".sdlc", "routes.local.json");
    mkdirSync(join(projectRoot, ".sdlc"));
    writeFileSync(
      statePath,
      JSON.stringify({
        version: 1,
        routes: [
          {
            name: "demo-issue-9",
            host: "demo-issue-9.localhost",
            url: "https://demo-issue-9.localhost",
            port: 4321,
            project: "demo",
            issue: "9",
            createdAt: "2026-05-10T00:00:00.000Z",
            updatedAt: "2026-05-10T00:00:00.000Z",
          },
        ],
      }),
    );
    const runner = createRunner([result("", "route not found", 1)]);
    const adapter = new PortlessAdapter({ projectRoot, runner });

    const cleanup = adapter.cleanupRoutes();

    expect(cleanup.status).toBe("removed");
    expect(JSON.parse(readFileSync(statePath, "utf8")).routes).toEqual([]);
  });
});

describe("parsePortlessList", () => {
  test("parses json and text output", () => {
    expect(parsePortlessList(JSON.stringify({ routes: [{ name: "app", port: 3000 }] }))).toEqual([
      { name: "app", port: 3000 },
    ]);
    expect(parsePortlessList("https://demo.localhost -> http://127.0.0.1:4321")).toEqual([
      {
        name: "demo",
        url: "https://demo.localhost",
        port: 4321,
      },
    ]);
  });
});

interface MockRunner extends PortlessCommandRunner {
  calls: Array<{ args: string[]; options?: PortlessCommandOptions }>;
}

function createRunner(results: PortlessCommandResult[]): MockRunner {
  const calls: MockRunner["calls"] = [];

  return {
    calls,
    run(args, options) {
      calls.push(options === undefined ? { args } : { args, options });
      return results.shift() ?? result("");
    },
  };
}

function result(stdout = "", stderr = "", exitCode = 0): PortlessCommandResult {
  return { exitCode, stdout, stderr };
}
