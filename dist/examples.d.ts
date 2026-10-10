import type { SharedContext } from "./core.js";
import type { OperationEntry } from "./operations.js";
export interface OperationExamples {
    request: Record<string, unknown>;
    responses: Record<string, {
        body?: unknown;
        headers?: Record<string, unknown>;
    }>;
}
type ExampleContext = Pick<SharedContext, "components" | "schemas" | "options">;
export declare function operationExamples(entry: OperationEntry, context: ExampleContext): OperationExamples;
export {};
