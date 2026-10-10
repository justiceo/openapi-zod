import type { SharedContext } from "./core.js";
import type { OperationsResult } from "./operations.js";
export interface ServerFunctionsResult {
    lines: string[];
}
export declare function convertServerFunctions(operations: OperationsResult, shared: Pick<SharedContext, "components" | "schemas" | "options">): ServerFunctionsResult;
