import type { ConversionDiagnostic } from "./diagnostics.js";
export interface ConvertOpenApiToZodOptions {
    outputMode?: "singleFile" | "multiFile";
    outputFileName?: string;
    schemaNamePrefix?: string;
    schemaNameSuffix?: string;
    operationNamePrefix?: string;
    operationNameSuffix?: string;
    includeInferredTypes?: boolean;
    includeRouteMap?: boolean;
    includeClient?: boolean;
    includeOperationTypes?: boolean;
    includeSecurityValidators?: boolean;
    includeDocumentMetadata?: boolean;
    strictObjects?: boolean;
    mediaTypes?: string[];
    includeDeprecated?: boolean;
    includeDefaultValues?: boolean;
    onUnsupported?: "warn" | "error";
    customFormats?: Record<string, CustomFormat>;
}
export interface CustomFormat {
    module: string;
    import: string;
}
export type ResolvedOptions = Required<ConvertOpenApiToZodOptions>;
export type SchemaMap = Record<string, unknown>;
export type SchemaDialect = "3.0" | "3.1" | "unknown";
export type HelperName = "literal" | "oneOf" | "uniqueItems" | "propertyNames" | "patternProperties" | "contains" | "conditional" | "dependentRequired" | "dependentSchemas";
export interface NameMaps {
    schemaNames: Map<string, string>;
    typeNames: Map<string, string>;
    operationNames: Map<string, string>;
    order: Map<string, number>;
}
export declare const httpMethods: readonly ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
export type HttpMethod = (typeof httpMethods)[number];
export declare function openApiDialect(value: unknown): SchemaDialect;
interface DepthTracker {
    current: number;
}
export declare const MAX_SCHEMA_DEPTH = 300;
export interface ConvertContext {
    path: string;
    componentName?: string;
    schemas: SchemaMap;
    names: NameMaps;
    cycles: Set<string>;
    dialect: SchemaDialect;
    helpers: Set<HelperName>;
    customFormatsUsed: Set<string>;
    diagnostics: ConversionDiagnostic[];
    options: ResolvedOptions;
    inProperty: boolean;
    depth: DepthTracker;
}
export declare function resolveOptions(options: ConvertOpenApiToZodOptions): ResolvedOptions;
export declare function getSchemas(documentObject: Record<string, unknown> | undefined): SchemaMap;
export interface SharedContext {
    components: Record<string, unknown>;
    schemas: SchemaMap;
    names: NameMaps;
    cycles: Set<string>;
    dialect: SchemaDialect;
    helpers: Set<HelperName>;
    customFormatsUsed: Set<string>;
    diagnostics: ConversionDiagnostic[];
    options: ResolvedOptions;
    reusableNames?: ReusableNames;
}
interface ReusableNames {
    parameterNames: Map<string, string>;
    requestBodyNames: Map<string, string>;
    responseNames: Map<string, string>;
    headerNames: Map<string, string>;
    securityNames: Map<string, string>;
}
export type ReusableResult = {
    lines: string[];
} & ReusableNames;
export declare function isSupportedOpenApiVersion(value: unknown): boolean;
export {};
