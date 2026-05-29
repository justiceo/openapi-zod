import { describe, expect, it } from "vitest";
import type { ConversionDiagnostic } from "../src/diagnostics.js";
import type { SharedContext } from "../src/core.js";
import { buildNames, escapePointer, jsonLiteral, propertyKey, sanitizeIdentifier, unescapePointer } from "../src/emit.js";
import { convertResponse } from "../src/components.js";
import { convertOperations } from "../src/operations.js";
import { componentHasCycle, findCycleEdges } from "../src/schema.js";

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
