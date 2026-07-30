import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ConversionDiagnostic } from "../src/diagnostics.js";
import type { ConvertContext, SharedContext } from "../src/core.js";
import { buildNames, escapePointer, jsonLiteral, propertyKey, sanitizeIdentifier, unescapePointer } from "../src/emit.js";
import { convertParameter, convertResponse } from "../src/components.js";
import { convertOperations } from "../src/operations.js";
import { componentHasCycle, convertSchema, findCycleEdges } from "../src/schema.js";
import { loadOpenApiDocument } from "../src/loader.js";

function shared(diagnostics: ConversionDiagnostic[] = []): SharedContext & { securityNames: Map<string, string> } {
  return {
    components: {},
    schemas: {},
    names: {
      schemaNames: new Map(),
      typeNames: new Map(),
      operationNames: new Map(),
      order: new Map(),
    },
    cycles: new Set(),
    dialect: "3.1",
    helpers: new Set(),
    diagnostics,
    options: {
      outputMode: "singleFile",
      outputFileName: "schemas.ts",
      schemaNamePrefix: "",
      schemaNameSuffix: "Schema",
      operationNamePrefix: "",
      operationNameSuffix: "Operation",
      includeInferredTypes: true,
      includeRouteMap: true,
      includeOperationTypes: true,
      includeSecurityValidators: true,
      includeDocumentMetadata: true,
      strictObjects: false,
      mediaTypes: ["application/json"],
      includeDeprecated: true,
      includeDefaultValues: false,
      onUnsupported: "warn",
    },
    securityNames: new Map(),
  };
}

describe("internal emit helpers", () => {
  it("sanitizes names and reports collisions deterministically", () => {
    const diagnostics: ConversionDiagnostic[] = [];
    const names = buildNames(["user-id", "user_id"], {
      ...shared().options,
      schemaNameSuffix: "",
    }, diagnostics);

    expect(sanitizeIdentifier("class")).toBe("Schemaclass");
    expect(names.schemaNames.get("user-id")).toBe("userid");
    expect(names.schemaNames.get("user_id")).toBe("user_id");
    expect(diagnostics).toEqual([]);
  });

  it("quotes property keys and emits stable JSON literals", () => {
    expect(propertyKey("validName")).toBe("validName");
    expect(propertyKey("default")).toBe("\"default\"");
    expect(escapePointer("a/b~c")).toBe("a~1b~0c");
    expect(unescapePointer("a~1b~0c")).toBe("a/b~c");
    expect(jsonLiteral({ b: 2, a: true })).toBe("{ \"a\": true, \"b\": 2 }");
  });
});

function schemaConvertContext(diagnostics: ConversionDiagnostic[] = []): ConvertContext {
  const s = shared(diagnostics);
  return {
    path: "#/components/schemas/Root",
    schemas: {},
    names: s.names,
    cycles: s.cycles,
    dialect: s.dialect,
    helpers: s.helpers,
    customFormatsUsed: new Set(),
    diagnostics: s.diagnostics,
    options: s.options,
    inProperty: false,
    depth: { current: 0 },
  };
}

function deeplyNestedSchema(depth: number): unknown {
  let schema: Record<string, unknown> = { type: "string" };
  for (let index = 0; index < depth; index += 1) {
    schema = { type: "array", items: schema };
  }
  return schema;
}

describe("internal schema helpers", () => {
  it("detects cyclic component references", () => {
    const cycles = findCycleEdges({
      Node: {
        type: "object",
        properties: {
          parent: { $ref: "#/components/schemas/Node" },
        },
      },
    });

    expect(cycles.has("Node->Node")).toBe(true);
    expect(componentHasCycle("Node", cycles)).toBe(true);
  });

  it("detects every edge in a multi-node reference cycle", () => {
    const cycles = findCycleEdges({
      A: { type: "object", properties: { b: { $ref: "#/components/schemas/B" } } },
      B: { type: "object", properties: { c: { $ref: "#/components/schemas/C" } } },
      C: { type: "object", properties: { a: { $ref: "#/components/schemas/A" } } },
    });

    expect(cycles.has("A->B")).toBe(true);
    expect(cycles.has("B->C")).toBe(true);
    expect(cycles.has("C->A")).toBe(true);
  });

  it("does not flag acyclic references as cycles", () => {
    const cycles = findCycleEdges({
      A: { type: "object", properties: { b: { $ref: "#/components/schemas/B" } } },
      B: { type: "object", properties: { value: { type: "string" } } },
    });

    expect(cycles.size).toBe(0);
  });

  it("emits a diagnostic instead of crashing on pathologically deep schemas", () => {
    const diagnostics: ConversionDiagnostic[] = [];
    const context = schemaConvertContext(diagnostics);

    // The guard trips at the deepest nesting level and degrades that branch to
    // z.unknown() rather than growing the call stack further; the point is that it
    // returns at all (no stack overflow) and reports a diagnostic.
    const expression = convertSchema(deeplyNestedSchema(1000), context);

    expect(expression.startsWith("z.array(")).toBe(true);
    expect(expression.includes("z.unknown()")).toBe(true);
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: "invalid.schema" }));
  });

  it("does not trip the depth guard for reasonably nested schemas", () => {
    const diagnostics: ConversionDiagnostic[] = [];
    const context = schemaConvertContext(diagnostics);

    const expression = convertSchema(deeplyNestedSchema(20), context);

    expect(expression.startsWith("z.array(")).toBe(true);
    expect(diagnostics.some((item) => item.code === "invalid.schema")).toBe(false);
  });
});

describe("loader error handling", () => {
  it("wraps malformed JSON parse errors with the file path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openapi-zod-"));
    const file = join(dir, "spec.json");
    try {
      await writeFile(file, "{ not valid json", "utf8");
      await expect(loadOpenApiDocument(file)).rejects.toThrow(/spec\.json/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("wraps malformed YAML parse errors with the file path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openapi-zod-"));
    const file = join(dir, "spec.yaml");
    try {
      await writeFile(file, "key: [unterminated", "utf8");
      await expect(loadOpenApiDocument(file)).rejects.toThrow(/spec\.yaml/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("internal OpenAPI conversion helpers", () => {
  it("derives operation names and diagnostics for missing operationId", () => {
    const diagnostics: ConversionDiagnostic[] = [];
    const result = convertOperations({
      paths: {
        "/users/{id}": {
          get: {
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: { "200": { description: "OK" } },
          },
        },
      },
    }, shared(diagnostics));

    expect(result.exportNames).toEqual(["getUsersIdOperation"]);
    expect(diagnostics).toContainEqual(expect.objectContaining({
      code: "ambiguous.operationId",
      path: "#/paths/~1users~1{id}/get",
    }));
  });

  it("reports a missing reusable parameter reference target", () => {
    const diagnostics: ConversionDiagnostic[] = [];
    const result = convertParameter(
      { $ref: "#/components/parameters/Missing" },
      "#/paths/~1users/get/parameters/0",
      shared(diagnostics),
    );

    expect(result.schema).toBe("z.unknown().optional()");
    expect(diagnostics).toContainEqual(expect.objectContaining({
      code: "invalid.ref",
      path: "#/paths/~1users/get/parameters/0/$ref",
    }));
  });

  it("reports an external reference on a reusable parameter as unsupported", () => {
    const diagnostics: ConversionDiagnostic[] = [];
    const result = convertParameter(
      { $ref: "external.yaml#/components/parameters/Limit" },
      "#/paths/~1users/get/parameters/0",
      shared(diagnostics),
    );

    expect(result.schema).toBe("z.unknown().optional()");
    expect(diagnostics).toContainEqual(expect.objectContaining({
      code: "unsupported.externalRef",
      path: "#/paths/~1users/get/parameters/0/$ref",
    }));
  });

  it("reports unsupported configured media types in responses", () => {
    const diagnostics: ConversionDiagnostic[] = [];
    const expression = convertResponse({
      description: "OK",
      content: {
        "text/plain": { schema: { type: "string" } },
      },
    }, "#/components/responses/Plain", shared(diagnostics));

    expect(expression).toBe("{\n  description: \"OK\",\n}");
    expect(diagnostics).toContainEqual(expect.objectContaining({
      code: "unsupported.mediaType",
      path: "#/components/responses/Plain/content",
    }));
  });
});
