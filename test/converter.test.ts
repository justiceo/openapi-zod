import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { loadOpenApiDocument } from "../src/loader.js";
import { convertOpenApiToZod } from "../src/index.js";

const execFileAsync = promisify(execFile);
const fixtures = [
  "empty",
  "primitives",
  "objects",
  "refs",
  "composition",
  "operations",
  "reusable",
  "diagnostics",
  "versions",
  "defaults",
  "advanced",
  "metadata-advanced",
  "recursive-realworld",
  "inline-realworld",
  "polymorphism-realworld",
  "nullable-realworld",
  "serialization-realworld",
  "media-types-realworld",
  "refs-invalid-realworld",
  "names-realworld",
] as const;

async function readFixture(name: string, file: string): Promise<string> {
  return readFile(join("test", "fixtures", name, file), "utf8");
}

describe("fixture conversion", () => {
  for (const fixture of fixtures) {
    it(`matches ${fixture}`, async () => {
      const document = await loadOpenApiDocument(
        join("test", "fixtures", fixture, "openapi.yaml"),
      );
      const expected = (await readFixture(fixture, "expected.ts")).trimEnd() + "\n";
      const diagnostics = JSON.parse(await readFixture(fixture, "diagnostics.json"));

      const result = convertOpenApiToZod(document);

      expect(result.outputs).toEqual([{ path: "schemas.ts", contents: expected }]);
      expect(result.diagnostics).toEqual(diagnostics);
    });
  }

  it("promotes unsupported diagnostics when requested", async () => {
    const document = await loadOpenApiDocument(
      join("test", "fixtures", "diagnostics", "openapi.yaml"),
    );

    const result = convertOpenApiToZod(document, { onUnsupported: "error" });

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      level: "error",
      code: "unsupported.mediaType",
    }));
  });

  it("omits generated default values unless requested", async () => {
    const document = await loadOpenApiDocument(
      join("test", "fixtures", "operations", "openapi.yaml"),
    );

    const compact = convertOpenApiToZod(document);
    const verbose = convertOpenApiToZod(document, { includeDefaultValues: true });

    expect(compact.outputs[0].contents).not.toContain("deprecated: false");
    expect(compact.outputs[0].contents).not.toContain("cookies: z.object({})");
    expect(compact.outputs[0].contents).not.toContain("headers: z.object({}),");
    expect(verbose.outputs[0].contents).toContain("deprecated: false");
    expect(verbose.outputs[0].contents).toContain("cookies: z.object({})");
    expect(verbose.outputs[0].contents).toContain("headers: z.object({}),");
  });

  it("matches library output from the CLI", async () => {
    const fixture = "primitives";
    const document = await loadOpenApiDocument(
      join("test", "fixtures", fixture, "openapi.yaml"),
    );
    const expected = convertOpenApiToZod(document);
    const dir = await mkdtemp(join(tmpdir(), "openapi-zod-"));

    try {
      await execFileAsync("npx", [
        "tsx",
        "src/cli.ts",
        "--input",
        join("test", "fixtures", fixture, "openapi.yaml"),
        "--output",
        dir,
      ]);
      const contents = await readFile(join(dir, "schemas.ts"), "utf8");
      expect(contents).toBe(expected.outputs[0].contents);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("applies CLI output and generation flags", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openapi-zod-"));

    try {
      await execFileAsync("npx", [
        "tsx",
        "src/cli.ts",
        "--input",
        join("test", "fixtures", "reusable", "openapi.yaml"),
        "--output",
        dir,
        "--output-file",
        "custom.ts",
        "--no-types",
        "--no-route-map",
        "--no-operation-types",
        "--no-security-validators",
        "--no-metadata",
      ]);
      const contents = await readFile(join(dir, "custom.ts"), "utf8");
      expect(contents).not.toContain("openApiMetadata");
      expect(contents).not.toContain("export type ");
      expect(contents).not.toContain("export const routes");
      expect(contents).not.toContain("ApiKeyAuthSecurity");
      expect(contents).toContain("export const readItemOperation");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("applies the CLI include-default-values flag", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openapi-zod-"));

    try {
      await execFileAsync("npx", [
        "tsx",
        "src/cli.ts",
        "--input",
        join("test", "fixtures", "operations", "openapi.yaml"),
        "--output",
        dir,
        "--include-default-values",
      ]);
      const contents = await readFile(join(dir, "schemas.ts"), "utf8");
      expect(contents).toContain("deprecated: false");
      expect(contents).toContain("cookies: z.object({})");
      expect(contents).toContain("headers: z.object({}),");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("prints CLI help", async () => {
    const result = await execFileAsync("npx", ["tsx", "src/cli.ts", "--help"]);

    expect(result.stdout).toContain("Usage: openapi-zod --input <path> --output <dir>");
    expect(result.stdout).toContain("--include-default-values");
    expect(result.stdout).toContain("--fail-on-warning");
    expect(result.stderr).toBe("");
  });

  it("prints CLI version", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    const result = await execFileAsync("npx", ["tsx", "src/cli.ts", "--version"]);

    expect(result.stdout.trim()).toBe(packageJson.version);
    expect(result.stderr).toBe("");
  });

  it("reports missing CLI flag values", async () => {
    await expect(execFileAsync("npx", [
      "tsx",
      "src/cli.ts",
      "--input",
      "--output",
      "generated",
    ])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("--input requires a value"),
    });
  });

  it("reports unknown CLI arguments", async () => {
    await expect(execFileAsync("npx", [
      "tsx",
      "src/cli.ts",
      "--wat",
    ])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("Unknown argument: --wat"),
    });
  });

  it("reports missing required CLI input and output", async () => {
    await expect(execFileAsync("npx", [
      "tsx",
      "src/cli.ts",
    ])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("--input is required"),
    });

    await expect(execFileAsync("npx", [
      "tsx",
      "src/cli.ts",
      "--input",
      join("test", "fixtures", "empty", "openapi.yaml"),
    ])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("--output is required"),
    });
  });

  it("fails the CLI on warnings when requested", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openapi-zod-"));

    try {
      await expect(execFileAsync("npx", [
        "tsx",
        "src/cli.ts",
        "--input",
        join("test", "fixtures", "empty", "openapi.yaml"),
        "--output",
        dir,
        "--fail-on-warning",
      ])).rejects.toMatchObject({
        code: 1,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("emits TypeScript that compiles for route-heavy fixtures", async () => {
    const dir = await mkdtemp(join(process.cwd(), ".generated-"));
    const generatedFiles: string[] = [];

    try {
      for (const fixture of fixtures) {
        const document = await loadOpenApiDocument(
          join("test", "fixtures", fixture, "openapi.yaml"),
        );
        const result = convertOpenApiToZod(document, {
          outputFileName: `${fixture}.ts`,
        });
        const generatedFile = join(dir, `${fixture}.ts`);
        generatedFiles.push(generatedFile);
        await writeFile(generatedFile, result.outputs[0].contents, "utf8");
      }

      await execFileAsync("npx", [
        "tsc",
        "--noEmit",
        "--strict",
        "--target",
        "ES2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        ...generatedFiles,
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("generates getRoute for runtime route matching and validation", async () => {
    const document = {
      openapi: "3.1.0",
      info: { title: "Routes", version: "1.0.0" },
      paths: {
        "/status": {
          get: {
            operationId: "getStatus",
            responses: { "204": { description: "OK" } },
          },
        },
        "/users/me": {
          get: {
            operationId: "getMe",
            responses: { "204": { description: "OK" } },
          },
        },
        "/users/{userId}": {
          get: {
            operationId: "getUser",
            parameters: [
              {
                name: "userId",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
              },
              {
                name: "includePosts",
                in: "query",
                schema: { type: "boolean" },
              },
              {
                name: "X-Request-Id",
                in: "header",
                schema: { type: "string" },
              },
              {
                name: "session",
                in: "cookie",
                schema: { type: "string" },
              },
            ],
            responses: { "204": { description: "OK" } },
          },
        },
        "/users/{userId}/profile": {
          post: {
            operationId: "updateProfile",
            parameters: [
              {
                name: "userId",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
              },
            ],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["displayName"],
                    properties: { displayName: { type: "string" } },
                  },
                },
              },
            },
            responses: { "204": { description: "OK" } },
          },
        },
      },
    };
    const result = convertOpenApiToZod(document, { outputFileName: "routes.ts" });
    const dir = await mkdtemp(join(process.cwd(), ".generated-"));
    const generatedFile = join(dir, "routes.ts");
    const runnerFile = join(dir, "run.ts");

    expect(result.outputs[0].contents).toContain("export type RouteOperation =");
    expect(result.outputs[0].contents).toContain("const routeMatcher = buildRouteMatcher(routes);");
    expect(result.outputs[0].contents).not.toContain("routesMap");

    try {
      await writeFile(generatedFile, result.outputs[0].contents, "utf8");
      await writeFile(runnerFile, `
        import { getRoute } from "./routes.js";

        const userId = "123e4567-e89b-12d3-a456-426614174000";
        const dynamic = await getRoute({
          method: "GET",
          url: "https://api.example.test/users/" + userId + "?includePosts=true",
          headers: { "X-Request-Id": "req-1", Cookie: "session=abc" },
        });
        if (!dynamic.success) throw new Error("dynamic route did not match");
        if (dynamic.operation.operationId !== "getUser") throw new Error("wrong dynamic operation");
        if ((dynamic.params as { userId: string }).userId !== userId) throw new Error("path params were not decoded");
        if ((dynamic.query as { includePosts: boolean }).includePosts !== true) throw new Error("query was not coerced");
        if ((dynamic.headers as { "x-request-id": string })["x-request-id"] !== "req-1") throw new Error("headers were not normalized");
        if ((dynamic.cookies as { session: string }).session !== "abc") throw new Error("cookie header fallback failed");

        const literal = await getRoute({ method: "get", url: "/users/me" });
        if (!literal.success || literal.operation.operationId !== "getMe") throw new Error("literal route did not win");

        const exact = await getRoute({ method: "GET", url: "/status" });
        if (!exact.success || exact.operation.operationId !== "getStatus") throw new Error("static route did not match");

        const express = await getRoute({
          method: "post",
          path: "/users/" + userId + "/profile",
          query: {},
          headers: { "content-type": "application/json" },
          cookies: { session: "parsed" },
          body: { displayName: "Ada" },
        });
        if (!express.success || express.operation.operationId !== "updateProfile") throw new Error("express route did not validate");
        if ((express.body as { displayName: string }).displayName !== "Ada") throw new Error("express body was not used");

        const parsedBody = await getRoute({
          method: "post",
          url: "/users/" + userId + "/profile",
          headers: {},
          json: async () => ({ displayName: "Grace" }),
        });
        if (!parsedBody.success || (parsedBody.body as { displayName: string }).displayName !== "Grace") throw new Error("fetch json body was not parsed");

        const skippedBody = await getRoute({
          method: "post",
          url: "/users/" + userId + "/profile",
          headers: {},
          json: async () => ({ displayName: "Grace" }),
        }, { readBody: false });
        if (skippedBody.success || skippedBody.error.code !== "validation" || skippedBody.error.location !== "body") throw new Error("readBody=false did not skip parsing");

        const invalidUuid = await getRoute({ method: "GET", url: "/users/not-a-uuid" });
        if (invalidUuid.success || invalidUuid.error.code !== "validation" || invalidUuid.error.location !== "params") throw new Error("invalid uuid did not fail params validation");

        const notFound = await getRoute({ method: "DELETE", url: "/users/" + userId });
        if (notFound.success || notFound.error.code !== "notFound") throw new Error("unknown route did not return notFound");

        const badBody = await getRoute({
          method: "post",
          url: "/users/" + userId + "/profile",
          headers: {},
          json: async () => { throw new Error("bad json"); },
        });
        if (badBody.success || badBody.error.code !== "body") throw new Error("body parser failure did not return body error");
      `, "utf8");

      await execFileAsync("npx", ["tsx", runnerFile]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runtime-validates helper-backed advanced schemas", async () => {
    const document = await loadOpenApiDocument(
      join("test", "fixtures", "advanced", "openapi.yaml"),
    );
    const result = convertOpenApiToZod(document, {
      outputFileName: "advanced.ts",
    });
    const dir = await mkdtemp(join(process.cwd(), ".generated-"));
    const generatedFile = join(dir, "advanced.ts");
    const runnerFile = join(dir, "run.ts");

    try {
      await writeFile(generatedFile, result.outputs[0].contents, "utf8");
      await writeFile(runnerFile, `
        import {
          ConditionalValueSchema,
          ContactChoiceSchema,
          ContainsNumberSchema,
          PatternedMapSchema,
          UniqueDeepSchema,
        } from "./advanced.js";

        const checks = [
          ConditionalValueSchema.safeParse({ mode: "strict", strictValue: "yes" }).success,
          !ConditionalValueSchema.safeParse({ mode: "strict", relaxedValue: "no" }).success,
          ContactChoiceSchema.safeParse({ email: "a@example.com" }).success,
          !ContactChoiceSchema.safeParse({ email: "a@example.com", phone: "555" }).success,
          ContainsNumberSchema.safeParse([1, 2, 2.5]).success,
          !ContainsNumberSchema.safeParse([1.5, 2.5]).success,
          PatternedMapSchema.safeParse({ "x-count": 1 }).success,
          !PatternedMapSchema.safeParse({ "X-count": 1 }).success,
          UniqueDeepSchema.safeParse([{ id: "a" }, { id: "b" }]).success,
          !UniqueDeepSchema.safeParse([{ id: "a" }, { id: "a" }]).success,
        ];

        if (checks.some((check) => !check)) {
          throw new Error("Advanced helper validation failed");
        }
      `, "utf8");

      await execFileAsync("npx", ["tsx", runnerFile]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runtime-validates real-world polymorphism helpers", async () => {
    const document = await loadOpenApiDocument(
      join("test", "fixtures", "polymorphism-realworld", "openapi.yaml"),
    );
    const result = convertOpenApiToZod(document, {
      outputFileName: "polymorphism.ts",
    });
    const dir = await mkdtemp(join(process.cwd(), ".generated-"));
    const generatedFile = join(dir, "polymorphism.ts");
    const runnerFile = join(dir, "run.ts");

    try {
      await writeFile(generatedFile, result.outputs[0].contents, "utf8");
      await writeFile(runnerFile, `
        import { EventSchema, SearchResultSchema } from "./polymorphism.js";

        const checks = [
          EventSchema.safeParse({
            type: "user.created",
            user: { id: "user-1", email: "a@example.com" },
          }).success,
          EventSchema.safeParse({ type: "user.deleted", id: "user-1" }).success,
          !EventSchema.safeParse({ type: "user.deleted", user: { id: "user-1" } }).success,
          SearchResultSchema.safeParse({ cursor: "next" }).success,
        ];

        if (checks.some((check) => !check)) {
          throw new Error("Polymorphism helper validation failed");
        }
      `, "utf8");

      await execFileAsync("npx", ["tsx", runnerFile]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
