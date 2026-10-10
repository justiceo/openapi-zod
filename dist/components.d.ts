import type { ResolvedOptions, ReusableResult, SharedContext } from "./core.js";
import type { ConversionDiagnostic } from "./diagnostics.js";
export declare function metadataExpression(documentObject: Record<string, unknown> | undefined, diagnostics: ConversionDiagnostic[], options: ResolvedOptions): string;
export declare function convertReusableComponents(documentObject: Record<string, unknown> | undefined, shared: SharedContext): ReusableResult;
export interface ConvertedParameter {
    name: string;
    location: "params" | "query" | "headers" | "cookies";
    schema: string;
    required: boolean;
    serialization?: string;
}
export declare function convertParameter(parameter: unknown, path: string, shared: SharedContext): ConvertedParameter;
export declare function convertRequestBody(body: unknown, path: string, shared: SharedContext): string;
export declare function convertResponse(response: unknown, path: string, shared: SharedContext): string;
