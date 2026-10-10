import type { ResolvedOptions } from "./core.js";
import type { ConversionDiagnostic } from "./diagnostics.js";
import type { OperationsResult } from "./operations.js";
export interface ClientFunctionsResult {
    lines: string[];
}
export declare function convertClientFunctions(operations: OperationsResult, shared: {
    options: ResolvedOptions;
    diagnostics: ConversionDiagnostic[];
}): ClientFunctionsResult;
