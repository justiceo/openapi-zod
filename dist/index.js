import { diagnostic } from "./diagnostics.js";
import { convertReusableComponents, metadataExpression } from "./components.js";
import { getSchemas, isSupportedOpenApiVersion, openApiDialect, resolveOptions } from "./core.js";
import { asRecord, buildNames, escapePointer, helperCode } from "./emit.js";
import { convertOperations } from "./operations.js";
import { routeHelperCode } from "./route-helper.js";
import { componentHasCycle, convertSchema, findCycleEdges } from "./schema.js";
export function convertOpenApiToZod(document, options = {}) {
    const resolved = resolveOptions(options);
    const diagnostics = [];
    const documentObject = asRecord(document);
    const dialect = openApiDialect(documentObject?.openapi);
    const helpers = new Set();
    if (!documentObject || !isSupportedOpenApiVersion(documentObject.openapi)) {
        diagnostics.push({
            level: "error",
            code: "invalid.openapiVersion",
            path: "#/openapi",
            message: "OpenAPI version must start with 3.0. or 3.1.",
        });
    }
    const schemas = getSchemas(documentObject);
    if (Object.keys(schemas).length === 0) {
        diagnostics.push(diagnostic("empty.componentsSchemas", "No component schemas were found.", "#/components/schemas", resolved));
    }
    const paths = asRecord(documentObject?.paths) ?? {};
    if (Object.keys(paths).length === 0) {
        diagnostics.push(diagnostic("empty.paths", "No paths were found.", "#/paths", resolved));
    }
    const componentNames = Object.keys(schemas).sort();
    const names = buildNames(componentNames, resolved, diagnostics);
    const cycles = findCycleEdges(schemas);
    const lines = ['import * as z from "zod";'];
    if (resolved.includeDocumentMetadata) {
        lines.push("");
        lines.push(`export const openApiMetadata = ${metadataExpression(documentObject, diagnostics, resolved)} as const;`);
    }
    const helperInsertIndex = lines.length;
    for (const componentName of componentNames) {
        lines.push("");
        const schemaName = names.schemaNames.get(componentName);
        const expression = convertSchema(schemas[componentName], {
            path: `#/components/schemas/${escapePointer(componentName)}`,
            componentName,
            schemas,
            names,
            cycles,
            dialect,
            helpers,
            diagnostics,
            options: resolved,
            inProperty: false,
        });
        const annotation = componentHasCycle(componentName, cycles) ? ": z.ZodTypeAny" : "";
        lines.push(`export const ${schemaName}${annotation} = ${expression};`);
        if (resolved.includeInferredTypes) {
            lines.push(`export type ${names.typeNames.get(componentName)} = z.infer<typeof ${schemaName}>;`);
        }
    }
    const reusable = convertReusableComponents(documentObject, {
        components: asRecord(documentObject?.components) ?? {},
        schemas,
        names,
        cycles,
        dialect,
        helpers,
        diagnostics,
        options: resolved,
    });
    lines.push(...reusable.lines);
    const operations = convertOperations(documentObject, {
        components: asRecord(documentObject?.components) ?? {},
        schemas,
        names,
        cycles,
        dialect,
        helpers,
        diagnostics,
        options: resolved,
        reusableNames: reusable,
        securityNames: reusable.securityNames,
    });
    lines.push(...operations.lines);
    if (resolved.includeRouteMap) {
        lines.push("");
        lines.push(`export const routes = [${operations.exportNames.join(", ")}] as const;`);
        lines.push(...routeHelperCode());
    }
    if (helpers.size > 0) {
        lines.splice(helperInsertIndex, 0, ...helperCode(helpers));
    }
    return {
        outputs: [
            {
                path: resolved.outputFileName,
                contents: `${lines.join("\n")}\n`,
            },
        ],
        diagnostics,
    };
}
