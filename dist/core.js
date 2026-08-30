import { asRecord } from "./emit.js";
export const httpMethods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
export function openApiDialect(value) {
    if (typeof value === "string" && value.startsWith("3.0.")) {
        return "3.0";
    }
    if (typeof value === "string" && value.startsWith("3.1.")) {
        return "3.1";
    }
    return "unknown";
}
// A schema graph this deep either has a modeling problem or is adversarial input;
// either way we'd rather emit a diagnostic than let the process stack-overflow.
export const MAX_SCHEMA_DEPTH = 300;
export function resolveOptions(options) {
    return {
        outputMode: options.outputMode ?? "multiFile",
        outputFileName: options.outputFileName ?? "schemas.ts",
        schemaNamePrefix: options.schemaNamePrefix ?? "",
        schemaNameSuffix: options.schemaNameSuffix ?? "Schema",
        operationNamePrefix: options.operationNamePrefix ?? "",
        operationNameSuffix: options.operationNameSuffix ?? "Operation",
        includeInferredTypes: options.includeInferredTypes ?? true,
        includeRouteMap: options.includeRouteMap ?? true,
        includeClient: options.includeClient ?? false,
        includeOperationTypes: options.includeOperationTypes ?? true,
        includeSecurityValidators: options.includeSecurityValidators ?? true,
        includeDocumentMetadata: options.includeDocumentMetadata ?? true,
        strictObjects: options.strictObjects ?? false,
        mediaTypes: options.mediaTypes ?? ["application/json"],
        includeDeprecated: options.includeDeprecated ?? true,
        includeDefaultValues: options.includeDefaultValues ?? false,
        onUnsupported: options.onUnsupported ?? "warn",
        customFormats: options.customFormats ?? {},
    };
}
export function getSchemas(documentObject) {
    const components = asRecord(documentObject?.components);
    const schemas = asRecord(components?.schemas);
    return schemas ?? {};
}
export function isSupportedOpenApiVersion(value) {
    return typeof value === "string" && (value.startsWith("3.0.") || value.startsWith("3.1."));
}
