import { diagnostic } from "./diagnostics.js";
import type { HttpMethod, SharedContext } from "./core.js";
import { httpMethods } from "./core.js";
import { arrayLiteral, arrayExpression, asRecord, capitalize, escapePointer, literalObjectExpression, objectExpression, sanitizeIdentifier, uniqueName, zodObjectExpression } from "./emit.js";
import { convertParameter, convertRequestBody, convertResponse, type ConvertedParameter } from "./components.js";

export type OperationsResult = { lines: string[]; exportNames: string[] };

export function convertOperations(documentObject: Record<string, unknown> | undefined, shared: SharedContext & { securityNames: Map<string, string> }): OperationsResult {
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
      };
      if (shared.options.includeDefaultValues || tags.length > 0) {
        operationProperties.tags = arrayLiteral(tags.map((tag) => JSON.stringify(tag)));
      }
      if (shared.options.includeDefaultValues || operation.deprecated === true) {
        operationProperties.deprecated = operation.deprecated === true ? "true" : "false";
      }
      if (shared.options.includeDefaultValues || !Array.isArray(security) || security.length > 0) {
        operationProperties.security = literalObjectExpression(security, 0);
      }
      operationProperties.request = request;
      operationProperties.responses = responses;
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
  const requestProperties: Record<string, string> = {};
  for (const key of ["params", "query", "headers", "cookies"] as const) {
    const expression = zodObjectExpression(containers[key]);
    if (shared.options.includeDefaultValues || expression !== "z.object({})") {
      requestProperties[key] = expression;
    }
  }
  if (shared.options.includeDefaultValues || body !== "undefined") {
    requestProperties.body = body;
  }
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

function isResponseStatus(value: string): boolean {
  return value === "default" || /^[1-5][0-9][0-9]$/.test(value) || /^[1-5]XX$/.test(value);
}

function responseStatusCompare(left: string, right: string): number {
  if (left === "default") return right === "default" ? 0 : 1;
  if (right === "default") return -1;
  return left.localeCompare(right);
}
