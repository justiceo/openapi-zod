import { literalObjectExpression, objectExpression, operationBaseName } from "./emit.js";
import { operationExamples } from "./examples.js";
export function convertServerFunctions(operations, shared) {
    const suffix = shared.options.operationNameSuffix;
    const operationProperties = {};
    const exampleProperties = {};
    for (const entry of operations.entries) {
        // Export names are already unique and sanitized, and they share the suffix, so stripping it keeps them unique.
        const routeName = operationBaseName(entry.exportName, suffix);
        operationProperties[routeName] = entry.exportName;
        const examples = operationExamples(entry, shared);
        exampleProperties[routeName] = objectExpression({
            request: literalObjectExpression(examples.request, 0),
            responses: objectExpression(Object.fromEntries(Object.entries(examples.responses).map(([status, example]) => [
                status,
                literalObjectExpression(example, 0),
            ])), 0),
        }, 0);
    }
    return {
        lines: [
            "",
            `export const serverOperations = ${objectExpression(operationProperties, 0)};`,
            "",
            "// Example requests/responses per operation (explicit OpenAPI examples, otherwise synthesized from the schema).",
            `export const serverExamples = ${objectExpression(exampleProperties, 0)};`,
            "",
            "export type ServerRoutes = ServerRouteMap<typeof serverOperations>;",
            "",
            "export function createServer(options: ServerOptions = {}): Server<typeof serverOperations> {",
            "  return serverCreate(serverOperations, serverExamples, options);",
            "}",
        ],
    };
}
