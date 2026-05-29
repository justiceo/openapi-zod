import type { SharedContext } from "./core.js";
export type OperationsResult = {
    lines: string[];
    exportNames: string[];
};
export declare function convertOperations(documentObject: Record<string, unknown> | undefined, shared: SharedContext & {
    securityNames: Map<string, string>;
}): OperationsResult;
