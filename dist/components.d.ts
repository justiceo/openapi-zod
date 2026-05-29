import type { ConversionDiagnostic } from "./diagnostics.js";
import type { ResolvedOptions, ReusableResult, SharedContext } from "./core.js";
export declare function metadataExpression(documentObject: Record<string, unknown> | undefined, diagnostics: ConversionDiagnostic[], options: ResolvedOptions): string;
export declare function convertReusableComponents(documentObject: Record<string, unknown> | undefined, shared: SharedContext): ReusableResult;
export type ConvertedParameter = {
    name: string;
    location: "params" | "query" | "headers" | "cookies";
    schema: string;
    required: boolean;
    serialization?: string;
};
export declare function convertParameter(parameter: unknown, path: string, shared: SharedContext): ConvertedParameter;
export declare function convertHeader(header: unknown, _name: string, path: string, shared: SharedContext): string;
export declare function convertRequestBody(body: unknown, path: string, shared: SharedContext): string;
export declare function convertResponse(response: unknown, path: string, shared: SharedContext): string;
export declare function defaultResponseExpression(shared: SharedContext): string;
export declare function convertSecurityScheme(scheme: unknown, path: string, shared: SharedContext): string;
