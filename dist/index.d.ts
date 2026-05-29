import { type ConversionDiagnostic } from "./diagnostics.js";
import { type ConvertOpenApiToZodOptions } from "./core.js";
export type { ConversionDiagnostic } from "./diagnostics.js";
export type { ConvertOpenApiToZodOptions } from "./core.js";
export type GeneratedOutput = {
    path: string;
    contents: string;
};
export type ConversionResult = {
    outputs: GeneratedOutput[];
    diagnostics: ConversionDiagnostic[];
};
export declare function convertOpenApiToZod(document: unknown, options?: ConvertOpenApiToZodOptions): ConversionResult;
