import { type ConvertOpenApiToZodOptions } from "./core.js";
import { type ConversionDiagnostic } from "./diagnostics.js";
export type { ConvertOpenApiToZodOptions, CustomFormat } from "./core.js";
export type { ConversionDiagnostic } from "./diagnostics.js";
export interface GeneratedOutput {
    path: string;
    contents: string;
}
export interface ConversionResult {
    outputs: GeneratedOutput[];
    diagnostics: ConversionDiagnostic[];
}
export declare function convertOpenApiToZod(document: unknown, options?: ConvertOpenApiToZodOptions): ConversionResult;
