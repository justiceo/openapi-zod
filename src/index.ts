import { diagnostic, type ConversionDiagnostic } from "./diagnostics.js";
import { convertReusableComponents, metadataExpression } from "./components.js";
import { getSchemas, isSupportedOpenApiVersion, openApiDialect, resolveOptions, type ConvertOpenApiToZodOptions, type HelperName } from "./core.js";
import { asRecord, buildNames, customFormatImportLines, escapePointer, helperCode, usedIdentifiers } from "./emit.js";
import { convertOperations } from "./operations.js";
import { routeHelperCode } from "./route-helper.js";
import { clientHelperCode } from "./client-helper.js";
import { convertClientFunctions } from "./client.js";
import { componentHasCycle, convertSchema, findCycleEdges } from "./schema.js";

export type { ConversionDiagnostic } from "./diagnostics.js";
export type { ConvertOpenApiToZodOptions, CustomFormat } from "./core.js";

export type GeneratedOutput = {
  path: string;
  contents: string;
};

export type ConversionResult = {
  outputs: GeneratedOutput[];
  diagnostics: ConversionDiagnostic[];
};

const generatedBanner = "// AUTO-GENERATED FILE. DO NOT EDIT.";

const helperExportNames = [
  "__openapiZodStableJson",
  "__openapiZodOneOf",
  "__openapiZodUniqueItems",
  "__openapiZodPropertyNames",
  "__openapiZodPatternProperties",
  "__openapiZodContains",
  "__openapiZodConditional",
  "__openapiZodDependentRequired",
  "__openapiZodDependentSchemas",
];

export function convertOpenApiToZod(
  document: unknown,
  options: ConvertOpenApiToZodOptions = {},
): ConversionResult {
  const resolved = resolveOptions(options);
  const diagnostics: ConversionDiagnostic[] = [];
  const documentObject = asRecord(document);
  const dialect = openApiDialect(documentObject?.openapi);
  const helpers = new Set<HelperName>();
  const customFormatsUsed = new Set<string>();

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
    diagnostics.push(
      diagnostic(
        "empty.componentsSchemas",
        "No component schemas were found.",
        "#/components/schemas",
        resolved,
      ),
    );
  }
  const paths = asRecord(documentObject?.paths) ?? {};
  if (Object.keys(paths).length === 0) {
    diagnostics.push(diagnostic("empty.paths", "No paths were found.", "#/paths", resolved));
  }

  const componentNames = Object.keys(schemas).sort();
  const names = buildNames(componentNames, resolved, diagnostics);
  const cycles = findCycleEdges(schemas);
  const schemaLines: string[] = [];

  if (resolved.includeDocumentMetadata) {
    schemaLines.push("");
    schemaLines.push(
      `export const openApiMetadata = ${metadataExpression(documentObject, diagnostics, resolved)} as const;`,
    );
  }
  const helperInsertIndex = schemaLines.length;

  for (const componentName of componentNames) {
    schemaLines.push("");
    const schemaName = names.schemaNames.get(componentName)!;
    const expression = convertSchema(schemas[componentName], {
      path: `#/components/schemas/${escapePointer(componentName)}`,
      componentName,
      schemas,
      names,
      cycles,
      dialect,
      helpers,
      customFormatsUsed,
      diagnostics,
      options: resolved,
      inProperty: false,
      depth: { current: 0 },
    });
    const annotation = componentHasCycle(componentName, cycles) ? ": z.ZodTypeAny" : "";
    schemaLines.push(`export const ${schemaName}${annotation} = ${expression};`);
    if (resolved.includeInferredTypes) {
      schemaLines.push(
        `export type ${names.typeNames.get(componentName)!} = z.infer<typeof ${schemaName}>;`,
      );
    }
  }

  const reusable = convertReusableComponents(documentObject, {
    components: asRecord(documentObject?.components) ?? {},
    schemas,
    names,
    cycles,
    dialect,
    helpers,
    customFormatsUsed,
    diagnostics,
    options: resolved,
  });
  schemaLines.push(...reusable.lines);

  const operations = convertOperations(documentObject, {
    components: asRecord(documentObject?.components) ?? {},
    schemas,
    names,
    cycles,
    dialect,
    helpers,
    customFormatsUsed,
    diagnostics,
    options: resolved,
    reusableNames: reusable,
    securityNames: reusable.securityNames,
  });

  if (resolved.outputMode === "singleFile") {
    const lines = ['import * as z from "zod";', ...schemaLines, ...operations.lines];

    if (resolved.includeRouteMap) {
      lines.push("");
      lines.push(`export const routes = [${operations.exportNames.join(", ")}] as const;`);
      lines.push(...routeHelperCode());
    }

    if (resolved.includeClient) {
      const clientFunctions = convertClientFunctions(operations, { options: resolved, diagnostics });
      lines.push("");
      lines.push(...clientHelperCode());
      lines.push(...clientFunctions.lines);
    }

    if (helpers.size > 0) {
      lines.splice(helperInsertIndex + 1, 0, ...helperCode(helpers));
    }

    const customFormatLines = customFormatImportLines(resolved.customFormats, customFormatsUsed, lines.join("\n"));
    if (customFormatLines.length > 0) lines.splice(1, 0, ...customFormatLines);

    return {
      outputs: [
        {
          path: resolved.outputFileName,
          contents: `${generatedBanner}\n\n${lines.join("\n")}\n`,
        },
      ],
      diagnostics,
    };
  }

  const schemaOutputLines = ['import * as z from "zod";'];
  if (helpers.size > 0) schemaOutputLines.push(...helperCode(helpers, true));
  schemaOutputLines.push(...schemaLines);
  const schemaCustomFormatLines = customFormatImportLines(resolved.customFormats, customFormatsUsed, schemaLines.join("\n"));
  if (schemaCustomFormatLines.length > 0) schemaOutputLines.splice(1, 0, ...schemaCustomFormatLines);

  const schemaExportNames = [
    ...names.schemaNames.values(),
    ...reusable.parameterNames.values(),
    ...reusable.requestBodyNames.values(),
    ...reusable.responseNames.values(),
    ...reusable.headerNames.values(),
  ];
  const operationsText = operations.lines.join("\n");
  const operationsImports = usedIdentifiers(operationsText, [...schemaExportNames, ...helperExportNames]);

  const operationsOutputLines = ['import * as z from "zod";'];
  if (operationsImports.length > 0) {
    operationsOutputLines.push(`import { ${operationsImports.join(", ")} } from "./schema.js";`);
  }
  const operationsCustomFormatLines = customFormatImportLines(resolved.customFormats, customFormatsUsed, operationsText);
  operationsOutputLines.push(...operationsCustomFormatLines);
  operationsOutputLines.push(...operations.lines);

  const outputs: GeneratedOutput[] = [
    { path: "api/schema.ts", contents: `${generatedBanner}\n\n${schemaOutputLines.join("\n")}\n` },
    { path: "api/operations.ts", contents: `${generatedBanner}\n\n${operationsOutputLines.join("\n")}\n` },
  ];

  if (resolved.includeRouteMap) {
    const routerLines = ['import * as z from "zod";'];
    if (operations.exportNames.length > 0) {
      routerLines.push(`import { ${operations.exportNames.join(", ")} } from "./operations.js";`);
    }
    routerLines.push("");
    routerLines.push(`export const routes = [${operations.exportNames.join(", ")}] as const;`);
    routerLines.push(...routeHelperCode());
    outputs.push({ path: "api/router.ts", contents: `${generatedBanner}\n\n${routerLines.join("\n")}\n` });
  }

  if (resolved.includeClient) {
    const clientFunctions = convertClientFunctions(operations, { options: resolved, diagnostics });
    const clientBodyLines = [...clientHelperCode(), ...clientFunctions.lines];
    const clientLines = ['import * as z from "zod";'];
    if (operations.exportNames.length > 0) {
      clientLines.push(`import { ${operations.exportNames.join(", ")} } from "./operations.js";`);
    }
    clientLines.push(...clientBodyLines);
    outputs.push({ path: "api/client.ts", contents: `${generatedBanner}\n\n${clientLines.join("\n")}\n` });
  }

  return { outputs, diagnostics };
}
