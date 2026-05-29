import type { ConversionDiagnostic } from "./diagnostics.js";
import { asRecord } from "./emit.js";

export type ConvertOpenApiToZodOptions = {
  outputMode?: "singleFile";
  outputFileName?: string;
  schemaNamePrefix?: string;
  schemaNameSuffix?: string;
  operationNamePrefix?: string;
  operationNameSuffix?: string;
  includeInferredTypes?: boolean;
  includeRouteMap?: boolean;
  includeOperationTypes?: boolean;
  includeSecurityValidators?: boolean;
  includeDocumentMetadata?: boolean;
  strictObjects?: boolean;
  mediaTypes?: string[];
  includeDeprecated?: boolean;
  includeDefaultValues?: boolean;
  onUnsupported?: "warn" | "error";
};

export type ResolvedOptions = Required<ConvertOpenApiToZodOptions>;
export type SchemaMap = Record<string, unknown>;
export type SchemaDialect = "3.0" | "3.1" | "unknown";
export type HelperName =
  | "literal"
  | "oneOf"
  | "uniqueItems"
  | "propertyNames"
  | "patternProperties"
  | "contains"
  | "conditional"
  | "dependentRequired"
  | "dependentSchemas";
export type NameMaps = {
  schemaNames: Map<string, string>;
  typeNames: Map<string, string>;
  operationNames: Map<string, string>;
  order: Map<string, number>;
};

export const httpMethods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;
export type HttpMethod = (typeof httpMethods)[number];

export function openApiDialect(value: unknown): SchemaDialect {
  if (typeof value === "string" && value.startsWith("3.0.")) return "3.0";
  if (typeof value === "string" && value.startsWith("3.1.")) return "3.1";
  return "unknown";
}

export type ConvertContext = {
  path: string;
  componentName?: string;
  schemas: SchemaMap;
  names: NameMaps;
  cycles: Set<string>;
  dialect: SchemaDialect;
  helpers: Set<HelperName>;
  diagnostics: ConversionDiagnostic[];
  options: ResolvedOptions;
  inProperty: boolean;
};

export function resolveOptions(options: ConvertOpenApiToZodOptions): ResolvedOptions {
  return {
    outputMode: options.outputMode ?? "singleFile",
    outputFileName: options.outputFileName ?? "schemas.ts",
    schemaNamePrefix: options.schemaNamePrefix ?? "",
    schemaNameSuffix: options.schemaNameSuffix ?? "Schema",
    operationNamePrefix: options.operationNamePrefix ?? "",
    operationNameSuffix: options.operationNameSuffix ?? "Operation",
    includeInferredTypes: options.includeInferredTypes ?? true,
    includeRouteMap: options.includeRouteMap ?? true,
    includeOperationTypes: options.includeOperationTypes ?? true,
    includeSecurityValidators: options.includeSecurityValidators ?? true,
    includeDocumentMetadata: options.includeDocumentMetadata ?? true,
    strictObjects: options.strictObjects ?? false,
    mediaTypes: options.mediaTypes ?? ["application/json"],
    includeDeprecated: options.includeDeprecated ?? true,
    includeDefaultValues: options.includeDefaultValues ?? false,
    onUnsupported: options.onUnsupported ?? "warn",
  };
}

export function getSchemas(documentObject: Record<string, unknown> | undefined): SchemaMap {
  const components = asRecord(documentObject?.components);
  const schemas = asRecord(components?.schemas);
  return schemas ?? {};
}

export type SharedContext = {
  components: Record<string, unknown>;
  schemas: SchemaMap;
  names: NameMaps;
  cycles: Set<string>;
  dialect: SchemaDialect;
  helpers: Set<HelperName>;
  diagnostics: ConversionDiagnostic[];
  options: ResolvedOptions;
  reusableNames?: ReusableNames;
};

export type ReusableNames = {
  parameterNames: Map<string, string>;
  requestBodyNames: Map<string, string>;
  responseNames: Map<string, string>;
  headerNames: Map<string, string>;
  securityNames: Map<string, string>;
};

export type ReusableResult = {
  lines: string[];
} & ReusableNames;

export function isSupportedOpenApiVersion(value: unknown): boolean {
  return typeof value === "string" && (value.startsWith("3.0.") || value.startsWith("3.1."));
}
