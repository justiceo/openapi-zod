import { diagnostic } from "./diagnostics.js";
import { asRecord, escapePointer, literalObjectExpression, objectExpression, propertyKey, sanitizeIdentifier, uniqueName, unescapePointer, zodObjectExpression } from "./emit.js";
import { convertSchema } from "./schema.js";
export function metadataExpression(documentObject, diagnostics, options) {
    const metadata = {};
    if (!documentObject)
        return "{}";
    if (typeof documentObject.openapi === "string")
        metadata.openapi = documentObject.openapi;
    const info = asRecord(documentObject.info);
    if (info) {
        const metadataInfo = {};
        for (const key of ["title", "version", "summary", "description", "termsOfService"]) {
            if (typeof info[key] === "string")
                metadataInfo[key] = info[key];
            else if (info[key] !== undefined) {
                diagnostics.push(diagnostic("invalid.metadata", `${key} must be a string.`, `#/info/${key}`, options));
            }
        }
        metadata.info = metadataInfo;
    }
    else if (documentObject.info !== undefined) {
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
            const output = { url: object.url };
            if (typeof object.description === "string")
                output.description = object.description;
            if (object.variables !== undefined)
                output.variables = object.variables;
            return output;
        })
            .filter((server) => !!server);
    }
    if (Array.isArray(documentObject.tags)) {
        metadata.tags = documentObject.tags
            .map((tag, index) => {
            const object = asRecord(tag);
            if (!object || typeof object.name !== "string") {
                diagnostics.push(diagnostic("invalid.metadata", "Tag name must be a string.", `#/tags/${index}/name`, options));
                return undefined;
            }
            const output = { name: object.name };
            if (typeof object.description === "string")
                output.description = object.description;
            if (object.externalDocs !== undefined)
                output.externalDocs = object.externalDocs;
            return output;
        })
            .filter((tag) => !!tag);
    }
    if (documentObject.externalDocs !== undefined)
        metadata.externalDocs = documentObject.externalDocs;
    return literalObjectExpression(metadata, 0);
}
export function convertReusableComponents(documentObject, shared) {
    const components = asRecord(documentObject?.components) ?? {};
    const result = {
        lines: [],
        parameterNames: new Map(),
        requestBodyNames: new Map(),
        responseNames: new Map(),
        headerNames: new Map(),
        securityNames: new Map(),
    };
    const used = new Map();
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
    const withNames = { ...shared, reusableNames: result };
    for (const name of Object.keys(headers).sort()) {
        const exportName = result.headerNames.get(name);
        result.lines.push("", `export const ${exportName} = ${convertHeader(headers[name], `${exportName}`, `#/components/headers/${escapePointer(name)}`, withNames)};`);
    }
    for (const name of Object.keys(parameters).sort()) {
        const exportName = result.parameterNames.get(name);
        result.lines.push("", `export const ${exportName} = ${convertParameter(parameters[name], `#/components/parameters/${escapePointer(name)}`, withNames).schema};`);
    }
    for (const name of Object.keys(requestBodies).sort()) {
        const exportName = result.requestBodyNames.get(name);
        result.lines.push("", `export const ${exportName} = ${convertRequestBody(requestBodies[name], `#/components/requestBodies/${escapePointer(name)}`, withNames)};`);
    }
    for (const name of Object.keys(responses).sort()) {
        const exportName = result.responseNames.get(name);
        result.lines.push("", `export const ${exportName} = ${convertResponse(responses[name], `#/components/responses/${escapePointer(name)}`, withNames)};`);
    }
    for (const name of Object.keys(securitySchemes).sort()) {
        const exportName = result.securityNames.get(name);
        if (shared.options.includeSecurityValidators) {
            result.lines.push("", `export const ${exportName} = ${convertSecurityScheme(securitySchemes[name], `#/components/securitySchemes/${escapePointer(name)}`, withNames)};`);
        }
    }
    return result;
}
export function convertParameter(parameter, path, shared) {
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
    let schema;
    if (object.schema !== undefined) {
        schema = convertSchema(object.schema, schemaContext(shared, `${path}/schema`));
    }
    else {
        const contentSchema = schemaFromContent(object.content, `${path}/content`, shared);
        schema = contentSchema ?? "z.unknown()";
        if (!contentSchema)
            shared.diagnostics.push(diagnostic("invalid.parameter", "Parameter must define schema or supported content.", path, shared.options));
    }
    const required = rawIn === "path" ? true : object.required === true;
    if (rawIn === "path" && object.required === false) {
        shared.diagnostics.push(diagnostic("invalid.pathParameter", "Path parameters must be required.", `${path}/required`, shared.options));
    }
    if (!required)
        schema += ".optional()";
    const key = rawIn === "header" ? rawName.toLowerCase() : rawName;
    return {
        name: key,
        location: location ?? "query",
        schema,
        required,
        serialization: parameterSerializationExpression(object, rawIn, rawName),
    };
}
export function convertHeader(header, _name, path, shared) {
    const refName = reusableRefName(header, "headers", path, shared);
    if (refName)
        return refName;
    if (isRefObject(header))
        return "z.unknown().optional()";
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
export function convertRequestBody(body, path, shared) {
    const refName = reusableRefName(body, "requestBodies", path, shared);
    if (refName)
        return refName;
    if (isRefObject(body))
        return "undefined";
    const object = resolveReusableRef(body, "requestBodies", path, shared) ?? asRecord(body);
    if (!object) {
        shared.diagnostics.push(diagnostic("invalid.requestBody", "Request body must be an object.", path, shared.options));
        return "undefined";
    }
    const entries = contentEntries(object.content, path, "requestBody", shared);
    if (entries.length === 0)
        return "undefined";
    const required = object.required === true;
    if (entries.length === 1) {
        const expression = entries[0][1];
        return required ? expression : `${expression}.optional()`;
    }
    return objectExpression(Object.fromEntries(entries), 0);
}
export function convertResponse(response, path, shared) {
    const refName = reusableRefName(response, "responses", path, shared);
    if (refName)
        return refName;
    if (isRefObject(response))
        return defaultResponseExpression(shared);
    const object = resolveReusableRef(response, "responses", path, shared) ?? asRecord(response);
    if (!object) {
        shared.diagnostics.push(diagnostic("invalid.response", "Response must be an object.", path, shared.options));
        return defaultResponseExpression(shared);
    }
    const headers = asRecord(object.headers) ?? {};
    const headerSchemas = {};
    for (const name of Object.keys(headers).sort()) {
        headerSchemas[name.toLowerCase()] = convertHeader(headers[name], name, `${path}/headers/${escapePointer(name)}`, shared);
    }
    const entries = contentEntries(object.content, path, "response", shared);
    if (object.links !== undefined) {
        shared.diagnostics.push(diagnostic("unsupported.links", "Response links are not supported.", `${path}/links`, shared.options));
    }
    const responseProperties = {};
    if (shared.options.includeDefaultValues || typeof object.description === "string") {
        responseProperties.description = JSON.stringify(typeof object.description === "string" ? object.description : "");
    }
    if (shared.options.includeDefaultValues || Object.keys(headerSchemas).length > 0) {
        responseProperties.headers = zodObjectExpression(headerSchemas);
    }
    if (shared.options.includeDefaultValues || entries.length > 0) {
        responseProperties.content = objectExpression(Object.fromEntries(entries), 0);
    }
    return objectExpression(responseProperties, 0);
}
export function defaultResponseExpression(shared) {
    if (!shared.options.includeDefaultValues)
        return "{}";
    return "{ description: \"\", headers: z.object({}), content: {} }";
}
export function convertSecurityScheme(scheme, path, shared) {
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
        if (object.scheme === "basic")
            return 'z.object({ headers: z.object({ authorization: z.string().regex(new RegExp("^Basic .+$")) }) })';
        if (object.scheme === "bearer")
            return 'z.object({ headers: z.object({ authorization: z.string().regex(new RegExp("^Bearer .+$")) }) })';
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
function parameterLocation(value) {
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
function validateParameterSerialization(parameter, location, path, shared) {
    const style = parameter.style;
    const explode = parameter.explode;
    const isDefault = (location === "path" && (style === undefined || style === "simple") && (explode === undefined || explode === false)) ||
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
function parameterSerializationExpression(parameter, location, name) {
    const metadata = {
        in: location,
        name,
    };
    let hasExplicitSerialization = false;
    for (const key of ["style", "explode", "allowReserved", "allowEmptyValue"]) {
        if (parameter[key] !== undefined) {
            metadata[key] = parameter[key];
            hasExplicitSerialization = true;
        }
    }
    return hasExplicitSerialization ? literalObjectExpression(metadata, 0) : undefined;
}
function validateHeaderSerialization(header, path, shared) {
    const style = header.style;
    const explode = header.explode;
    if ((style !== undefined && style !== "simple") || (explode !== undefined && explode !== false)) {
        shared.diagnostics.push(diagnostic("unsupported.headerSerialization", "Header serialization is not supported.", path, shared.options));
    }
}
function schemaFromContent(content, path, shared) {
    const object = asRecord(content);
    if (!object)
        return undefined;
    const matching = shared.options.mediaTypes.filter((mediaType) => object[mediaType] !== undefined);
    if (matching.length !== 1) {
        shared.diagnostics.push(diagnostic("unsupported.mediaType", "Content must contain exactly one configured media type.", path, shared.options));
        return undefined;
    }
    const media = asRecord(object[matching[0]]);
    return media?.schema === undefined
        ? undefined
        : convertSchema(media.schema, schemaContext(shared, `${path}/${escapePointer(matching[0])}/schema`));
}
function contentEntries(content, parentPath, kind, shared) {
    const object = asRecord(content);
    if (!object)
        return [];
    const entries = [];
    for (const mediaType of shared.options.mediaTypes) {
        if (object[mediaType] === undefined)
            continue;
        const media = asRecord(object[mediaType]);
        const schemaPath = `${parentPath}/content/${escapePointer(mediaType)}/schema`;
        if (!media || media.schema === undefined) {
            const code = kind === "requestBody" ? "ambiguous.requestBodySchema" : "ambiguous.responseBodySchema";
            shared.diagnostics.push(diagnostic(code, "Selected media type is missing a schema; using unknown.", schemaPath, shared.options));
            entries.push([mediaType, "z.unknown()"]);
        }
        else {
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
function resolveReusableRef(value, kind, path, shared) {
    const object = asRecord(value);
    if (!object || typeof object.$ref !== "string")
        return undefined;
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
function reusableRefName(value, kind, path, shared) {
    const object = asRecord(value);
    if (!object || typeof object.$ref !== "string")
        return undefined;
    const prefix = `#/components/${kind}/`;
    if (!object.$ref.startsWith(prefix)) {
        shared.diagnostics.push(diagnostic("unsupported.externalRef", "External references are not supported.", `${path}/$ref`, shared.options));
        return undefined;
    }
    const name = unescapePointer(object.$ref.slice(prefix.length));
    const names = shared.reusableNames;
    const exportName = kind === "parameters" ? names?.parameterNames.get(name)
        : kind === "headers" ? names?.headerNames.get(name)
            : kind === "requestBodies" ? names?.requestBodyNames.get(name)
                : names?.responseNames.get(name);
    if (!exportName) {
        shared.diagnostics.push(diagnostic("invalid.ref", `Reference target "${name}" was not found in components.${kind}.`, `${path}/$ref`, shared.options));
    }
    return exportName;
}
function isRefObject(value) {
    return typeof asRecord(value)?.$ref === "string";
}
function schemaContext(shared, path) {
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
