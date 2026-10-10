import type { HttpMethod, SharedContext } from "./core.js";
export interface OperationEntry {
    exportName: string;
    operationId: string;
    method: HttpMethod;
    pathKey: string;
    pathItem: Record<string, unknown>;
    operation: Record<string, unknown>;
    operationPath: string;
}
export interface OperationsResult {
    lines: string[];
    exportNames: string[];
    entries: OperationEntry[];
}
export declare function convertOperations(documentObject: Record<string, unknown> | undefined, shared: SharedContext & {
    securityNames: Map<string, string>;
}): OperationsResult;
