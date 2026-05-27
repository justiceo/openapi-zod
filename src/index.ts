import { diagnostic, type ConversionDiagnostic } from "./diagnostics.js";

export type { ConversionDiagnostic } from "./diagnostics.js";

export type ConvertOpenApiToZodOptions = {
  outputMode?: "singleFile";
  outputFileName?: string;
  schemaNamePrefix?: string;
  schemaNameSuffix?: string;
  operationNamePrefix?: string;
  operationNameSuffix?: string;
  includeInferredTypes?: boolean;
  includeRouteMap?: boolean;
  includeOperationTypes?: boolean;
  includeSecurityValidators?: boolean;
  includeDocumentMetadata?: boolean;
  strictObjects?: boolean;
  mediaTypes?: string[];
  includeDeprecated?: boolean;
  onUnsupported?: "warn" | "error";
};

export type GeneratedOutput = {
  path: string;
  contents: string;
};

export type ConversionResult = {
  outputs: GeneratedOutput[];
  diagnostics: ConversionDiagnostic[];
};

type ResolvedOptions = Required<ConvertOpenApiToZodOptions>;
type SchemaMap = Record<string, unknown>;
type SchemaDialect = "3.0" | "3.1" | "unknown";
type HelperName =
  | "literal"
  | "oneOf"
  | "uniqueItems"
  | "propertyNames"
  | "patternProperties"
  | "contains"
  | "conditional"
  | "dependentRequired"
  | "dependentSchemas";
type NameMaps = {
  schemaNames: Map<string, string>;
  typeNames: Map<string, string>;
  operationNames: Map<string, string>;
  order: Map<string, number>;
};

const httpMethods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;
type HttpMethod = (typeof httpMethods)[number];

function openApiDialect(value: unknown): SchemaDialect {
  if (typeof value === "string" && value.startsWith("3.0.")) return "3.0";
  if (typeof value === "string" && value.startsWith("3.1.")) return "3.1";
  return "unknown";
}

const reservedWords = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

export function convertOpenApiToZod(
  document: unknown,
  options: ConvertOpenApiToZodOptions = {},
): ConversionResult {
  const resolved = resolveOptions(options);
  const diagnostics: ConversionDiagnostic[] = [];
  const documentObject = asRecord(document);
  const dialect = openApiDialect(documentObject?.openapi);
  const helpers = new Set<HelperName>();

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
  const lines = ['import * as z from "zod";'];

  if (resolved.includeDocumentMetadata) {
    lines.push("");
    lines.push(
      `export const openApiMetadata = ${metadataExpression(documentObject, diagnostics, resolved)} as const;`,
    );
  }
  const helperInsertIndex = lines.length;

  for (const componentName of componentNames) {
    lines.push("");
    const schemaName = names.schemaNames.get(componentName)!;
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
      lines.push(
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

type ConvertContext = {
  path: string;
  componentName?: string;
  schemas: SchemaMap;
  names: NameMaps;
  cycles: Set<string>;
  dialect: SchemaDialect;
  helpers: Set<HelperName>;
  diagnostics: ConversionDiagnostic[];
  options: ResolvedOptions;
  inProperty: boolean;
};

function resolveOptions(options: ConvertOpenApiToZodOptions): ResolvedOptions {
  return {
    outputMode: options.outputMode ?? "singleFile",
    outputFileName: options.outputFileName ?? "schemas.ts",
    schemaNamePrefix: options.schemaNamePrefix ?? "",
    schemaNameSuffix: options.schemaNameSuffix ?? "Schema",
    operationNamePrefix: options.operationNamePrefix ?? "",
    operationNameSuffix: options.operationNameSuffix ?? "Operation",
    includeInferredTypes: options.includeInferredTypes ?? true,
    includeRouteMap: options.includeRouteMap ?? true,
    includeOperationTypes: options.includeOperationTypes ?? true,
    includeSecurityValidators: options.includeSecurityValidators ?? true,
    includeDocumentMetadata: options.includeDocumentMetadata ?? true,
    strictObjects: options.strictObjects ?? false,
    mediaTypes: options.mediaTypes ?? ["application/json"],
    includeDeprecated: options.includeDeprecated ?? true,
    onUnsupported: options.onUnsupported ?? "warn",
  };
}

function getSchemas(documentObject: Record<string, unknown> | undefined): SchemaMap {
  const components = asRecord(documentObject?.components);
  const schemas = asRecord(components?.schemas);
  return schemas ?? {};
}

type SharedContext = {
  components: Record<string, unknown>;
  schemas: SchemaMap;
  names: NameMaps;
  cycles: Set<string>;
  dialect: SchemaDialect;
  helpers: Set<HelperName>;
  diagnostics: ConversionDiagnostic[];
  options: ResolvedOptions;
  reusableNames?: ReusableNames;
};

type ReusableNames = {
  parameterNames: Map<string, string>;
  requestBodyNames: Map<string, string>;
  responseNames: Map<string, string>;
  headerNames: Map<string, string>;
  securityNames: Map<string, string>;
};

type ReusableResult = {
  lines: string[];
} & ReusableNames;

function metadataExpression(
  documentObject: Record<string, unknown> | undefined,
  diagnostics: ConversionDiagnostic[],
  options: ResolvedOptions,
): string {
  const metadata: Record<string, unknown> = {};
  if (!documentObject) return "{}";

  if (typeof documentObject.openapi === "string") metadata.openapi = documentObject.openapi;
  const info = asRecord(documentObject.info);
  if (info) {
    const metadataInfo: Record<string, unknown> = {};
    for (const key of ["title", "version", "summary", "description", "termsOfService"]) {
      if (typeof info[key] === "string") metadataInfo[key] = info[key];
      else if (info[key] !== undefined) {
        diagnostics.push(diagnostic("invalid.metadata", `${key} must be a string.`, `#/info/${key}`, options));
      }
    }
    metadata.info = metadataInfo;
  } else if (documentObject.info !== undefined) {
    diagnostics.push(diagnostic("invalid.metadata", "info must be an object.", "#/info", options));
  }

  const servers = Array.isArray(documentObject.servers) ? documentObject.servers : undefined;
  if (servers) {
    metadata.servers = servers
      .map((server, index) => {
        const object = asRecord(server);
        if (!object || typeof object.url !== "string") {
          diagnostics.push(diagnostic("invalid.metadata", "Server url must be a string.", `#/servers/${index}/url`, options));
          return undefined;
        }
        const output: Record<string, unknown> = { url: object.url };
        if (typeof object.description === "string") output.description = object.description;
        if (object.variables !== undefined) output.variables = object.variables;
        return output;
      })
      .filter((server): server is Record<string, unknown> => !!server);
  }

  if (Array.isArray(documentObject.tags)) {
    metadata.tags = documentObject.tags
      .map((tag, index) => {
        const object = asRecord(tag);
        if (!object || typeof object.name !== "string") {
          diagnostics.push(diagnostic("invalid.metadata", "Tag name must be a string.", `#/tags/${index}/name`, options));
          return undefined;
        }
        const output: Record<string, unknown> = { name: object.name };
        if (typeof object.description === "string") output.description = object.description;
        if (object.externalDocs !== undefined) output.externalDocs = object.externalDocs;
        return output;
      })
      .filter((tag): tag is Record<string, unknown> => !!tag);
  }

  if (documentObject.externalDocs !== undefined) metadata.externalDocs = documentObject.externalDocs;
  return literalObjectExpression(metadata, 0);
}

function convertReusableComponents(documentObject: Record<string, unknown> | undefined, shared: SharedContext): ReusableResult {
  const components = asRecord(documentObject?.components) ?? {};
  const result: ReusableResult = {
    lines: [],
    parameterNames: new Map(),
    requestBodyNames: new Map(),
    responseNames: new Map(),
    headerNames: new Map(),
    securityNames: new Map(),
  };
  const used = new Map<string, number>();

  const headers = asRecord(components.headers) ?? {};
  for (const name of Object.keys(headers).sort()) {
    const exportName = uniqueName(sanitizeIdentifier(`${name}Header`), used, `headers/${name}`, shared.diagnostics);
    result.headerNames.set(name, exportName);
  }

  const parameters = asRecord(components.parameters) ?? {};
  for (const name of Object.keys(parameters).sort()) {
    const exportName = uniqueName(sanitizeIdentifier(`${name}Parameter`), used, `parameters/${name}`, shared.diagnostics);
    result.parameterNames.set(name, exportName);
  }

  const requestBodies = asRecord(components.requestBodies) ?? {};
  for (const name of Object.keys(requestBodies).sort()) {
    const exportName = uniqueName(sanitizeIdentifier(`${name}RequestBody`), used, `requestBodies/${name}`, shared.diagnostics);
    result.requestBodyNames.set(name, exportName);
  }

  const responses = asRecord(components.responses) ?? {};
  for (const name of Object.keys(responses).sort()) {
    const exportName = uniqueName(sanitizeIdentifier(`${name}Response`), used, `responses/${name}`, shared.diagnostics);
    result.responseNames.set(name, exportName);
  }

  const securitySchemes = asRecord(components.securitySchemes) ?? {};
  for (const name of Object.keys(securitySchemes).sort()) {
    const exportName = uniqueName(sanitizeIdentifier(`${name}Security`), used, `securitySchemes/${name}`, shared.diagnostics);
    result.securityNames.set(name, exportName);
  }

  const withNames: SharedContext = { ...shared, reusableNames: result };

  for (const name of Object.keys(headers).sort()) {
    const exportName = result.headerNames.get(name)!;
    result.lines.push("", `export const ${exportName} = ${convertHeader(headers[name], `${exportName}`, `#/components/headers/${escapePointer(name)}`, withNames)};`);
  }

  for (const name of Object.keys(parameters).sort()) {
    const exportName = result.parameterNames.get(name)!;
    result.lines.push("", `export const ${exportName} = ${convertParameter(parameters[name], `#/components/parameters/${escapePointer(name)}`, withNames).schema};`);
  }

  for (const name of Object.keys(requestBodies).sort()) {
    const exportName = result.requestBodyNames.get(name)!;
    result.lines.push("", `export const ${exportName} = ${convertRequestBody(requestBodies[name], `#/components/requestBodies/${escapePointer(name)}`, withNames)};`);
  }

  for (const name of Object.keys(responses).sort()) {
    const exportName = result.responseNames.get(name)!;
    result.lines.push("", `export const ${exportName} = ${convertResponse(responses[name], `#/components/responses/${escapePointer(name)}`, withNames)};`);
  }

  for (const name of Object.keys(securitySchemes).sort()) {
    const exportName = result.securityNames.get(name)!;
    if (shared.options.includeSecurityValidators) {
      result.lines.push("", `export const ${exportName} = ${convertSecurityScheme(securitySchemes[name], `#/components/securitySchemes/${escapePointer(name)}`, withNames)};`);
    }
  }

  return result;
}

type ConvertedParameter = {
  name: string;
  location: "params" | "query" | "headers" | "cookies";
  schema: string;
  required: boolean;
  serialization?: string;
};

function convertParameter(parameter: unknown, path: string, shared: SharedContext): ConvertedParameter {
  const refName = reusableRefName(parameter, "parameters", path, shared);
  if (refName) {
    const target = resolveReusableRef(parameter, "parameters", path, shared);
    const targetName = typeof target?.name === "string" ? target.name : "unknown";
    const targetIn = typeof target?.in === "string" ? target.in : "query";
    const location = parameterLocation(targetIn);
    return {
      name: targetIn === "header" ? targetName.toLowerCase() : targetName,
      location: location ?? "query",
      schema: refName,
      required: targetIn === "path" || target?.required === true,
      serialization: target ? parameterSerializationExpression(target, targetIn, targetName) : undefined,
    };
  }
  if (isRefObject(parameter)) {
    return { name: "unknown", location: "query", schema: "z.unknown().optional()", required: false };
  }
  const object = resolveReusableRef(parameter, "parameters", path, shared) ?? asRecord(parameter);
  if (!object) {
    shared.diagnostics.push(diagnostic("invalid.parameter", "Parameter must be an object.", path, shared.options));
    return { name: "unknown", location: "query", schema: "z.unknown().optional()", required: false };
  }

  const rawName = typeof object.name === "string" ? object.name : "unknown";
  const rawIn = typeof object.in === "string" ? object.in : "query";
  const location = parameterLocation(rawIn);
  if (!location) {
    shared.diagnostics.push(diagnostic("invalid.parameter", `Unsupported parameter location "${rawIn}".`, `${path}/in`, shared.options));
  }
  validateParameterSerialization(object, rawIn, path, shared);
  let schema: string;
  if (object.schema !== undefined) {
    schema = convertSchema(object.schema, schemaContext(shared, `${path}/schema`));
  } else {
    const contentSchema = schemaFromContent(object.content, `${path}/content`, shared);
    schema = contentSchema ?? "z.unknown()";
    if (!contentSchema) shared.diagnostics.push(diagnostic("invalid.parameter", "Parameter must define schema or supported content.", path, shared.options));
  }

  const required = rawIn === "path" ? true : object.required === true;
  if (rawIn === "path" && object.required === false) {
    shared.diagnostics.push(diagnostic("invalid.pathParameter", "Path parameters must be required.", `${path}/required`, shared.options));
  }
  if (!required) schema += ".optional()";
  const key = rawIn === "header" ? rawName.toLowerCase() : rawName;
  return {
    name: key,
    location: location ?? "query",
    schema,
    required,
    serialization: parameterSerializationExpression(object, rawIn, rawName),
  };
}

function convertHeader(header: unknown, _name: string, path: string, shared: SharedContext): string {
  const refName = reusableRefName(header, "headers", path, shared);
  if (refName) return refName;
  if (isRefObject(header)) return "z.unknown().optional()";
  const object = resolveReusableRef(header, "headers", path, shared) ?? asRecord(header);
  if (!object) {
    shared.diagnostics.push(diagnostic("invalid.header", "Header must be an object.", path, shared.options));
    return "z.unknown().optional()";
  }
  let schema = object.schema !== undefined
    ? convertSchema(object.schema, schemaContext(shared, `${path}/schema`))
    : (schemaFromContent(object.content, `${path}/content`, shared) ?? "z.unknown()");
  validateHeaderSerialization(object, path, shared);
  schema += ".optional()";
  return schema;
}

function convertRequestBody(body: unknown, path: string, shared: SharedContext): string {
  const refName = reusableRefName(body, "requestBodies", path, shared);
  if (refName) return refName;
  if (isRefObject(body)) return "undefined";
  const object = resolveReusableRef(body, "requestBodies", path, shared) ?? asRecord(body);
  if (!object) {
    shared.diagnostics.push(diagnostic("invalid.requestBody", "Request body must be an object.", path, shared.options));
    return "undefined";
  }
  const entries = contentEntries(object.content, path, "requestBody", shared);
  if (entries.length === 0) return "undefined";
  const required = object.required === true;
  if (entries.length === 1) {
    const expression = entries[0]![1];
    return required ? expression : `${expression}.optional()`;
  }
  return objectExpression(Object.fromEntries(entries), 0);
}

function convertResponse(response: unknown, path: string, shared: SharedContext): string {
  const refName = reusableRefName(response, "responses", path, shared);
  if (refName) return refName;
  if (isRefObject(response)) return "{ description: \"\", headers: z.object({}), content: {} }";
  const object = resolveReusableRef(response, "responses", path, shared) ?? asRecord(response);
  if (!object) {
    shared.diagnostics.push(diagnostic("invalid.response", "Response must be an object.", path, shared.options));
    return "{ description: \"\", headers: z.object({}), content: {} }";
  }
  const headers = asRecord(object.headers) ?? {};
  const headerSchemas: Record<string, string> = {};
  for (const name of Object.keys(headers).sort()) {
    headerSchemas[name.toLowerCase()] = convertHeader(headers[name], name, `${path}/headers/${escapePointer(name)}`, shared);
  }
  const entries = contentEntries(object.content, path, "response", shared);
  if (object.links !== undefined) {
    shared.diagnostics.push(diagnostic("unsupported.links", "Response links are not supported.", `${path}/links`, shared.options));
  }
  return objectExpression({
    description: JSON.stringify(typeof object.description === "string" ? object.description : ""),
    headers: zodObjectExpression(headerSchemas),
    content: objectExpression(Object.fromEntries(entries), 0),
  }, 0);
}

function convertSecurityScheme(scheme: unknown, path: string, shared: SharedContext): string {
  const object = asRecord(scheme);
  if (!object || typeof object.type !== "string") {
    shared.diagnostics.push(diagnostic("invalid.securityScheme", "Security scheme must define a type.", path, shared.options));
    return "z.unknown()";
  }
  if (object.type === "apiKey") {
    const name = typeof object.name === "string" ? object.name.toLowerCase() : "authorization";
    switch (object.in) {
      case "header":
        return `z.object({ headers: z.object({ ${propertyKey(name)}: z.string() }) })`;
      case "query":
        return `z.object({ query: z.object({ ${propertyKey(name)}: z.string() }) })`;
      case "cookie":
        return `z.object({ cookies: z.object({ ${propertyKey(name)}: z.string() }) })`;
      default:
        shared.diagnostics.push(diagnostic("invalid.securityScheme", "apiKey security must use header, query, or cookie.", `${path}/in`, shared.options));
        return "z.unknown()";
    }
  }
  if (object.type === "http") {
    if (object.scheme === "basic") return 'z.object({ headers: z.object({ authorization: z.string().regex(new RegExp("^Basic .+$")) }) })';
    if (object.scheme === "bearer") return 'z.object({ headers: z.object({ authorization: z.string().regex(new RegExp("^Bearer .+$")) }) })';
    shared.diagnostics.push(diagnostic("unsupported.securityScheme", `Unsupported HTTP security scheme "${String(object.scheme)}".`, `${path}/scheme`, shared.options));
    return "z.unknown()";
  }
  if (object.type === "oauth2" || object.type === "openIdConnect") {
    if (object.type === "oauth2" && !asRecord(object.flows)) {
      shared.diagnostics.push(diagnostic("invalid.securityScheme", "OAuth2 security schemes must define flows.", `${path}/flows`, shared.options));
    }
    if (object.type === "openIdConnect" && typeof object.openIdConnectUrl !== "string") {
      shared.diagnostics.push(diagnostic("invalid.securityScheme", "OpenID Connect security schemes must define openIdConnectUrl.", `${path}/openIdConnectUrl`, shared.options));
    }
    return 'z.object({ headers: z.object({ authorization: z.string().regex(new RegExp("^Bearer .+$")) }) })';
  }
  shared.diagnostics.push(diagnostic("unsupported.securityScheme", `Unsupported security scheme type "${object.type}".`, `${path}/type`, shared.options));
  return "z.unknown()";
}

type OperationsResult = { lines: string[]; exportNames: string[] };

function convertOperations(documentObject: Record<string, unknown> | undefined, shared: SharedContext & { securityNames: Map<string, string> }): OperationsResult {
  const paths = asRecord(documentObject?.paths) ?? {};
  const globalSecurity = Array.isArray(documentObject?.security) ? documentObject.security : undefined;
  const lines: string[] = [];
  const exportNames: string[] = [];
  const usedNames = new Map<string, number>();

  for (const pathKey of Object.keys(paths).sort()) {
    if (!pathKey.startsWith("/")) {
      shared.diagnostics.push(diagnostic("invalid.path", "Path keys must start with /.", `#/paths/${escapePointer(pathKey)}`, shared.options));
      continue;
    }
    const pathItem = asRecord(paths[pathKey]);
    if (!pathItem) continue;
    if (pathItem.$ref !== undefined) {
      shared.diagnostics.push(diagnostic("unsupported.pathItemRef", "Path item $ref is not supported.", `#/paths/${escapePointer(pathKey)}/$ref`, shared.options));
    }
    for (const method of httpMethods) {
      const operation = asRecord(pathItem[method]);
      if (!operation) continue;
      if (operation.deprecated === true && !shared.options.includeDeprecated) continue;
      const operationPath = `#/paths/${escapePointer(pathKey)}/${method}`;
      const baseName = typeof operation.operationId === "string" && operation.operationId.length > 0
        ? operation.operationId
        : derivedOperationId(method, pathKey, shared, operationPath);
      const exportName = uniqueName(
        sanitizeIdentifier(`${shared.options.operationNamePrefix}${baseName}${shared.options.operationNameSuffix}`),
        usedNames,
        `operations/${baseName}`,
        shared.diagnostics,
      );
      exportNames.push(exportName);
      const request = convertOperationRequest(pathKey, pathItem, operation, operationPath, shared);
      const responses = convertOperationResponses(operation, operationPath, shared);
      const security = operation.security !== undefined ? operation.security : (globalSecurity ?? []);
      validateSecurityRequirements(security, `${operationPath}/security`, shared);
      const tags = Array.isArray(operation.tags)
        ? Array.from(new Set(operation.tags.filter((tag): tag is string => typeof tag === "string"))).sort()
        : [];
      if (operation.callbacks !== undefined) {
        shared.diagnostics.push(diagnostic("unsupported.callbacks", "Callbacks are not supported.", `${operationPath}/callbacks`, shared.options));
      }
      const operationProperties: Record<string, string> = {
        operationId: JSON.stringify(baseName),
        method: JSON.stringify(method),
        path: JSON.stringify(pathKey),
        tags: arrayLiteral(tags.map((tag) => JSON.stringify(tag))),
        deprecated: operation.deprecated === true ? "true" : "false",
        security: literalObjectExpression(security, 0),
        request,
        responses,
      };
      if (typeof operation.summary === "string") operationProperties.summary = JSON.stringify(operation.summary);
      if (typeof operation.description === "string") operationProperties.description = JSON.stringify(operation.description);
      if (operation.externalDocs !== undefined) operationProperties.externalDocs = literalObjectExpression(operation.externalDocs, 0);
      lines.push("");
      lines.push(`export const ${exportName} = ${objectExpression(operationProperties, 0)} as const;`);
      if (shared.options.includeOperationTypes) {
        const typeBase = exportName.endsWith(shared.options.operationNameSuffix)
          ? exportName.slice(0, -shared.options.operationNameSuffix.length)
          : exportName;
        const typePrefix = typeBase.charAt(0).toUpperCase() + typeBase.slice(1);
        lines.push(`export type ${typePrefix}Request = typeof ${exportName}.request;`);
        lines.push(`export type ${typePrefix}Responses = typeof ${exportName}.responses;`);
      }
    }
  }
  return { lines, exportNames };
}

function convertOperationRequest(
  pathKey: string,
  pathItem: Record<string, unknown>,
  operation: Record<string, unknown>,
  operationPath: string,
  shared: SharedContext,
): string {
  const merged = new Map<string, ConvertedParameter>();
  const addParameter = (parameter: unknown, path: string): void => {
    const converted = convertParameter(parameter, path, shared);
    merged.set(`${converted.location}:${converted.name}`, converted);
  };
  if (Array.isArray(pathItem.parameters)) {
    pathItem.parameters.forEach((parameter, index) => addParameter(parameter, `${operationPath}/../../parameters/${index}`));
  }
  if (Array.isArray(operation.parameters)) {
    operation.parameters.forEach((parameter, index) => addParameter(parameter, `${operationPath}/parameters/${index}`));
  }

  const containers: Record<ConvertedParameter["location"], Record<string, string>> = {
    params: {},
    query: {},
    headers: {},
    cookies: {},
  };
  for (const parameter of Array.from(merged.values()).sort((a, b) => `${a.location}:${a.name}`.localeCompare(`${b.location}:${b.name}`))) {
    containers[parameter.location][parameter.name] = parameter.schema;
  }
  const serialization = Array.from(merged.values())
    .filter((parameter) => parameter.serialization !== undefined)
    .sort((a, b) => `${a.location}:${a.name}`.localeCompare(`${b.location}:${b.name}`))
    .map((parameter) => parameter.serialization!);

  validatePathParameters(pathKey, containers.params, operationPath, shared);
  const body = operation.requestBody === undefined
    ? "undefined"
    : convertRequestBody(operation.requestBody, `${operationPath}/requestBody`, shared);
  const requestProperties: Record<string, string> = {
    params: zodObjectExpression(containers.params),
    query: zodObjectExpression(containers.query),
    headers: zodObjectExpression(containers.headers),
    cookies: zodObjectExpression(containers.cookies),
    body,
  };
  if (serialization.length > 0) {
    requestProperties.serialization = arrayExpression(serialization, 0);
  }
  return objectExpression(requestProperties, 0);
}

function convertOperationResponses(
  operation: Record<string, unknown>,
  operationPath: string,
  shared: SharedContext,
): string {
  const responses = asRecord(operation.responses);
  if (!responses) {
    shared.diagnostics.push(diagnostic("invalid.responses", "Operation responses must be an object.", `${operationPath}/responses`, shared.options));
    return "{}";
  }
  const converted: Record<string, string> = {};
  for (const key of Object.keys(responses).sort(responseStatusCompare)) {
    if (!isResponseStatus(key)) {
      shared.diagnostics.push(diagnostic("invalid.responseStatus", `Invalid response status "${key}".`, `${operationPath}/responses/${escapePointer(key)}`, shared.options));
      continue;
    }
    converted[key] = convertResponse(responses[key], `${operationPath}/responses/${escapePointer(key)}`, shared);
  }
  return objectExpression(converted, 0);
}

function validatePathParameters(
  pathKey: string,
  params: Record<string, string>,
  operationPath: string,
  shared: SharedContext,
): void {
  const templateNames = Array.from(pathKey.matchAll(/\{([^}]+)\}/g)).map((match) => match[1]!);
  for (const name of templateNames) {
    if (params[name] === undefined) {
      shared.diagnostics.push(diagnostic("invalid.pathParameter", `Missing path parameter "${name}".`, operationPath, shared.options));
    }
  }
  for (const name of Object.keys(params)) {
    if (!templateNames.includes(name)) {
      shared.diagnostics.push(diagnostic("invalid.pathParameter", `Path parameter "${name}" is not used in the path template.`, operationPath, shared.options));
    }
  }
}

function validateSecurityRequirements(
  security: unknown,
  path: string,
  shared: SharedContext & { securityNames: Map<string, string> },
): void {
  if (!Array.isArray(security)) {
    shared.diagnostics.push(diagnostic("invalid.securityScheme", "Security requirements must be an array.", path, shared.options));
    return;
  }
  const securitySchemes = asRecord(shared.components.securitySchemes) ?? {};
  for (const [index, requirement] of security.entries()) {
    const object = asRecord(requirement);
    if (!object) {
      shared.diagnostics.push(diagnostic("invalid.securityScheme", "Security requirement must be an object.", `${path}/${index}`, shared.options));
      continue;
    }
    for (const name of Object.keys(object)) {
      if (!shared.securityNames.has(name)) {
        shared.diagnostics.push(diagnostic("invalid.securityScheme", `Security scheme "${name}" was not found.`, `${path}/${index}/${escapePointer(name)}`, shared.options));
        continue;
      }
      const scopes = object[name];
      if (!Array.isArray(scopes)) {
        shared.diagnostics.push(diagnostic("invalid.securityScope", `Security scopes for "${name}" must be an array.`, `${path}/${index}/${escapePointer(name)}`, shared.options));
        continue;
      }
      const scheme = asRecord(securitySchemes[name]);
      if (scheme?.type === "oauth2") {
        const knownScopes = oauth2Scopes(scheme);
        for (const [scopeIndex, scope] of scopes.entries()) {
          if (typeof scope !== "string" || !knownScopes.has(scope)) {
            shared.diagnostics.push(diagnostic("invalid.securityScope", `Security scope "${String(scope)}" was not declared.`, `${path}/${index}/${escapePointer(name)}/${scopeIndex}`, shared.options));
          }
        }
      }
    }
  }
}

function oauth2Scopes(scheme: Record<string, unknown>): Set<string> {
  const scopes = new Set<string>();
  const flows = asRecord(scheme.flows) ?? {};
  for (const flow of Object.values(flows)) {
    const flowObject = asRecord(flow);
    const flowScopes = asRecord(flowObject?.scopes);
    if (!flowScopes) continue;
    for (const scope of Object.keys(flowScopes)) scopes.add(scope);
  }
  return scopes;
}

function derivedOperationId(method: HttpMethod, pathKey: string, shared: SharedContext, path: string): string {
  shared.diagnostics.push(diagnostic("ambiguous.operationId", "Operation is missing operationId; deriving a deterministic name.", path, shared.options));
  const parts = pathKey.split(/[/{}/_-]+/).filter(Boolean);
  return `${method}${parts.map(capitalize).join("")}`;
}

function parameterLocation(value: string): ConvertedParameter["location"] | undefined {
  switch (value) {
    case "path":
      return "params";
    case "query":
      return "query";
    case "header":
      return "headers";
    case "cookie":
      return "cookies";
    default:
      return undefined;
  }
}

function validateParameterSerialization(
  parameter: Record<string, unknown>,
  location: string,
  path: string,
  shared: SharedContext,
): void {
  const style = parameter.style;
  const explode = parameter.explode;
  const isDefault =
    (location === "path" && (style === undefined || style === "simple") && (explode === undefined || explode === false)) ||
    (location === "query" && (style === undefined || style === "form")) ||
    (location === "header" && (style === undefined || style === "simple")) ||
    (location === "cookie" && (style === undefined || style === "form"));
  if (!isDefault) {
    shared.diagnostics.push(diagnostic("unsupported.parameterSerialization", "Parameter serialization is not supported.", path, shared.options));
  }
  if (parameter.allowReserved === true || parameter.allowEmptyValue === true) {
    shared.diagnostics.push(diagnostic("unsupported.parameterSerialization", "Parameter serialization flags are not supported.", path, shared.options));
  }
}

function parameterSerializationExpression(
  parameter: Record<string, unknown>,
  location: string,
  name: string,
): string | undefined {
  const metadata: Record<string, unknown> = {
    in: location,
    name,
  };
  let hasExplicitSerialization = false;
  for (const key of ["style", "explode", "allowReserved", "allowEmptyValue"] as const) {
    if (parameter[key] !== undefined) {
      metadata[key] = parameter[key];
      hasExplicitSerialization = true;
    }
  }
  return hasExplicitSerialization ? literalObjectExpression(metadata, 0) : undefined;
}

function validateHeaderSerialization(
  header: Record<string, unknown>,
  path: string,
  shared: SharedContext,
): void {
  const style = header.style;
  const explode = header.explode;
  if ((style !== undefined && style !== "simple") || (explode !== undefined && explode !== false)) {
    shared.diagnostics.push(diagnostic("unsupported.headerSerialization", "Header serialization is not supported.", path, shared.options));
  }
}

function schemaFromContent(content: unknown, path: string, shared: SharedContext): string | undefined {
  const object = asRecord(content);
  if (!object) return undefined;
  const matching = shared.options.mediaTypes.filter((mediaType) => object[mediaType] !== undefined);
  if (matching.length !== 1) {
    shared.diagnostics.push(diagnostic("unsupported.mediaType", "Content must contain exactly one configured media type.", path, shared.options));
    return undefined;
  }
  const media = asRecord(object[matching[0]!]);
  return media?.schema === undefined
    ? undefined
    : convertSchema(media.schema, schemaContext(shared, `${path}/${escapePointer(matching[0]!)}/schema`));
}

function contentEntries(
  content: unknown,
  parentPath: string,
  kind: "requestBody" | "response",
  shared: SharedContext,
): [string, string][] {
  const object = asRecord(content);
  if (!object) return [];
  const entries: [string, string][] = [];
  for (const mediaType of shared.options.mediaTypes) {
    if (object[mediaType] === undefined) continue;
    const media = asRecord(object[mediaType]);
    const schemaPath = `${parentPath}/content/${escapePointer(mediaType)}/schema`;
    if (!media || media.schema === undefined) {
      const code = kind === "requestBody" ? "ambiguous.requestBodySchema" : "ambiguous.responseBodySchema";
      shared.diagnostics.push(diagnostic(code, "Selected media type is missing a schema; using unknown.", schemaPath, shared.options));
      entries.push([mediaType, "z.unknown()"]);
    } else {
      entries.push([mediaType, convertSchema(media.schema, schemaContext(shared, schemaPath))]);
    }
    if (media?.encoding !== undefined) {
      shared.diagnostics.push(diagnostic("unsupported.encoding", "Encoding is not supported.", `${parentPath}/content/${escapePointer(mediaType)}/encoding`, shared.options));
    }
  }
  if (entries.length === 0 && Object.keys(object).length > 0) {
    shared.diagnostics.push(diagnostic("unsupported.mediaType", "No configured media types were found.", `${parentPath}/content`, shared.options));
  }
  return entries;
}

function resolveReusableRef(
  value: unknown,
  kind: "parameters" | "headers" | "requestBodies" | "responses",
  path: string,
  shared: SharedContext,
): Record<string, unknown> | undefined {
  const object = asRecord(value);
  if (!object || typeof object.$ref !== "string") return undefined;
  const prefix = `#/components/${kind}/`;
  if (!object.$ref.startsWith(prefix)) {
    shared.diagnostics.push(diagnostic("unsupported.externalRef", "External references are not supported.", `${path}/$ref`, shared.options));
    return undefined;
  }
  const name = unescapePointer(object.$ref.slice(prefix.length));
  const collection = asRecord(shared.components[kind]) ?? {};
  const target = asRecord(collection[name]);
  if (!target) {
    shared.diagnostics.push(diagnostic("invalid.ref", `Reference target "${name}" was not found in components.${kind}.`, `${path}/$ref`, shared.options));
  }
  return target;
}

function reusableRefName(
  value: unknown,
  kind: "parameters" | "headers" | "requestBodies" | "responses",
  path: string,
  shared: SharedContext,
): string | undefined {
  const object = asRecord(value);
  if (!object || typeof object.$ref !== "string") return undefined;
  const prefix = `#/components/${kind}/`;
  if (!object.$ref.startsWith(prefix)) {
    shared.diagnostics.push(diagnostic("unsupported.externalRef", "External references are not supported.", `${path}/$ref`, shared.options));
    return undefined;
  }
  const name = unescapePointer(object.$ref.slice(prefix.length));
  const names = shared.reusableNames;
  const exportName =
    kind === "parameters" ? names?.parameterNames.get(name)
    : kind === "headers" ? names?.headerNames.get(name)
    : kind === "requestBodies" ? names?.requestBodyNames.get(name)
    : names?.responseNames.get(name);
  if (!exportName) {
    shared.diagnostics.push(diagnostic("invalid.ref", `Reference target "${name}" was not found in components.${kind}.`, `${path}/$ref`, shared.options));
  }
  return exportName;
}

function isRefObject(value: unknown): boolean {
  return typeof asRecord(value)?.$ref === "string";
}

function schemaContext(shared: SharedContext, path: string): ConvertContext {
  return {
    path,
    schemas: shared.schemas,
    names: shared.names,
    cycles: shared.cycles,
    dialect: shared.dialect,
    helpers: shared.helpers,
    diagnostics: shared.diagnostics,
    options: shared.options,
    inProperty: false,
  };
}

function helperCode(helpers: Set<HelperName>): string[] {
  const lines: string[] = [];
  const needsStableJson = helpers.has("uniqueItems") || helpers.has("literal");
  if (needsStableJson) {
    lines.push(
      "",
      "const __openapiZodStableJson = (value: unknown): string => {",
      "  if (value === null || typeof value !== \"object\") return JSON.stringify(value);",
      "  if (Array.isArray(value)) return `[${value.map((item) => __openapiZodStableJson(item)).join(\",\")}]`;",
      "  const object = value as Record<string, unknown>;",
      "  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${__openapiZodStableJson(object[key])}`).join(\",\")}}`;",
      "};",
    );
  }
  if (helpers.has("oneOf")) {
    lines.push(
      "",
      "const __openapiZodOneOf = (value: unknown, ctx: z.core.$RefinementCtx, schemas: z.ZodType[]): void => {",
      "  let matches = 0;",
      "  for (const schema of schemas) {",
      "    if (schema.safeParse(value).success) matches += 1;",
      "  }",
      "  if (matches !== 1) ctx.addIssue({ code: \"custom\", message: \"Expected exactly one schema to match.\" });",
      "};",
    );
  }
  if (helpers.has("uniqueItems")) {
    lines.push(
      "",
      "const __openapiZodUniqueItems = (items: unknown[], ctx: z.core.$RefinementCtx): void => {",
      "  const seen = new Set<string>();",
      "  for (const item of items) {",
      "    const key = __openapiZodStableJson(item);",
      "    if (seen.has(key)) {",
      "      ctx.addIssue({ code: \"custom\", message: \"Expected array items to be unique.\" });",
      "      return;",
      "    }",
      "    seen.add(key);",
      "  }",
      "};",
    );
  }
  if (helpers.has("propertyNames")) {
    lines.push(
      "",
      "const __openapiZodPropertyNames = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, schema: z.ZodType): void => {",
      "  for (const key of Object.keys(value)) {",
      "    if (!schema.safeParse(key).success) ctx.addIssue({ code: \"custom\", path: [key], message: \"Object property name did not match the required schema.\" });",
      "  }",
      "};",
    );
  }
  if (helpers.has("patternProperties")) {
    lines.push(
      "",
      "const __openapiZodPatternProperties = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, patterns: Array<[RegExp, z.ZodType]>): void => {",
      "  for (const [key, child] of Object.entries(value)) {",
      "    for (const [pattern, schema] of patterns) {",
      "      if (pattern.test(key) && !schema.safeParse(child).success) ctx.addIssue({ code: \"custom\", path: [key], message: \"Object property did not match its patternProperties schema.\" });",
      "    }",
      "  }",
      "};",
    );
  }
  if (helpers.has("contains")) {
    lines.push(
      "",
      "const __openapiZodContains = (items: unknown[], ctx: z.core.$RefinementCtx, schema: z.ZodType, min: number, max: number | undefined): void => {",
      "  let matches = 0;",
      "  for (const item of items) {",
      "    if (schema.safeParse(item).success) matches += 1;",
      "  }",
      "  if (matches < min) ctx.addIssue({ code: \"custom\", message: `Expected at least ${min} matching array item(s).` });",
      "  if (max !== undefined && matches > max) ctx.addIssue({ code: \"custom\", message: `Expected at most ${max} matching array item(s).` });",
      "};",
    );
  }
  if (helpers.has("conditional")) {
    lines.push(
      "",
      "const __openapiZodConditional = (value: unknown, ctx: z.core.$RefinementCtx, ifSchema: z.ZodType, thenSchema: z.ZodType | undefined, elseSchema: z.ZodType | undefined): void => {",
      "  const matched = ifSchema.safeParse(value).success;",
      "  if (matched && thenSchema && !thenSchema.safeParse(value).success) ctx.addIssue({ code: \"custom\", message: \"Value did not match the conditional then schema.\" });",
      "  if (!matched && elseSchema && !elseSchema.safeParse(value).success) ctx.addIssue({ code: \"custom\", message: \"Value did not match the conditional else schema.\" });",
      "};",
    );
  }
  if (helpers.has("dependentRequired")) {
    lines.push(
      "",
      "const __openapiZodDependentRequired = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, dependencies: Record<string, string[]>): void => {",
      "  for (const [key, required] of Object.entries(dependencies)) {",
      "    if (!(key in value)) continue;",
      "    for (const requiredKey of required) {",
      "      if (!(requiredKey in value)) ctx.addIssue({ code: \"custom\", path: [requiredKey], message: `Property ${requiredKey} is required when ${key} is present.` });",
      "    }",
      "  }",
      "};",
    );
  }
  if (helpers.has("dependentSchemas")) {
    lines.push(
      "",
      "const __openapiZodDependentSchemas = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, schemas: Array<[string, z.ZodType]>): void => {",
      "  for (const [key, schema] of schemas) {",
      "    if (key in value && !schema.safeParse(value).success) ctx.addIssue({ code: \"custom\", path: [key], message: `Object did not match dependent schema for ${key}.` });",
      "  }",
      "};",
    );
  }
  return lines;
}

function zodObjectExpression(properties: Record<string, string>): string {
  const keys = Object.keys(properties).sort();
  if (keys.length === 0) return "z.object({})";
  return `z.object({\n${keys.map((key) => `  ${propertyKey(key)}: ${indentMultiline(properties[key], 2)},`).join("\n")}\n})`;
}

function objectExpression(properties: Record<string, string>, indent: number): string {
  const keys = Object.keys(properties);
  if (keys.length === 0) return "{}";
  const pad = " ".repeat(indent);
  const childPad = " ".repeat(indent + 2);
  return `{\n${keys.map((key) => `${childPad}${propertyKey(key)}: ${indentMultiline(properties[key], indent + 2)},`).join("\n")}\n${pad}}`;
}

function literalObjectExpression(value: unknown, indent: number): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return arrayExpression(value.map((item) => literalObjectExpression(item, 0)), indent);
  const object = asRecord(value);
  if (!object) return "undefined";
  const entries: Record<string, string> = {};
  for (const key of Object.keys(object).sort()) {
    if (key.startsWith("x-")) continue;
    entries[key] = literalObjectExpression(object[key], 0);
  }
  return objectExpression(entries, indent);
}

function arrayLiteral(values: string[]): string {
  return `[${values.join(", ")}]`;
}

function arrayExpression(values: string[], indent: number): string {
  if (values.length === 0) return "[]";
  if (values.every((value) => !value.includes("\n"))) return arrayLiteral(values);
  const pad = " ".repeat(indent);
  const childPad = " ".repeat(indent + 2);
  return `[\n${values.map((value) => `${childPad}${indentMultiline(value, indent + 2)},`).join("\n")}\n${pad}]`;
}

function indentMultiline(value: string, indent: number): string {
  const padding = " ".repeat(indent);
  return value.split("\n").map((line, index) => index === 0 ? line : `${padding}${line}`).join("\n");
}

function isResponseStatus(value: string): boolean {
  return value === "default" || /^[1-5][0-9][0-9]$/.test(value) || /^[1-5]XX$/.test(value);
}

function responseStatusCompare(left: string, right: string): number {
  if (left === "default") return right === "default" ? 0 : 1;
  if (right === "default") return -1;
  return left.localeCompare(right);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/[^A-Za-z0-9_$]/g, "");
}

function isSupportedOpenApiVersion(value: unknown): boolean {
  return typeof value === "string" && (value.startsWith("3.0.") || value.startsWith("3.1."));
}

function buildNames(
  componentNames: string[],
  options: ResolvedOptions,
  diagnostics: ConversionDiagnostic[],
): NameMaps {
  const schemaNames = new Map<string, string>();
  const typeNames = new Map<string, string>();
  const operationNames = new Map<string, string>();
  const order = new Map<string, number>();
  const usedSchemaNames = new Map<string, number>();
  const usedTypeNames = new Map<string, number>();

  for (const [index, componentName] of componentNames.entries()) {
    order.set(componentName, index);
    const schemaBase = sanitizeIdentifier(
      `${options.schemaNamePrefix}${componentName}${options.schemaNameSuffix}`,
    );
    schemaNames.set(
      componentName,
      uniqueName(schemaBase, usedSchemaNames, componentName, diagnostics),
    );

    const typeBase = sanitizeIdentifier(
      options.schemaNameSuffix && componentName.endsWith(options.schemaNameSuffix)
        ? componentName.slice(0, -options.schemaNameSuffix.length)
        : componentName,
    );
    typeNames.set(
      componentName,
      uniqueName(typeBase, usedTypeNames, componentName, diagnostics),
    );
  }

  return { schemaNames, typeNames, operationNames, order };
}

function uniqueName(
  base: string,
  used: Map<string, number>,
  componentName: string,
  diagnostics: ConversionDiagnostic[],
): string {
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  if (count === 0) return base;

  diagnostics.push({
    level: "warning",
    code: "name.collision",
    path: `#/components/schemas/${escapePointer(componentName)}`,
    message: `Generated name "${base}" collided; using "${base}_${count + 1}".`,
  });
  return `${base}_${count + 1}`;
}

function sanitizeIdentifier(value: string): string {
  let result = value.replace(/[^A-Za-z0-9_$]/g, "");
  if (!/^[A-Za-z_$]/.test(result)) result = `Schema${result}`;
  if (reservedWords.has(result)) result = `Schema${result}`;
  return result || "Schema";
}

function convertSchema(schema: unknown, context: ConvertContext): string {
  const object = asRecord(schema);
  if (!object) {
    addInvalidSchema(context, "Schema must be an object.");
    return "z.unknown()";
  }

  const ref = object.$ref;
  if (typeof ref === "string") {
    return convertRef(ref, object, context);
  }

  if (object.discriminator !== undefined) {
    addDiagnostic(context, "unsupported.discriminator", "Discriminators are not supported.", `${context.path}/discriminator`);
  }

  if (context.dialect === "3.1" && object.nullable === true) {
    addDiagnostic(context, "unsupported.keyword", "nullable is an OpenAPI 3.0 keyword; use a type array including null in OpenAPI 3.1.", `${context.path}/nullable`);
  }

  for (const keyword of ["unevaluatedProperties", "unevaluatedItems"] as const) {
    if (object[keyword] !== undefined) {
      addDiagnostic(context, "unsupported.keyword", `${keyword} requires JSON Schema evaluation state and is not supported.`, `${context.path}/${keyword}`);
    }
  }

  if (Array.isArray(object.oneOf)) {
    return convertUnion(object.oneOf, context, "oneOf");
  }
  if (Array.isArray(object.anyOf)) {
    return convertUnion(object.anyOf, context, "anyOf");
  }
  if (Array.isArray(object.allOf)) {
    return convertAllOf(object.allOf, context);
  }

  if (Object.prototype.hasOwnProperty.call(object, "const")) {
    return applyDefault(literalExpression(object.const, context, "unsafe.literal") ?? "z.unknown()", object, context);
  }

  if (Array.isArray(object.enum)) {
    return applyDefault(convertEnum(object.enum, context), object, context);
  }

  const { types, nullable } = normalizeType(object, context);
  let expression: string;

  if (types.length > 1) {
    expression = `z.union([${types
      .map((type) => convertTypedSchema(object, type, context))
      .join(", ")}])`;
  } else {
    const type = types[0];
    expression = convertTypedSchema(object, type, context);
  }

  if (nullable) expression += ".nullable()";
  expression = applyDefault(expression, object, context);
  expression = applyConditional(expression, object, context);
  return expression;
}

function normalizeType(
  schema: Record<string, unknown>,
  context: ConvertContext,
): { types: string[]; nullable: boolean } {
  const rawType = schema.type;
  if (Array.isArray(rawType)) {
    if (context.dialect === "3.0") {
      addDiagnostic(context, "invalid.schema", "OpenAPI 3.0 schemas cannot use type arrays.", `${context.path}/type`);
    }
    const nullable = rawType.includes("null");
    const types = rawType.filter((item): item is string => typeof item === "string" && item !== "null");
    return { types: types.length > 0 ? types : ["null"], nullable };
  }

  if (typeof rawType === "string") {
    return { types: [rawType], nullable: schema.nullable === true };
  }

  if (schema.nullable === true) {
    addDiagnostic(context, "ambiguous.type", "nullable requires an explicit type.", `${context.path}/nullable`);
  }

  if (schema.properties !== undefined) {
    addDiagnostic(
      context,
      "ambiguous.type",
      "Schema has properties but no explicit type; treating it as an object.",
      context.path,
    );
    return { types: ["object"], nullable: false };
  }

  if (schema.additionalProperties !== undefined) {
    return { types: ["object"], nullable: false };
  }

  addDiagnostic(context, "ambiguous.type", "Schema has no explicit type.", context.path);
  return { types: ["unknown"], nullable: false };
}

function convertTypedSchema(
  schema: Record<string, unknown>,
  type: string,
  context: ConvertContext,
): string {
  switch (type) {
    case "string":
      return convertString(schema, context);
    case "number":
      return convertNumber("z.number()", schema, context);
    case "integer":
      return convertNumber("z.int()", schema, context);
    case "boolean":
      return "z.boolean()";
    case "null":
      return "z.null()";
    case "array":
      return convertArray(schema, context);
    case "object":
      return convertObject(schema, context);
    case "unknown":
      return "z.unknown()";
    default:
      addInvalidSchema(context, `Unsupported schema type "${type}".`);
      return "z.unknown()";
  }
}

function convertString(schema: Record<string, unknown>, context: ConvertContext): string {
  let expression = "z.string()";
  if (typeof schema.format === "string") {
    switch (schema.format) {
      case "email":
        expression = "z.email()";
        break;
      case "uuid":
        expression = "z.uuid()";
        break;
      case "uri":
      case "url":
        expression = "z.url()";
        break;
      case "date-time":
        expression = "z.iso.datetime()";
        break;
      case "date":
        expression = "z.iso.date()";
        break;
      default:
        addDiagnostic(
          context,
          "unsupported.format",
          `Unsupported string format "${schema.format}".`,
          `${context.path}/format`,
        );
    }
  }

  if (isFiniteNumber(schema.minLength)) expression += `.min(${schema.minLength})`;
  if (isFiniteNumber(schema.maxLength)) expression += `.max(${schema.maxLength})`;
  if (typeof schema.pattern === "string") {
    const regexp = regexpExpression(schema.pattern, context, `${context.path}/pattern`);
    if (regexp) expression += `.regex(${regexp})`;
  }
  return expression;
}

function convertNumber(
  base: string,
  schema: Record<string, unknown>,
  context: ConvertContext,
): string {
  let expression = base;

  if (context.dialect === "3.0" && isFiniteNumber(schema.exclusiveMinimum)) {
    addDiagnostic(context, "invalid.numericConstraint", "OpenAPI 3.0 exclusiveMinimum must be boolean.", `${context.path}/exclusiveMinimum`);
  }
  if (context.dialect === "3.0" && isFiniteNumber(schema.exclusiveMaximum)) {
    addDiagnostic(context, "invalid.numericConstraint", "OpenAPI 3.0 exclusiveMaximum must be boolean.", `${context.path}/exclusiveMaximum`);
  }
  if (context.dialect === "3.1" && typeof schema.exclusiveMinimum === "boolean") {
    addDiagnostic(context, "invalid.numericConstraint", "OpenAPI 3.1 exclusiveMinimum must be numeric.", `${context.path}/exclusiveMinimum`);
  }
  if (context.dialect === "3.1" && typeof schema.exclusiveMaximum === "boolean") {
    addDiagnostic(context, "invalid.numericConstraint", "OpenAPI 3.1 exclusiveMaximum must be numeric.", `${context.path}/exclusiveMaximum`);
  }

  if (isFiniteNumber(schema.exclusiveMinimum)) {
    expression += `.gt(${schema.exclusiveMinimum})`;
  } else if (schema.exclusiveMinimum === true && isFiniteNumber(schema.minimum)) {
    expression += `.gt(${schema.minimum})`;
  } else if (isFiniteNumber(schema.minimum)) {
    expression += `.gte(${schema.minimum})`;
  }

  if (isFiniteNumber(schema.exclusiveMaximum)) {
    expression += `.lt(${schema.exclusiveMaximum})`;
  } else if (schema.exclusiveMaximum === true && isFiniteNumber(schema.maximum)) {
    expression += `.lt(${schema.maximum})`;
  } else if (isFiniteNumber(schema.maximum)) {
    expression += `.lte(${schema.maximum})`;
  }

  if (schema.exclusiveMinimum !== undefined && schema.exclusiveMinimum !== true && !isFiniteNumber(schema.exclusiveMinimum)) {
    addDiagnostic(context, "invalid.numericConstraint", "exclusiveMinimum must be numeric or true.", `${context.path}/exclusiveMinimum`);
  }
  if (schema.exclusiveMaximum !== undefined && schema.exclusiveMaximum !== true && !isFiniteNumber(schema.exclusiveMaximum)) {
    addDiagnostic(context, "invalid.numericConstraint", "exclusiveMaximum must be numeric or true.", `${context.path}/exclusiveMaximum`);
  }
  if (isFiniteNumber(schema.multipleOf)) expression += `.multipleOf(${schema.multipleOf})`;
  return expression;
}

function convertArray(schema: Record<string, unknown>, context: ConvertContext): string {
  if (Array.isArray(schema.prefixItems)) {
    const tupleItems = schema.prefixItems.map((item, index) =>
      convertSchema(item, { ...context, path: `${context.path}/prefixItems/${index}`, inProperty: false }),
    );
    const rest = schema.items === undefined
      ? undefined
      : convertSchema(schema.items, { ...context, path: `${context.path}/items`, inProperty: false });
    let expression = rest === undefined
      ? `z.tuple([${tupleItems.join(", ")}])`
      : `z.tuple([${tupleItems.join(", ")}], ${rest})`;
    expression = applyArrayConstraints(expression, schema, context);
    return expression;
  }

  let itemExpression = "z.unknown()";
  if (schema.items === undefined) {
    addDiagnostic(context, "ambiguous.arrayItems", "Array items are missing; using unknown.", `${context.path}/items`);
  } else {
    itemExpression = convertSchema(schema.items, { ...context, path: `${context.path}/items`, inProperty: false });
  }

  let expression = `z.array(${itemExpression})`;
  expression = applyArrayConstraints(expression, schema, context);
  return expression;
}

function applyArrayConstraints(
  expression: string,
  schema: Record<string, unknown>,
  context: ConvertContext,
): string {
  if (isFiniteNumber(schema.minItems)) expression += `.min(${schema.minItems})`;
  if (isFiniteNumber(schema.maxItems)) expression += `.max(${schema.maxItems})`;
  if (schema.uniqueItems === true) {
    context.helpers.add("uniqueItems");
    expression += ".superRefine((items, ctx) => __openapiZodUniqueItems(items, ctx))";
  }
  if (schema.contains !== undefined) {
    context.helpers.add("contains");
    const containsSchema = convertSchema(schema.contains, { ...context, path: `${context.path}/contains`, inProperty: false });
    const min = isFiniteNumber(schema.minContains) ? schema.minContains : 1;
    const max = isFiniteNumber(schema.maxContains) ? schema.maxContains : undefined;
    expression += `.superRefine((items, ctx) => __openapiZodContains(items, ctx, ${containsSchema}, ${min}, ${max === undefined ? "undefined" : max}))`;
  }
  return expression;
}

function convertObject(schema: Record<string, unknown>, context: ConvertContext): string {
  const properties = asRecord(schema.properties);
  const propertyNames = Object.keys(properties ?? {}).sort();

  if (propertyNames.length === 0) {
    if (isSchemaObject(schema.additionalProperties)) {
      const expression = `z.record(z.string(), ${convertSchema(schema.additionalProperties, {
        ...context,
        path: `${context.path}/additionalProperties`,
        inProperty: false,
      })})`;
      return applyObjectConstraints(expression, schema, context);
    }
    if (schema.additionalProperties === true || schema.additionalProperties === undefined) {
      if (schema.additionalProperties === undefined) {
        addDiagnostic(
          context,
          "ambiguous.recordValue",
          "Object has no properties or additionalProperties schema; using unknown record values.",
          context.path,
        );
      }
      return applyObjectConstraints("z.record(z.string(), z.unknown())", schema, context);
    }
  }

  const required = new Set(Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === "string") : []);
  const base =
    schema.additionalProperties === false || context.options.strictObjects
      ? "z.strictObject"
      : "z.object";
  const lines = [`${base}({`];
  for (const propertyName of propertyNames) {
    let propertyExpression = convertSchema(properties![propertyName], {
      ...context,
      path: `${context.path}/properties/${escapePointer(propertyName)}`,
      inProperty: true,
    });
    if (!required.has(propertyName)) propertyExpression += ".optional()";
    lines.push(`  ${propertyKey(propertyName)}: ${propertyExpression},`);
  }
  lines.push("})");
  let expression = lines.join("\n");

  if (propertyNames.length > 0 && isSchemaObject(schema.additionalProperties)) {
    expression += `.catchall(${convertSchema(schema.additionalProperties, {
      ...context,
      path: `${context.path}/additionalProperties`,
      inProperty: false,
    })})`;
  }
  expression = applyObjectConstraints(expression, schema, context);
  return expression;
}

function convertEnum(values: unknown[], context: ConvertContext): string {
  if (values.length === 1) {
    return literalExpression(values[0], context, "unsafe.literal") ?? "z.unknown()";
  }

  if (values.every((value) => typeof value === "string")) {
    return `z.enum([${values.map((value) => JSON.stringify(value)).join(", ")}])`;
  }

  const literals = values.map((value) => literalExpression(value, context, "unsafe.literal") ?? "z.unknown()");
  return `z.union([${literals.join(", ")}])`;
}

function applyObjectConstraints(
  expression: string,
  schema: Record<string, unknown>,
  context: ConvertContext,
): string {
  let result = expression;
  if (isFiniteNumber(schema.minProperties)) {
    result += `.refine((value) => Object.keys(value).length >= ${schema.minProperties}, { message: "Expected at least ${schema.minProperties} properties." })`;
  }
  if (isFiniteNumber(schema.maxProperties)) {
    result += `.refine((value) => Object.keys(value).length <= ${schema.maxProperties}, { message: "Expected at most ${schema.maxProperties} properties." })`;
  }
  if (schema.propertyNames !== undefined) {
    context.helpers.add("propertyNames");
    const propertyNameSchema = convertSchema(schema.propertyNames, {
      ...context,
      path: `${context.path}/propertyNames`,
      inProperty: false,
    });
    result += `.superRefine((value, ctx) => __openapiZodPropertyNames(value, ctx, ${propertyNameSchema}))`;
  }
  const patternProperties = asRecord(schema.patternProperties);
  if (patternProperties) {
    const patterns: string[] = [];
    for (const key of Object.keys(patternProperties).sort()) {
      const regexp = regexpExpression(key, context, `${context.path}/patternProperties/${escapePointer(key)}`);
      if (!regexp) continue;
      const valueSchema = convertSchema(patternProperties[key], {
        ...context,
        path: `${context.path}/patternProperties/${escapePointer(key)}`,
        inProperty: false,
      });
      patterns.push(`[${regexp}, ${valueSchema}]`);
    }
    if (patterns.length > 0) {
      context.helpers.add("patternProperties");
      result += `.superRefine((value, ctx) => __openapiZodPatternProperties(value, ctx, [${patterns.join(", ")}]))`;
    }
  }
  const dependentRequired = asRecord(schema.dependentRequired);
  if (dependentRequired) {
    const dependencies: Record<string, unknown> = {};
    for (const key of Object.keys(dependentRequired).sort()) {
      const values = dependentRequired[key];
      if (Array.isArray(values) && values.every((item) => typeof item === "string")) {
        dependencies[key] = values.slice().sort();
      } else {
        addDiagnostic(context, "invalid.schema", "dependentRequired values must be string arrays.", `${context.path}/dependentRequired/${escapePointer(key)}`);
      }
    }
    if (Object.keys(dependencies).length > 0) {
      context.helpers.add("dependentRequired");
      result += `.superRefine((value, ctx) => __openapiZodDependentRequired(value, ctx, ${literalObjectExpression(dependencies, 0)}))`;
    }
  }
  const dependentSchemas = asRecord(schema.dependentSchemas);
  if (dependentSchemas) {
    const entries: string[] = [];
    for (const key of Object.keys(dependentSchemas).sort()) {
      const child = convertSchema(dependentSchemas[key], {
        ...context,
        path: `${context.path}/dependentSchemas/${escapePointer(key)}`,
        inProperty: false,
      });
      entries.push(`[${JSON.stringify(key)}, ${child}]`);
    }
    if (entries.length > 0) {
      context.helpers.add("dependentSchemas");
      result += `.superRefine((value, ctx) => __openapiZodDependentSchemas(value, ctx, [${entries.join(", ")}]))`;
    }
  }
  return result;
}

function areBranchesProvablyDisjoint(branches: unknown[]): boolean {
  const signatures = branches.map(branchSignature);
  if (signatures.some((signature) => signature === undefined)) return false;
  for (let left = 0; left < signatures.length; left += 1) {
    for (let right = left + 1; right < signatures.length; right += 1) {
      if (!signaturesDisjoint(signatures[left]!, signatures[right]!)) return false;
    }
  }
  return true;
}

type BranchSignature =
  | { kind: "type"; value: string }
  | { kind: "literal"; value: unknown }
  | { kind: "enum"; values: unknown[] };

function branchSignature(branch: unknown): BranchSignature | undefined {
  const object = asRecord(branch);
  if (!object) return undefined;
  if (Object.prototype.hasOwnProperty.call(object, "const")) return { kind: "literal", value: object.const };
  if (Array.isArray(object.enum)) return { kind: "enum", values: object.enum };
  const { types } = normalizeTypeForSignature(object);
  return types.length === 1 ? { kind: "type", value: types[0]! } : undefined;
}

function normalizeTypeForSignature(schema: Record<string, unknown>): { types: string[] } {
  if (Array.isArray(schema.type)) {
    return { types: schema.type.filter((item): item is string => typeof item === "string") };
  }
  return typeof schema.type === "string" ? { types: [schema.type] } : { types: [] };
}

function signaturesDisjoint(left: BranchSignature, right: BranchSignature): boolean {
  if (left.kind === "type" && right.kind === "type") return left.value !== right.value;
  const leftValues = signatureLiteralValues(left);
  const rightValues = signatureLiteralValues(right);
  if (leftValues && rightValues) {
    return !leftValues.some((leftValue) => rightValues.some((rightValue) => jsonLiteral(leftValue) === jsonLiteral(rightValue)));
  }
  if (leftValues && right.kind === "type") return leftValues.every((value) => literalType(value) !== right.value);
  if (rightValues && left.kind === "type") return rightValues.every((value) => literalType(value) !== left.value);
  return false;
}

function signatureLiteralValues(signature: BranchSignature): unknown[] | undefined {
  if (signature.kind === "literal") return [signature.value];
  if (signature.kind === "enum") return signature.values;
  return undefined;
}

function literalType(value: unknown): string {
  if (Number.isInteger(value)) return "integer";
  if (typeof value === "number") return "number";
  if (value === null) return "null";
  return typeof value;
}

function convertUnion(branches: unknown[], context: ConvertContext, keyword: "oneOf" | "anyOf"): string {
  const expressions = branches.map((branch, index) =>
    convertSchema(branch, { ...context, path: `${context.path}/${keyword}/${index}`, inProperty: false }),
  );
  const union = `z.union([${expressions.join(", ")}])`;
  if (keyword === "oneOf" && !areBranchesProvablyDisjoint(branches)) {
    context.helpers.add("oneOf");
    return `z.unknown().superRefine((value, ctx) => __openapiZodOneOf(value, ctx, [${expressions.join(", ")}])).pipe(${union})`;
  }
  return union;
}

function convertAllOf(branches: unknown[], context: ConvertContext): string {
  const objectBranches = branches.map((branch) => asRecord(branch)).filter((branch): branch is Record<string, unknown> => !!branch);
  if (objectBranches.length === branches.length && objectBranches.every(isObjectLikeBranch)) {
    const merged: Record<string, unknown> = { type: "object", properties: {}, required: [] };
    const properties = merged.properties as Record<string, unknown>;
    const required = merged.required as string[];
    for (const [index, branch] of objectBranches.entries()) {
      const branchProperties = asRecord(branch.properties) ?? {};
      for (const [key, value] of Object.entries(branchProperties)) {
        if (properties[key] !== undefined) {
          addDiagnostic(
            context,
            "unsupported.composition.conflict",
            `allOf property "${key}" is defined by multiple branches.`,
            `${context.path}/allOf/${index}/properties/${escapePointer(key)}`,
          );
        } else {
          properties[key] = value;
        }
      }
      if (Array.isArray(branch.required)) {
        for (const item of branch.required) {
          if (typeof item === "string" && !required.includes(item)) required.push(item);
        }
      }
    }
    return convertObject(merged, context);
  }

  const expressions = branches.map((branch, index) =>
    convertSchema(branch, { ...context, path: `${context.path}/allOf/${index}`, inProperty: false }),
  );
  return expressions.reduce((left, right) => `z.intersection(${left}, ${right})`);
}

function isObjectLikeBranch(schema: Record<string, unknown>): boolean {
  return schema.type === "object" || schema.properties !== undefined;
}

function convertRef(ref: string, schema: Record<string, unknown>, context: ConvertContext): string {
  for (const key of Object.keys(schema)) {
    if (key !== "$ref" && key !== "nullable" && !key.startsWith("x-")) {
      addDiagnostic(context, "unsupported.refSibling", "Sibling keywords next to $ref are not supported.", `${context.path}/${escapePointer(key)}`);
    }
  }

  if (!ref.startsWith("#/components/schemas/")) {
    addDiagnostic(context, "unsupported.externalRef", "External references are not supported.", `${context.path}/$ref`);
    return "z.unknown()";
  }

  const target = unescapePointer(ref.slice("#/components/schemas/".length));
  const targetName = context.names.schemaNames.get(target);
  if (!targetName) {
    context.diagnostics.push({
      level: "error",
      code: "invalid.ref",
      path: `${context.path}/$ref`,
      message: `Reference target "${target}" was not found in components.schemas.`,
    });
    return "z.unknown()";
  }

  const edge = `${context.componentName ?? ""}->${target}`;
  const currentOrder = context.componentName
    ? (context.names.order.get(context.componentName) ?? 0)
    : 0;
  const targetOrder = context.names.order.get(target) ?? 0;
  let expression =
    context.componentName && (context.cycles.has(edge) || targetOrder > currentOrder)
      ? `z.lazy(() => ${targetName})`
      : targetName;
  if (schema.nullable === true) expression += ".nullable()";
  return expression;
}

function findCycleEdges(schemas: SchemaMap): Set<string> {
  const graph = new Map<string, Set<string>>();
  for (const [name, schema] of Object.entries(schemas)) {
    graph.set(name, collectRefs(schema));
  }

  const cycleEdges = new Set<string>();
  for (const [from, targets] of graph.entries()) {
    for (const to of targets) {
      if (hasPath(graph, to, from, new Set())) cycleEdges.add(`${from}->${to}`);
    }
  }
  return cycleEdges;
}

function componentHasCycle(componentName: string, cycles: Set<string>): boolean {
  for (const edge of cycles) {
    if (edge.startsWith(`${componentName}->`)) return true;
  }
  return false;
}

function collectRefs(schema: unknown): Set<string> {
  const refs = new Set<string>();
  const visit = (value: unknown): void => {
    const object = asRecord(value);
    if (!object) return;
    if (typeof object.$ref === "string" && object.$ref.startsWith("#/components/schemas/")) {
      refs.add(unescapePointer(object.$ref.slice("#/components/schemas/".length)));
    }
    for (const child of Object.values(object)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  visit(schema);
  return refs;
}

function hasPath(
  graph: Map<string, Set<string>>,
  from: string,
  to: string,
  seen: Set<string>,
): boolean {
  if (from === to) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  for (const next of graph.get(from) ?? []) {
    if (hasPath(graph, next, to, seen)) return true;
  }
  return false;
}

function applyDefault(
  expression: string,
  schema: Record<string, unknown>,
  context: ConvertContext,
): string {
  if (!Object.prototype.hasOwnProperty.call(schema, "default")) return expression;
  const literal = jsonLiteral(schema.default);
  if (literal === undefined) {
    addDiagnostic(context, "unsafe.default", "Default value cannot be emitted safely.", `${context.path}/default`);
    return expression;
  }
  if (!isDefaultCompatible(schema, schema.default)) {
    addDiagnostic(context, "unsafe.default", "Default value is not compatible with the schema.", `${context.path}/default`);
    return expression;
  }
  return `${expression}.default(${literal})`;
}

function applyConditional(
  expression: string,
  schema: Record<string, unknown>,
  context: ConvertContext,
): string {
  if (schema.if === undefined) return expression;
  context.helpers.add("conditional");
  const ifSchema = convertSchema(schema.if, {
    ...context,
    path: `${context.path}/if`,
    inProperty: false,
  });
  const thenSchema = schema.then === undefined
    ? "undefined"
    : convertSchema(schema.then, { ...context, path: `${context.path}/then`, inProperty: false });
  const elseSchema = schema.else === undefined
    ? "undefined"
    : convertSchema(schema.else, { ...context, path: `${context.path}/else`, inProperty: false });
  return `z.unknown().superRefine((value, ctx) => __openapiZodConditional(value, ctx, ${ifSchema}, ${thenSchema}, ${elseSchema})).pipe(${expression})`;
}

function isDefaultCompatible(schema: Record<string, unknown>, value: unknown): boolean {
  if (schema.const !== undefined) return jsonLiteral(schema.const) === jsonLiteral(value);
  if (Array.isArray(schema.enum)) {
    return schema.enum.some((item) => jsonLiteral(item) === jsonLiteral(value));
  }
  const typeInfo = normalizeTypeForSignature(schema);
  const types = typeInfo.types.filter((type) => type !== "null");
  const nullable = Array.isArray(schema.type)
    ? schema.type.includes("null")
    : schema.nullable === true;
  if (value === null) return nullable || types.includes("null");
  if (types.length === 0) return true;
  if (types.includes("integer")) return Number.isInteger(value);
  if (types.includes("number")) return typeof value === "number" && Number.isFinite(value);
  if (types.includes("string")) return typeof value === "string";
  if (types.includes("boolean")) return typeof value === "boolean";
  if (types.includes("array")) return Array.isArray(value);
  if (types.includes("object")) return !!asRecord(value);
  return true;
}

function literalExpression(
  value: unknown,
  context: ConvertContext,
  code: "unsafe.literal",
): string | undefined {
  const literal = jsonLiteral(value);
  if (literal === undefined) {
    addDiagnostic(context, code, "Literal value cannot be emitted safely.", context.path);
    return undefined;
  }
  if (Array.isArray(value) || asRecord(value)) {
    const stable = stableJson(value);
    if (stable === undefined) {
      addDiagnostic(context, code, "Literal value cannot be emitted safely.", context.path);
      return undefined;
    }
    context.helpers.add("literal");
    return `z.custom((value) => __openapiZodStableJson(value) === ${JSON.stringify(stable)})`;
  }
  return `z.literal(${literal})`;
}

function jsonLiteral(value: unknown): string | undefined {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
  if (Array.isArray(value)) {
    const values = value.map(jsonLiteral);
    return values.includes(undefined) ? undefined : `[${values.join(", ")}]`;
  }
  const object = asRecord(value);
  if (object) {
    const entries = Object.keys(object)
      .sort()
      .map((key) => {
        const child = jsonLiteral(object[key]);
        return child === undefined ? undefined : `${JSON.stringify(key)}: ${child}`;
      });
    return entries.includes(undefined) ? undefined : `{ ${entries.join(", ")} }`;
  }
  return undefined;
}

function stableJson(value: unknown): string | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
  if (Array.isArray(value)) {
    const values = value.map(stableJson);
    return values.includes(undefined) ? undefined : `[${values.join(",")}]`;
  }
  const object = asRecord(value);
  if (object) {
    const entries = Object.keys(object).sort().map((key) => {
      const child = stableJson(object[key]);
      return child === undefined ? undefined : `${JSON.stringify(key)}:${child}`;
    });
    return entries.includes(undefined) ? undefined : `{${entries.join(",")}}`;
  }
  return undefined;
}

function regexpExpression(pattern: string, context: ConvertContext, path: string): string | undefined {
  try {
    new RegExp(pattern);
    return `new RegExp(${JSON.stringify(pattern)})`;
  } catch {
    addDiagnostic(context, "invalid.schema", "Regular expression pattern is not valid JavaScript.", path);
    return undefined;
  }
}

function addDiagnostic(
  context: ConvertContext,
  code: string,
  message: string,
  path: string | undefined,
): void {
  context.diagnostics.push(diagnostic(code, message, path, context.options));
}

function addInvalidSchema(context: ConvertContext, message: string): void {
  context.diagnostics.push({
    level: "error",
    code: "invalid.schema",
    path: context.path,
    message,
  });
}

function propertyKey(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) && !reservedWords.has(value)
    ? value
    : JSON.stringify(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSchemaObject(value: unknown): value is Record<string, unknown> {
  return !!asRecord(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function escapePointer(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function unescapePointer(value: string): string {
  return value.replace(/~1/g, "/").replace(/~0/g, "~");
}
