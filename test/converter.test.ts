import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "bun:test";
import { convertOpenApiToZod } from "../src/index.js";
import { loadOpenApiDocument } from "../src/loader.js";

const execFileAsync = promisify(execFile);
// todo: use the pattern in scripts/generate-fixtures.mjs which discovers fixtures by scanning test/fixtures/*, for consistency.
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
  "petstore",
] as const;

async function readFixture(name: string, file: string): Promise<string> {
  return readFile(join("test", "fixtures", name, file), "utf8");
}

describe("fixture conversion", () => {
  for (const fixture of fixtures) {
    it(`matches ${fixture} in multi-file mode`, async () => {
      const document = await loadOpenApiDocument(join("test", "fixtures", fixture, "openapi.yaml"));
      const expectedSchema = `${(await readFixture(fixture, "expected-schema.ts")).trimEnd()}\n`;
      const expectedOperations = `${(await readFixture(fixture, "expected-operations.ts")).trimEnd()}\n`;
      const expectedRouter = `${(await readFixture(fixture, "expected-router.ts")).trimEnd()}\n`;
      const diagnostics = JSON.parse(await readFixture(fixture, "diagnostics.json"));

      const result = convertOpenApiToZod(document);

      expect(result.outputs).toEqual([
        { path: "api/schema.ts", contents: expectedSchema },
        { path: "api/operations.ts", contents: expectedOperations },
        { path: "api/router.ts", contents: expectedRouter },
      ]);
      expect(result.diagnostics).toEqual(diagnostics);
    });

    it(`matches ${fixture} in single-file mode`, async () => {
      const document = await loadOpenApiDocument(join("test", "fixtures", fixture, "openapi.yaml"));
      const expected = `${(await readFixture(fixture, "expected.ts")).trimEnd()}\n`;
      const diagnostics = JSON.parse(await readFixture(fixture, "diagnostics.json"));

      const result = convertOpenApiToZod(document, { outputMode: "singleFile" });

      expect(result.outputs).toEqual([{ path: "schemas.ts", contents: expected }]);
      expect(result.diagnostics).toEqual(diagnostics);
    });
  }

  const clientFixtures = ["operations", "petstore"] as const;
  for (const fixture of clientFixtures) {
    it(`matches ${fixture} api/client.ts when includeClient is true`, async () => {
      const document = await loadOpenApiDocument(join("test", "fixtures", fixture, "openapi.yaml"));
      const expectedClient = `${(await readFixture(fixture, "expected-client.ts")).trimEnd()}\n`;

      const result = convertOpenApiToZod(document, { includeClient: true });

      const clientOutput = result.outputs.find((output) => output.path === "api/client.ts");
      expect(clientOutput?.contents).toEqual(expectedClient);
    });
  }

  it("omits api/client.ts unless includeClient is true", async () => {
    const document = await loadOpenApiDocument(join("test", "fixtures", "operations", "openapi.yaml"));

    const result = convertOpenApiToZod(document);

    expect(result.outputs.some((output) => output.path === "api/client.ts")).toBe(false);
  });

  it("applies the CLI --include-client flag", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openapi-zod-"));

    try {
      await execFileAsync("bun", [
        "src/cli.ts",
        "--input",
        join("test", "fixtures", "operations", "openapi.yaml"),
        "--output",
        dir,
        "--include-client",
      ]);
      const contents = await readFile(join(dir, "api", "client.ts"), "utf8");
      expect(contents).toContain("export async function getUser(");
      expect(contents).toContain("export function createClient(config: ClientConfig)");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("promotes unsupported diagnostics when requested", async () => {
    const document = await loadOpenApiDocument(join("test", "fixtures", "diagnostics", "openapi.yaml"));

    const result = convertOpenApiToZod(document, { onUnsupported: "error" });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        level: "error",
        code: "unsupported.mediaType",
      }),
    );
  });

  it("omits generated default values unless requested", async () => {
    const document = await loadOpenApiDocument(join("test", "fixtures", "operations", "openapi.yaml"));

    const compact = convertOpenApiToZod(document);
    const verbose = convertOpenApiToZod(document, { includeDefaultValues: true });
    const compactContents = compact.outputs.map((output) => output.contents).join("\n");
    const verboseContents = verbose.outputs.map((output) => output.contents).join("\n");

    expect(compactContents).not.toContain("deprecated: false");
    expect(compactContents).not.toContain("cookies: z.object({})");
    expect(compactContents).not.toContain("headers: z.object({}),");
    expect(verboseContents).toContain("deprecated: false");
    expect(verboseContents).toContain("cookies: z.object({})");
    expect(verboseContents).toContain("headers: z.object({}),");
  });

  it("matches library output from the CLI", async () => {
    const fixture = "primitives";
    const document = await loadOpenApiDocument(join("test", "fixtures", fixture, "openapi.yaml"));
    const expected = convertOpenApiToZod(document);
    const dir = await mkdtemp(join(tmpdir(), "openapi-zod-"));

    try {
      await execFileAsync("bun", [
        "src/cli.ts",
        "--input",
        join("test", "fixtures", fixture, "openapi.yaml"),
        "--output",
        dir,
      ]);
      for (const output of expected.outputs) {
        const contents = await readFile(join(dir, output.path), "utf8");
        expect(contents).toBe(output.contents);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("prefixes generated output with an auto-generated banner", async () => {
    const document = await loadOpenApiDocument(join("test", "fixtures", "primitives", "openapi.yaml"));
    const result = convertOpenApiToZod(document);
    for (const output of result.outputs) {
      expect(output.contents.startsWith("// AUTO-GENERATED FILE. DO NOT EDIT.\n\n")).toBe(true);
    }
  });

  it("applies CLI output and generation flags", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openapi-zod-"));

    try {
      await execFileAsync("bun", [
        "src/cli.ts",
        "--input",
        join("test", "fixtures", "reusable", "openapi.yaml"),
        "--output",
        dir,
        "--single-file",
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
      await execFileAsync("bun", [
        "src/cli.ts",
        "--input",
        join("test", "fixtures", "operations", "openapi.yaml"),
        "--output",
        dir,
        "--single-file",
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
    const result = await execFileAsync("bun", ["src/cli.ts", "--help"]);

    expect(result.stdout).toContain("Usage: openapi-zod --input <path> --output <dir>");
    expect(result.stdout).toContain("--include-default-values");
    expect(result.stdout).toContain("--include-client");
    expect(result.stdout).toContain("--custom-format <value>");
    expect(result.stdout).toContain("--fail-on-warning");
    expect(result.stderr).toBe("");
  });

  it("registers a custom format from the CLI flag", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openapi-zod-"));

    try {
      const inputFile = join(dir, "openapi.yaml");
      await writeFile(
        inputFile,
        `
openapi: 3.1.0
info:
  title: Custom Format CLI
  version: 1.0.0
paths: {}
components:
  schemas:
    Severity:
      type: string
      format: custom-severity
`,
        "utf8",
      );
      await execFileAsync("bun", [
        "src/cli.ts",
        "--input",
        inputFile,
        "--output",
        dir,
        "--single-file",
        "--custom-format",
        "custom-severity=./severity.js#severityFormat",
      ]);
      const contents = await readFile(join(dir, "schemas.ts"), "utf8");
      expect(contents).toContain('import { severityFormat } from "./severity.js";');
      expect(contents).toContain("z.string().transform((value, ctx) => severityFormat(value, ctx))");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects a malformed --custom-format value", async () => {
    await expect(
      execFileAsync("bun", [
        "src/cli.ts",
        "--input",
        join("test", "fixtures", "empty", "openapi.yaml"),
        "--output",
        "generated",
        "--custom-format",
        "not-valid",
      ]),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("--custom-format must be name=module#import"),
    });
  });

  it("prints CLI version", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    const result = await execFileAsync("bun", ["src/cli.ts", "--version"]);

    expect(result.stdout.trim()).toBe(packageJson.version);
    expect(result.stderr).toBe("");
  });

  it("reports missing CLI flag values", async () => {
    await expect(execFileAsync("bun", ["src/cli.ts", "--input", "--output", "generated"])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("--input requires a value"),
    });
  });

  it("reports unknown CLI arguments", async () => {
    await expect(execFileAsync("bun", ["src/cli.ts", "--wat"])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("Unknown argument: --wat"),
    });
  });

  it("reports missing required CLI input and output", async () => {
    await expect(execFileAsync("bun", ["src/cli.ts"])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("--input is required"),
    });

    await expect(
      execFileAsync("bun", ["src/cli.ts", "--input", join("test", "fixtures", "empty", "openapi.yaml")]),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("--output is required"),
    });
  });

  it("fails the CLI on warnings when requested", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openapi-zod-"));

    try {
      await expect(
        execFileAsync("bun", [
          "src/cli.ts",
          "--input",
          join("test", "fixtures", "empty", "openapi.yaml"),
          "--output",
          dir,
          "--fail-on-warning",
        ]),
      ).rejects.toMatchObject({
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
        const document = await loadOpenApiDocument(join("test", "fixtures", fixture, "openapi.yaml"));
        const result = convertOpenApiToZod(document);
        for (const output of result.outputs) {
          const generatedFile = join(dir, fixture, output.path);
          await mkdir(dirname(generatedFile), { recursive: true });
          generatedFiles.push(generatedFile);
          await writeFile(generatedFile, output.contents, "utf8");
        }

        const withClient = convertOpenApiToZod(document, { includeClient: true });
        const clientOutput = withClient.outputs.find((output) => output.path === "api/client.ts");
        if (clientOutput) {
          const generatedFile = join(dir, fixture, "client", "api", "client.ts");
          await mkdir(dirname(generatedFile), { recursive: true });
          generatedFiles.push(generatedFile);
          await writeFile(generatedFile, clientOutput.contents, "utf8");
          for (const output of withClient.outputs) {
            if (output.path === "api/schema.ts" || output.path === "api/operations.ts") {
              const dependencyFile = join(dir, fixture, "client", output.path);
              await mkdir(dirname(dependencyFile), { recursive: true });
              generatedFiles.push(dependencyFile);
              await writeFile(dependencyFile, output.contents, "utf8");
            }
          }
        }
      }

      await execFileAsync("npx", [
        "tsc",
        "--noEmit",
        "--strict",
        "--target",
        "ES2022",
        "--module",
        "ESNext",
        "--moduleResolution",
        "bundler",
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
    const result = convertOpenApiToZod(document, { outputMode: "singleFile", outputFileName: "routes.ts" });
    const dir = await mkdtemp(join(process.cwd(), ".generated-"));
    const generatedFile = join(dir, "routes.ts");
    const runnerFile = join(dir, "run.ts");

    expect(result.outputs[0].contents).toContain("export type RouteOperation =");
    expect(result.outputs[0].contents).toContain("const routeMatcher = buildRouteMatcher(routes);");
    expect(result.outputs[0].contents).not.toContain("routesMap");

    try {
      await writeFile(generatedFile, result.outputs[0].contents, "utf8");
      await writeFile(
        runnerFile,
        `
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
      `,
        "utf8",
      );

      await execFileAsync("bun", [runnerFile]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("generates getRoute for runtime route matching in multi-file mode", async () => {
    const document = {
      openapi: "3.1.0",
      info: { title: "Routes", version: "1.0.0" },
      components: {
        schemas: {
          Profile: {
            type: "object",
            required: ["displayName"],
            properties: { displayName: { type: "string" } },
          },
        },
      },
      paths: {
        "/users/{userId}/profile": {
          post: {
            operationId: "updateProfile",
            parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
            requestBody: {
              required: true,
              content: { "application/json": { schema: { $ref: "#/components/schemas/Profile" } } },
            },
            responses: { "204": { description: "OK" } },
          },
        },
      },
    };
    const result = convertOpenApiToZod(document);
    const dir = await mkdtemp(join(process.cwd(), ".generated-"));

    expect(result.outputs.map((output) => output.path)).toEqual([
      "api/schema.ts",
      "api/operations.ts",
      "api/router.ts",
    ]);

    try {
      for (const output of result.outputs) {
        const filePath = join(dir, output.path);
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, output.contents, "utf8");
      }
      const runnerFile = join(dir, "run.ts");
      await writeFile(
        runnerFile,
        `
        import { getRoute } from "./api/router.js";
        import { ProfileSchema } from "./api/schema.js";

        const userId = "123e4567-e89b-12d3-a456-426614174000";
        if (!ProfileSchema.safeParse({ displayName: "Ada" }).success) throw new Error("schema.ts export did not validate");

        const valid = await getRoute({
          method: "post",
          path: "/users/" + userId + "/profile",
          query: {},
          headers: { "content-type": "application/json" },
          body: { displayName: "Ada" },
        });
        if (!valid.success || valid.operation.operationId !== "updateProfile") throw new Error("multi-file route did not validate");
        if ((valid.body as { displayName: string }).displayName !== "Ada") throw new Error("multi-file body was not used");

        const invalid = await getRoute({
          method: "post",
          path: "/users/" + userId + "/profile",
          query: {},
          headers: { "content-type": "application/json" },
          body: {},
        });
        if (invalid.success) throw new Error("multi-file body validation did not reject missing field");
      `,
        "utf8",
      );

      await execFileAsync("bun", [runnerFile]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runtime-validates helper-backed advanced schemas", async () => {
    const document = await loadOpenApiDocument(join("test", "fixtures", "advanced", "openapi.yaml"));
    const result = convertOpenApiToZod(document, {
      outputMode: "singleFile",
      outputFileName: "advanced.ts",
    });
    const dir = await mkdtemp(join(process.cwd(), ".generated-"));
    const generatedFile = join(dir, "advanced.ts");
    const runnerFile = join(dir, "run.ts");

    try {
      await writeFile(generatedFile, result.outputs[0].contents, "utf8");
      await writeFile(
        runnerFile,
        `
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
      `,
        "utf8",
      );

      await execFileAsync("bun", [runnerFile]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runtime-validates real-world polymorphism helpers", async () => {
    const document = await loadOpenApiDocument(join("test", "fixtures", "polymorphism-realworld", "openapi.yaml"));
    const result = convertOpenApiToZod(document, {
      outputMode: "singleFile",
      outputFileName: "polymorphism.ts",
    });
    const dir = await mkdtemp(join(process.cwd(), ".generated-"));
    const generatedFile = join(dir, "polymorphism.ts");
    const runnerFile = join(dir, "run.ts");

    try {
      await writeFile(generatedFile, result.outputs[0].contents, "utf8");
      await writeFile(
        runnerFile,
        `
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
      `,
        "utf8",
      );

      await execFileAsync("bun", [runnerFile]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("custom formats", () => {
  const document = {
    openapi: "3.1.0",
    info: { title: "Custom Formats", version: "1.0.0" },
    paths: {},
    components: {
      schemas: {
        Contact: {
          type: "object",
          required: ["phone"],
          properties: {
            phone: { type: "string", format: "phone-number", "x-trim": true },
          },
        },
        DomainConfig: {
          type: "object",
          required: ["domain", "altDomain"],
          properties: {
            domain: {
              type: "string",
              format: "domain-name",
              "x-format-options": { rejectSubdomains: true },
            },
            altDomain: { type: "string", format: "domain-name" },
          },
        },
        Legacy: {
          type: "string",
          format: "not-registered",
        },
      },
    },
  };

  const customFormats = {
    "phone-number": { module: "../../utils/phone.js", import: "phoneNumberFormat" },
    "domain-name": { module: "../../utils/domain.js", import: "domainNameFormat" },
  };

  it("applies a registered custom format with no options", () => {
    const result = convertOpenApiToZod(document, { outputMode: "singleFile", customFormats });
    const contents = result.outputs[0].contents;

    expect(contents).toContain('import { phoneNumberFormat } from "../../utils/phone.js";');
    expect(contents).toContain("z.string().trim().transform((value, ctx) => phoneNumberFormat(value, ctx))");
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ path: "#/components/schemas/Contact/properties/phone/format" }),
    );
  });

  it("emits x-format-options as a literal third argument", () => {
    const result = convertOpenApiToZod(document, { outputMode: "singleFile", customFormats });
    const contents = result.outputs[0].contents;

    expect(contents).toContain(
      'z.string().transform((value, ctx) => domainNameFormat(value, ctx, { "rejectSubdomains": true }))',
    );
    expect(contents).toContain("z.string().transform((value, ctx) => domainNameFormat(value, ctx))");
  });

  it("deduplicates the import for a custom format used by multiple fields", () => {
    const result = convertOpenApiToZod(document, { outputMode: "singleFile", customFormats });
    const contents = result.outputs[0].contents;
    const occurrences = contents.split('import { domainNameFormat } from "../../utils/domain.js";').length - 1;

    expect(occurrences).toBe(1);
  });

  it("emits the custom format import into api/schema.ts in multi-file mode", () => {
    const result = convertOpenApiToZod(document, { customFormats });
    const schema = result.outputs.find((output) => output.path === "api/schema.ts")!;

    expect(schema.contents).toContain('import { phoneNumberFormat } from "../../utils/phone.js";');
    expect(schema.contents).toContain('import { domainNameFormat } from "../../utils/domain.js";');
  });

  it("still diagnoses an unregistered format as unsupported.format", () => {
    const result = convertOpenApiToZod(document, { outputMode: "singleFile", customFormats });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "unsupported.format", path: "#/components/schemas/Legacy/format" }),
    );
    expect(result.outputs[0].contents).toContain("export const LegacySchema = z.string();");
  });

  it("falls back to unsupported.format when customFormats is not provided", () => {
    const result = convertOpenApiToZod(document, { outputMode: "singleFile" });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "unsupported.format",
        path: "#/components/schemas/Contact/properties/phone/format",
      }),
    );
  });

  it("runtime-validates a registered custom format end to end", async () => {
    const result = convertOpenApiToZod(
      { ...document, components: { schemas: { Contact: document.components.schemas.Contact } } },
      {
        outputMode: "singleFile",
        outputFileName: "contact.ts",
        customFormats: { "phone-number": { module: "./utils/phone.js", import: "phoneNumberFormat" } },
      },
    );
    const dir = await mkdtemp(join(process.cwd(), ".generated-"));
    const utilsDir = join(dir, "utils");

    try {
      await mkdir(utilsDir, { recursive: true });
      await writeFile(
        join(utilsDir, "phone.ts"),
        `
        import type * as z from "zod";
        export function phoneNumberFormat(value: string, ctx: z.core.$RefinementCtx): string {
          if (!/^\\+1\\d{10}$/.test(value)) {
            ctx.addIssue({ code: "custom", message: "Invalid phone number." });
            return value;
          }
          return value;
        }
        `,
        "utf8",
      );
      await writeFile(join(dir, "contact.ts"), result.outputs[0].contents, "utf8");
      await writeFile(
        join(dir, "run.ts"),
        `
        import { ContactSchema } from "./contact.js";

        if (!ContactSchema.safeParse({ phone: "+15551234567" }).success) {
          throw new Error("valid phone number should parse");
        }
        if (ContactSchema.safeParse({ phone: "not-a-phone" }).success) {
          throw new Error("invalid phone number should not parse");
        }
        `,
        "utf8",
      );

      await execFileAsync("bun", [join(dir, "run.ts")]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not emit a custom format import into a file that never references it", () => {
    const result = convertOpenApiToZod(document, { customFormats });
    const operations = result.outputs.find((output) => output.path === "api/operations.ts")!;

    expect(operations.contents).not.toContain("phoneNumberFormat");
    expect(operations.contents).not.toContain("domainNameFormat");
  });

  it("emits a custom format import into api/operations.ts when only used inline there, and keeps it out of api/schema.ts", () => {
    const operationsDocument = {
      openapi: "3.1.0",
      info: { title: "Inline Custom Format", version: "1.0.0" },
      components: { schemas: {} },
      paths: {
        "/tickets": {
          post: {
            operationId: "createTicket",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["severity"],
                    properties: { severity: { type: "string", format: "ticket-severity" } },
                  },
                },
              },
            },
            responses: { "204": { description: "OK" } },
          },
        },
      },
    };
    const ticketFormats = { "ticket-severity": { module: "../../utils/severity.js", import: "severityFormat" } };

    const result = convertOpenApiToZod(operationsDocument, { customFormats: ticketFormats });
    const schema = result.outputs.find((output) => output.path === "api/schema.ts")!;
    const operations = result.outputs.find((output) => output.path === "api/operations.ts")!;

    expect(operations.contents).toContain('import { severityFormat } from "../../utils/severity.js";');
    expect(operations.contents).toContain("z.string().transform((value, ctx) => severityFormat(value, ctx))");
    expect(schema.contents).not.toContain("severityFormat");
  });

  it("diagnoses x-format-options that is not a plain object and omits the argument", () => {
    const invalidOptionsDocument = {
      openapi: "3.1.0",
      info: { title: "Invalid Options", version: "1.0.0" },
      paths: {},
      components: {
        schemas: {
          Bad: { type: "string", format: "domain-name", "x-format-options": "not-an-object" },
        },
      },
    };
    const result = convertOpenApiToZod(invalidOptionsDocument, { outputMode: "singleFile", customFormats });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        level: "error",
        code: "invalid.schema",
        path: "#/components/schemas/Bad/x-format-options",
      }),
    );
    expect(result.outputs[0].contents).toContain(
      "export const BadSchema = z.string().transform((value, ctx) => domainNameFormat(value, ctx));",
    );
  });

  it("diagnoses x-format-options that cannot be emitted safely and omits the argument", () => {
    const unsafeOptionsDocument = {
      openapi: "3.1.0",
      info: { title: "Unsafe Options", version: "1.0.0" },
      paths: {},
      components: {
        schemas: {
          Bad: { type: "string", format: "domain-name", "x-format-options": { threshold: Number.POSITIVE_INFINITY } },
        },
      },
    };
    const result = convertOpenApiToZod(unsafeOptionsDocument, { outputMode: "singleFile", customFormats });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        level: "error",
        code: "invalid.schema",
        path: "#/components/schemas/Bad/x-format-options",
      }),
    );
    expect(result.outputs[0].contents).toContain(
      "export const BadSchema = z.string().transform((value, ctx) => domainNameFormat(value, ctx));",
    );
  });

  it("lets a custom format override a built-in format name", () => {
    const overrideDocument = {
      openapi: "3.1.0",
      info: { title: "Override", version: "1.0.0" },
      paths: {},
      components: {
        schemas: { Address: { type: "string", format: "email" } },
      },
    };
    const result = convertOpenApiToZod(overrideDocument, {
      outputMode: "singleFile",
      customFormats: { email: { module: "../../utils/email.js", import: "emailFormat" } },
    });

    expect(result.outputs[0].contents).toContain(
      "export const AddressSchema = z.string().transform((value, ctx) => emailFormat(value, ctx));",
    );
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ code: "unsupported.format" }));
  });

  it("applies base string constraints before the transform call", () => {
    const constrainedDocument = {
      openapi: "3.1.0",
      info: { title: "Constrained", version: "1.0.0" },
      paths: {},
      components: {
        schemas: {
          Slug: {
            type: "string",
            format: "slug",
            minLength: 3,
            maxLength: 40,
            pattern: "^[a-z0-9-]+$",
          },
        },
      },
    };
    const result = convertOpenApiToZod(constrainedDocument, {
      outputMode: "singleFile",
      customFormats: { slug: { module: "../../utils/slug.js", import: "slugFormat" } },
    });

    expect(result.outputs[0].contents).toContain(
      'export const SlugSchema = z.string().min(3).max(40).regex(new RegExp("^[a-z0-9-]+$")).transform((value, ctx) => slugFormat(value, ctx));',
    );
  });

  it("registers multiple custom formats from repeated CLI flags", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openapi-zod-"));

    try {
      const inputFile = join(dir, "openapi.yaml");
      await writeFile(
        inputFile,
        `
openapi: 3.1.0
info:
  title: Multiple Custom Formats CLI
  version: 1.0.0
paths: {}
components:
  schemas:
    Phone:
      type: string
      format: phone-number
    Severity:
      type: string
      format: custom-severity
`,
        "utf8",
      );
      await execFileAsync("bun", [
        "src/cli.ts",
        "--input",
        inputFile,
        "--output",
        dir,
        "--single-file",
        "--custom-format",
        "phone-number=./phone.js#phoneFormat",
        "--custom-format",
        "custom-severity=./severity.js#severityFormat",
      ]);
      const contents = await readFile(join(dir, "schemas.ts"), "utf8");
      expect(contents).toContain('import { phoneFormat } from "./phone.js";');
      expect(contents).toContain('import { severityFormat } from "./severity.js";');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("built-in formats", () => {
  function convertFor(format: string, type: "string" | "integer" | "number" = "string") {
    const document = {
      openapi: "3.1.0",
      info: { title: "Built-in Formats", version: "1.0.0" },
      paths: {},
      components: { schemas: { Value: { type, format } } },
    };
    const result = convertOpenApiToZod(document, { outputMode: "singleFile" });
    return { contents: result.outputs[0].contents, diagnostics: result.diagnostics };
  }
  function schemaFor(format: string, type: "string" | "integer" | "number" = "string") {
    return convertFor(format, type).contents;
  }

  it.each([
    ["time", "z.iso.time()"],
    ["duration", "z.iso.duration()"],
    ["hostname", "z.hostname()"],
    ["ipv4", "z.ipv4()"],
    ["ipv6", "z.ipv6()"],
    ["byte", "z.base64()"],
    ["password", "z.string()"],
    ["binary", "z.string()"],
  ])("maps format %s to %s", (format, expected) => {
    const contents = schemaFor(format);
    expect(contents).toContain(`export const ValueSchema = ${expected};`);
  });

  it.each([
    ["idn-hostname"],
    ["idn-email"],
    ["uri-reference"],
    ["iri"],
    ["iri-reference"],
    ["uri-template"],
    ["json-pointer"],
    ["relative-json-pointer"],
  ])("emits a tagged z.stringFormat for %s without an unsupported.format diagnostic", (format) => {
    const { contents, diagnostics } = convertFor(format);
    expect(contents).toContain(`z.stringFormat("${format}", `);
    expect(diagnostics).not.toContainEqual(expect.objectContaining({ code: "unsupported.format" }));
  });

  it("validates that a regex format string is a syntactically valid regular expression", () => {
    const contents = schemaFor("regex");
    expect(contents).toContain(
      'z.string().refine((value) => { try { new RegExp(value); return true; } catch { return false; } }, "Invalid regular expression")',
    );
  });

  it("keeps int64 mapped to z.int() rather than a bigint-based validator", () => {
    const contents = schemaFor("int64", "integer");
    expect(contents).toContain("export const ValueSchema = z.int();");
  });

  it("maps int32/float/double to zod's precise numeric validators", () => {
    expect(schemaFor("int32", "integer")).toContain("export const ValueSchema = z.int32();");
    expect(schemaFor("float", "number")).toContain("export const ValueSchema = z.float32();");
    expect(schemaFor("double", "number")).toContain("export const ValueSchema = z.float64();");
  });

  it("still diagnoses a truly unknown format as unsupported.format", () => {
    const contents = schemaFor("not-a-real-format");
    expect(contents).toContain("export const ValueSchema = z.string();");
  });
});
