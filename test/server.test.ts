import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type * as z from "zod";
import { convertOpenApiToZod } from "../src/index.js";
import { loadOpenApiDocument } from "../src/loader.js";

const execFileAsync = promisify(execFile);
const userId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

interface ServerResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}
// Handlers are loosely typed here; the generated types themselves are covered by the tsc test below.
// biome-ignore lint/suspicious/noExplicitAny: runtime tests register handlers with ad-hoc parameter types
type LooseHandler = (...args: any[]) => unknown;
type Registrar = ((handler: LooseHandler) => void) & { raw(handler: LooseHandler): void };
interface GeneratedServer {
  route: Record<string, Registrar>;
  fetch(request: Request): Promise<Response>;
  handle(request: unknown): Promise<ServerResult>;
  inject(name: string, overrides?: Record<string, unknown>): Promise<ServerResult>;
}
interface OperationShape {
  request: Record<string, unknown>;
  responses: Record<string, { content?: Record<string, z.ZodType> } | undefined>;
}
interface GeneratedModule {
  createServer(options?: Record<string, unknown>): GeneratedServer;
  createClient(config: {
    baseUrl: string;
    fetch: typeof fetch;
  }): Record<string, (input?: unknown) => Promise<{ success: boolean; status: number; data: unknown }>>;
  serverOperations: Record<string, OperationShape>;
  serverExamples: Record<string, { request: Record<string, unknown>; responses: Record<string, { body?: unknown }> }>;
}

// Generated inside the project tree (not os.tmpdir()) so the bare "zod" import resolves via node_modules.
const generatedDir = join(process.cwd(), `.generated-server-${process.pid}`);

async function loadGenerated(fixture: string, options: { includeClient?: boolean } = {}): Promise<GeneratedModule> {
  const document = await loadOpenApiDocument(join("test", "fixtures", fixture, "openapi.yaml"));
  const result = convertOpenApiToZod(document, { outputMode: "singleFile", includeServer: true, ...options });
  const file = join(generatedDir, `${fixture}-${options.includeClient ? "client" : "plain"}.mts`);
  await writeFile(file, result.outputs[0].contents, "utf8");
  return (await import(pathToFileURL(file).href)) as GeneratedModule;
}

beforeAll(async () => {
  await mkdir(generatedDir, { recursive: true });
});

afterAll(async () => {
  await rm(generatedDir, { recursive: true, force: true });
});

describe("generated server stub (runtime)", () => {
  it("answers 501 for operations without a handler", async () => {
    const { createServer } = await loadGenerated("operations");
    const response = await createServer().fetch(new Request(`http://api.test/users/${userId}`));

    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({
      code: "notImplemented",
      message: "Operation getUser is not implemented.",
      operationId: "getUser",
    });
  });

  it("passes parsed input to a plain handler and sends its result with the primary 2xx status", async () => {
    const { createServer } = await loadGenerated("operations");
    const server = createServer();
    let seen: unknown;
    server.route.getUser(async (input: Record<string, unknown>, ctx: Record<string, unknown>) => {
      seen = { input, method: ctx.method, path: ctx.path, rawHeaders: ctx.rawHeaders };
      return { id: userId, email: "a@example.com" };
    });

    const response = await server.fetch(
      new Request(`http://api.test/users/${userId}?includePosts=true`, {
        headers: { "X-Request-Id": "abc", "x-extra": "1" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toEqual({ id: userId, email: "a@example.com" });
    expect(seen).toMatchObject({
      input: { params: { userId }, query: { includePosts: true }, headers: { "x-request-id": "abc" } },
      method: "GET",
      path: `/users/${userId}`,
      rawHeaders: { "x-extra": "1" },
    });
  });

  it("lets a plain handler pick another status with ctx.reply", async () => {
    const { createServer } = await loadGenerated("operations");
    const server = createServer();
    server.route.getUser((_input: unknown, { reply }: { reply: (...args: unknown[]) => unknown }) =>
      reply(404, { message: "missing" }, { "x-reason": "gone" }),
    );

    const result = await server.inject("getUser");

    expect(result).toEqual({
      status: 404,
      headers: { "content-type": "application/json", "x-reason": "gone" },
      body: { message: "missing" },
    });
  });

  it("runs raw handlers with the full typed request and sends their explicit reply", async () => {
    const { createServer } = await loadGenerated("operations");
    const server = createServer();
    let seen: Record<string, unknown> = {};
    server.route.updateUser.raw((req: Record<string, unknown>) => {
      seen = req;
      return { status: 204 };
    });

    const response = await server.fetch(
      new Request(`http://api.test/users/${userId}`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: "session=s1" },
        body: JSON.stringify({ id: userId, email: "a@example.com" }),
      }),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(seen.params).toEqual({ userId });
    expect(seen.body).toEqual({ id: userId, email: "a@example.com" });
    expect(seen.raw).toBeInstanceOf(Request);
    expect((seen.rawHeaders as Record<string, unknown>).cookie).toBe("session=s1");
  });

  it("maps routing, validation, and body-parse failures to 404/400", async () => {
    const { createServer } = await loadGenerated("operations");
    const server = createServer();

    const notFound = await server.fetch(new Request("http://api.test/nowhere"));
    expect(notFound.status).toBe(404);

    const invalid = await server.fetch(new Request("http://api.test/users/not-a-uuid"));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: "validation", location: "params", operationId: "getUser" });

    const malformed = await server.fetch(
      new Request(`http://api.test/users/${userId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ code: "body" });
  });

  it("turns handler errors into 500s, or into onError's result", async () => {
    const { createServer } = await loadGenerated("operations");
    const failing = () => {
      throw new Error("boom");
    };

    const server = createServer();
    server.route.getUser(failing);
    expect(await server.inject("getUser")).toMatchObject({ status: 500, body: { code: "internal" } });

    const custom = createServer({
      onError: (error: Error) => ({ status: 503, headers: {}, body: { message: error.message } }),
    });
    custom.route.getUser(failing);
    expect(await custom.inject("getUser")).toMatchObject({ status: 503, body: { message: "boom" } });
  });

  it("validates replies against the response schema when validateResponses is set", async () => {
    const { createServer } = await loadGenerated("operations");
    const server = createServer({ validateResponses: true });
    server.route.getUser(() => ({ id: "not-a-uuid", email: "a@example.com" }));

    const result = await server.inject("getUser");

    expect(result.status).toBe(500);
    expect(result.body).toMatchObject({ code: "response", operationId: "getUser" });
    expect((result.body as { issues: { path: unknown[] }[] }).issues[0]!.path).toEqual(["body", "id"]);
  });

  it("serves example responses for unregistered operations in mock mode", async () => {
    const { createServer, serverExamples } = await loadGenerated("operations");
    const server = createServer({ mock: true });

    expect(await server.inject("getUser")).toMatchObject({
      status: 200,
      body: serverExamples.getUser!.responses["200"]!.body,
    });
    expect(await server.inject("updateUser")).toMatchObject({ status: 204, body: undefined });
  });

  it("merges inject overrides into the example request", async () => {
    const { createServer } = await loadGenerated("operations");
    const server = createServer();
    server.route.updateUser.raw((req: { body: unknown }) => ({
      status: 204,
      headers: { "x-echo": JSON.stringify(req.body) },
    }));

    const result = await server.inject("updateUser", { body: { id: userId, email: "b@example.com" } });

    expect(result.status).toBe(204);
    expect(JSON.parse(result.headers["x-echo"]!)).toEqual({ id: userId, email: "b@example.com" });
  });

  it("accepts framework-style request objects through handle()", async () => {
    const { createServer } = await loadGenerated("operations");
    const server = createServer();
    server.route.updateUser(
      ({ body }: { body: { email: string } }, { reply }: { reply: (status: number) => unknown }) =>
        body.email === "a@example.com" ? reply(204) : undefined,
    );

    const result = await server.handle({
      method: "POST",
      url: `/users/${userId}`,
      headers: { "content-type": "application/json" },
      body: { id: userId, email: "a@example.com" },
    });

    expect(result).toEqual({ status: 204, headers: {}, body: undefined });
  });

  it("round-trips the generated client through server.fetch", async () => {
    const { createServer, createClient } = await loadGenerated("operations", { includeClient: true });
    const server = createServer();
    server.route.getUser(({ params }: { params: { userId: string } }) => ({
      id: params.userId,
      email: "a@example.com",
    }));
    const client = createClient({
      baseUrl: "http://api.test",
      fetch: ((input: RequestInfo | URL, init?: RequestInit) => server.fetch(new Request(input, init))) as typeof fetch,
    });

    const result = await client.getUser!({ params: { userId } });

    expect(result).toMatchObject({ success: true, status: 200, data: { id: userId, email: "a@example.com" } });
  });
});

describe("generated server examples", () => {
  it("produce requests and responses that satisfy their schemas across fixtures", async () => {
    const fixtures = (await readdir(join("test", "fixtures"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const failures: string[] = [];
    let checked = 0;

    for (const fixture of fixtures) {
      const { serverOperations, serverExamples } = await loadGenerated(fixture);
      for (const [name, operation] of Object.entries(serverOperations)) {
        const example = serverExamples[name]!;
        for (const part of ["params", "query", "headers", "cookies", "body"]) {
          const schema = operation.request[part] as z.ZodType | undefined;
          if (!schema || typeof schema.safeParse !== "function") {
            continue;
          }
          checked += 1;
          if (!schema.safeParse(example.request[part] ?? {}).success && part !== "body") {
            failures.push(`${fixture}.${name}.request.${part}`);
          } else if (part === "body" && !schema.safeParse(example.request.body).success) {
            failures.push(`${fixture}.${name}.request.body`);
          }
        }
        for (const [status, response] of Object.entries(operation.responses)) {
          const schema = response?.content?.["application/json"];
          if (!schema) {
            continue;
          }
          checked += 1;
          if (!schema.safeParse(example.responses[status]?.body).success) {
            failures.push(`${fixture}.${name}.responses.${status}`);
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(50);
    expect(failures).toEqual([]);
  });
});

describe("generated server types", () => {
  it("type-checks handler inputs and replies against the operation", async () => {
    const dir = join(generatedDir, "types");
    const document = await loadOpenApiDocument(join("test", "fixtures", "operations", "openapi.yaml"));
    const result = convertOpenApiToZod(document, { includeServer: true });
    const files: string[] = [];
    for (const output of result.outputs) {
      const file = join(dir, output.path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, output.contents, "utf8");
      files.push(file);
    }
    const usage = join(dir, "api", "usage.ts");
    await writeFile(
      usage,
      `import { createServer, serverExamples } from "./server";

const server = createServer();
server.route.getUser(async ({ params, query, headers }, { reply }) => {
  const id: string = params.userId;
  const include: boolean | undefined = query.includePosts;
  const requestId: string | undefined = headers["x-request-id"];
  void include;
  void requestId;
  if (id === "missing") return reply(404, { message: "not found" });
  return { id, email: "a@example.com" };
});
// @ts-expect-error a 2xx body must match the User schema
server.route.getUser(() => ({ id: 1 }));
// @ts-expect-error the default response body requires message
server.route.getUser((_input, { reply }) => reply(500, { nope: true }));
server.route.getUser.raw((req) =>
  req.params.userId === "x" ? { status: 404, body: { message: "missing" } } : { status: 200, body: { id: "x", email: "a@example.com" }, headers: { etag: "v1" } },
);
// @ts-expect-error a reply body must match a declared response (200: User, default: Error)
server.route.getUser.raw(() => ({ status: 200, body: { nope: true } }));
server.route.updateUser(({ body }, { reply }) => {
  const email: string = body.email;
  void email;
  return reply(204);
});
// @ts-expect-error unknown operations have no route
void server.route.deleteUser;
// @ts-expect-error inject only accepts known operations
void server.inject("deleteUser");
const exampleId: string = serverExamples.getUser.request.params.userId;
void exampleId;
`,
      "utf8",
    );
    files.push(usage);

    await execFileAsync(join(process.cwd(), "node_modules", ".bin", "tsc"), [
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--target",
      "ES2022",
      "--module",
      "ESNext",
      "--moduleResolution",
      "bundler",
      ...files,
    ]);
  });
});
