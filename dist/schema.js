import { diagnostic } from "./diagnostics.js";
import { asRecord, escapePointer, isFiniteNumber, isSchemaObject, jsonLiteral, literalObjectExpression, propertyKey, stableJson, unescapePointer } from "./emit.js";
export function convertSchema(schema, context) {
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
    for (const keyword of ["unevaluatedProperties", "unevaluatedItems"]) {
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
    let expression;
    if (types.length > 1) {
        expression = `z.union([${types
            .map((type) => convertTypedSchema(object, type, context))
            .join(", ")}])`;
    }
    else {
        const type = types[0];
        expression = convertTypedSchema(object, type, context);
    }
    if (nullable)
        expression += ".nullable()";
    expression = applyDefault(expression, object, context);
    expression = applyConditional(expression, object, context);
    return expression;
}
function normalizeType(schema, context) {
    const rawType = schema.type;
    if (Array.isArray(rawType)) {
        if (context.dialect === "3.0") {
            addDiagnostic(context, "invalid.schema", "OpenAPI 3.0 schemas cannot use type arrays.", `${context.path}/type`);
        }
        const nullable = rawType.includes("null");
        const types = rawType.filter((item) => typeof item === "string" && item !== "null");
        return { types: types.length > 0 ? types : ["null"], nullable };
    }
    if (typeof rawType === "string") {
        return { types: [rawType], nullable: schema.nullable === true };
    }
    if (schema.nullable === true) {
        addDiagnostic(context, "ambiguous.type", "nullable requires an explicit type.", `${context.path}/nullable`);
    }
    if (schema.properties !== undefined) {
        addDiagnostic(context, "ambiguous.type", "Schema has properties but no explicit type; treating it as an object.", context.path);
        return { types: ["object"], nullable: false };
    }
    if (schema.additionalProperties !== undefined) {
        return { types: ["object"], nullable: false };
    }
    addDiagnostic(context, "ambiguous.type", "Schema has no explicit type.", context.path);
    return { types: ["unknown"], nullable: false };
}
function convertTypedSchema(schema, type, context) {
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
function convertString(schema, context) {
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
                addDiagnostic(context, "unsupported.format", `Unsupported string format "${schema.format}".`, `${context.path}/format`);
        }
    }
    if (isFiniteNumber(schema.minLength))
        expression += `.min(${schema.minLength})`;
    if (isFiniteNumber(schema.maxLength))
        expression += `.max(${schema.maxLength})`;
    if (typeof schema.pattern === "string") {
        const regexp = regexpExpression(schema.pattern, context, `${context.path}/pattern`);
        if (regexp)
            expression += `.regex(${regexp})`;
    }
    return expression;
}
function convertNumber(base, schema, context) {
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
    }
    else if (schema.exclusiveMinimum === true && isFiniteNumber(schema.minimum)) {
        expression += `.gt(${schema.minimum})`;
    }
    else if (isFiniteNumber(schema.minimum)) {
        expression += `.gte(${schema.minimum})`;
    }
    if (isFiniteNumber(schema.exclusiveMaximum)) {
        expression += `.lt(${schema.exclusiveMaximum})`;
    }
    else if (schema.exclusiveMaximum === true && isFiniteNumber(schema.maximum)) {
        expression += `.lt(${schema.maximum})`;
    }
    else if (isFiniteNumber(schema.maximum)) {
        expression += `.lte(${schema.maximum})`;
    }
    if (schema.exclusiveMinimum !== undefined && schema.exclusiveMinimum !== true && !isFiniteNumber(schema.exclusiveMinimum)) {
        addDiagnostic(context, "invalid.numericConstraint", "exclusiveMinimum must be numeric or true.", `${context.path}/exclusiveMinimum`);
    }
    if (schema.exclusiveMaximum !== undefined && schema.exclusiveMaximum !== true && !isFiniteNumber(schema.exclusiveMaximum)) {
        addDiagnostic(context, "invalid.numericConstraint", "exclusiveMaximum must be numeric or true.", `${context.path}/exclusiveMaximum`);
    }
    if (isFiniteNumber(schema.multipleOf))
        expression += `.multipleOf(${schema.multipleOf})`;
    return expression;
}
function convertArray(schema, context) {
    if (Array.isArray(schema.prefixItems)) {
        const tupleItems = schema.prefixItems.map((item, index) => convertSchema(item, { ...context, path: `${context.path}/prefixItems/${index}`, inProperty: false }));
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
    }
    else {
        itemExpression = convertSchema(schema.items, { ...context, path: `${context.path}/items`, inProperty: false });
    }
    let expression = `z.array(${itemExpression})`;
    expression = applyArrayConstraints(expression, schema, context);
    return expression;
}
function applyArrayConstraints(expression, schema, context) {
    if (isFiniteNumber(schema.minItems))
        expression += `.min(${schema.minItems})`;
    if (isFiniteNumber(schema.maxItems))
        expression += `.max(${schema.maxItems})`;
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
function convertObject(schema, context) {
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
                addDiagnostic(context, "ambiguous.recordValue", "Object has no properties or additionalProperties schema; using unknown record values.", context.path);
            }
            return applyObjectConstraints("z.record(z.string(), z.unknown())", schema, context);
        }
    }
    const required = new Set(Array.isArray(schema.required) ? schema.required.filter((item) => typeof item === "string") : []);
    const base = schema.additionalProperties === false || context.options.strictObjects
        ? "z.strictObject"
        : "z.object";
    const lines = [`${base}({`];
    for (const propertyName of propertyNames) {
        let propertyExpression = convertSchema(properties[propertyName], {
            ...context,
            path: `${context.path}/properties/${escapePointer(propertyName)}`,
            inProperty: true,
        });
        if (!required.has(propertyName))
            propertyExpression += ".optional()";
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
function convertEnum(values, context) {
    if (values.length === 1) {
        return literalExpression(values[0], context, "unsafe.literal") ?? "z.unknown()";
    }
    if (values.every((value) => typeof value === "string")) {
        return `z.enum([${values.map((value) => JSON.stringify(value)).join(", ")}])`;
    }
    const literals = values.map((value) => literalExpression(value, context, "unsafe.literal") ?? "z.unknown()");
    return `z.union([${literals.join(", ")}])`;
}
function applyObjectConstraints(expression, schema, context) {
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
        const patterns = [];
        for (const key of Object.keys(patternProperties).sort()) {
            const regexp = regexpExpression(key, context, `${context.path}/patternProperties/${escapePointer(key)}`);
            if (!regexp)
                continue;
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
        const dependencies = {};
        for (const key of Object.keys(dependentRequired).sort()) {
            const values = dependentRequired[key];
            if (Array.isArray(values) && values.every((item) => typeof item === "string")) {
                dependencies[key] = values.slice().sort();
            }
            else {
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
        const entries = [];
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
function areBranchesProvablyDisjoint(branches) {
    const signatures = branches.map(branchSignature);
    if (signatures.some((signature) => signature === undefined))
        return false;
    for (let left = 0; left < signatures.length; left += 1) {
        for (let right = left + 1; right < signatures.length; right += 1) {
            if (!signaturesDisjoint(signatures[left], signatures[right]))
                return false;
        }
    }
    return true;
}
function branchSignature(branch) {
    const object = asRecord(branch);
    if (!object)
        return undefined;
    if (Object.prototype.hasOwnProperty.call(object, "const"))
        return { kind: "literal", value: object.const };
    if (Array.isArray(object.enum))
        return { kind: "enum", values: object.enum };
    const { types } = normalizeTypeForSignature(object);
    return types.length === 1 ? { kind: "type", value: types[0] } : undefined;
}
function normalizeTypeForSignature(schema) {
    if (Array.isArray(schema.type)) {
        return { types: schema.type.filter((item) => typeof item === "string") };
    }
    return typeof schema.type === "string" ? { types: [schema.type] } : { types: [] };
}
function signaturesDisjoint(left, right) {
    if (left.kind === "type" && right.kind === "type")
        return left.value !== right.value;
    const leftValues = signatureLiteralValues(left);
    const rightValues = signatureLiteralValues(right);
    if (leftValues && rightValues) {
        return !leftValues.some((leftValue) => rightValues.some((rightValue) => jsonLiteral(leftValue) === jsonLiteral(rightValue)));
    }
    if (leftValues && right.kind === "type")
        return leftValues.every((value) => literalType(value) !== right.value);
    if (rightValues && left.kind === "type")
        return rightValues.every((value) => literalType(value) !== left.value);
    return false;
}
function signatureLiteralValues(signature) {
    if (signature.kind === "literal")
        return [signature.value];
    if (signature.kind === "enum")
        return signature.values;
    return undefined;
}
function literalType(value) {
    if (Number.isInteger(value))
        return "integer";
    if (typeof value === "number")
        return "number";
    if (value === null)
        return "null";
    return typeof value;
}
function convertUnion(branches, context, keyword) {
    const expressions = branches.map((branch, index) => convertSchema(branch, { ...context, path: `${context.path}/${keyword}/${index}`, inProperty: false }));
    const union = `z.union([${expressions.join(", ")}])`;
    if (keyword === "oneOf" && !areBranchesProvablyDisjoint(branches)) {
        context.helpers.add("oneOf");
        return `z.unknown().superRefine((value, ctx) => __openapiZodOneOf(value, ctx, [${expressions.join(", ")}])).pipe(${union})`;
    }
    return union;
}
function convertAllOf(branches, context) {
    const objectBranches = branches.map((branch) => asRecord(branch)).filter((branch) => !!branch);
    if (objectBranches.length === branches.length && objectBranches.every(isObjectLikeBranch)) {
        const merged = { type: "object", properties: {}, required: [] };
        const properties = merged.properties;
        const required = merged.required;
        for (const [index, branch] of objectBranches.entries()) {
            const branchProperties = asRecord(branch.properties) ?? {};
            for (const [key, value] of Object.entries(branchProperties)) {
                if (properties[key] !== undefined) {
                    addDiagnostic(context, "unsupported.composition.conflict", `allOf property "${key}" is defined by multiple branches.`, `${context.path}/allOf/${index}/properties/${escapePointer(key)}`);
                }
                else {
                    properties[key] = value;
                }
            }
            if (Array.isArray(branch.required)) {
                for (const item of branch.required) {
                    if (typeof item === "string" && !required.includes(item))
                        required.push(item);
                }
            }
        }
        return convertObject(merged, context);
    }
    const expressions = branches.map((branch, index) => convertSchema(branch, { ...context, path: `${context.path}/allOf/${index}`, inProperty: false }));
    return expressions.reduce((left, right) => `z.intersection(${left}, ${right})`);
}
function isObjectLikeBranch(schema) {
    return schema.type === "object" || schema.properties !== undefined;
}
function convertRef(ref, schema, context) {
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
    let expression = context.componentName && (context.cycles.has(edge) || targetOrder > currentOrder)
        ? `z.lazy(() => ${targetName})`
        : targetName;
    if (schema.nullable === true)
        expression += ".nullable()";
    return expression;
}
export function findCycleEdges(schemas) {
    const graph = new Map();
    for (const [name, schema] of Object.entries(schemas)) {
        graph.set(name, collectRefs(schema));
    }
    const cycleEdges = new Set();
    for (const [from, targets] of graph.entries()) {
        for (const to of targets) {
            if (hasPath(graph, to, from, new Set()))
                cycleEdges.add(`${from}->${to}`);
        }
    }
    return cycleEdges;
}
export function componentHasCycle(componentName, cycles) {
    for (const edge of cycles) {
        if (edge.startsWith(`${componentName}->`))
            return true;
    }
    return false;
}
function collectRefs(schema) {
    const refs = new Set();
    const visit = (value) => {
        const object = asRecord(value);
        if (!object)
            return;
        if (typeof object.$ref === "string" && object.$ref.startsWith("#/components/schemas/")) {
            refs.add(unescapePointer(object.$ref.slice("#/components/schemas/".length)));
        }
        for (const child of Object.values(object)) {
            if (Array.isArray(child))
                child.forEach(visit);
            else
                visit(child);
        }
    };
    visit(schema);
    return refs;
}
function hasPath(graph, from, to, seen) {
    if (from === to)
        return true;
    if (seen.has(from))
        return false;
    seen.add(from);
    for (const next of graph.get(from) ?? []) {
        if (hasPath(graph, next, to, seen))
            return true;
    }
    return false;
}
function applyDefault(expression, schema, context) {
    if (!Object.prototype.hasOwnProperty.call(schema, "default"))
        return expression;
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
function applyConditional(expression, schema, context) {
    if (schema.if === undefined)
        return expression;
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
function isDefaultCompatible(schema, value) {
    if (schema.const !== undefined)
        return jsonLiteral(schema.const) === jsonLiteral(value);
    if (Array.isArray(schema.enum)) {
        return schema.enum.some((item) => jsonLiteral(item) === jsonLiteral(value));
    }
    const typeInfo = normalizeTypeForSignature(schema);
    const types = typeInfo.types.filter((type) => type !== "null");
    const nullable = Array.isArray(schema.type)
        ? schema.type.includes("null")
        : schema.nullable === true;
    if (value === null)
        return nullable || types.includes("null");
    if (types.length === 0)
        return true;
    if (types.includes("integer"))
        return Number.isInteger(value);
    if (types.includes("number"))
        return typeof value === "number" && Number.isFinite(value);
    if (types.includes("string"))
        return typeof value === "string";
    if (types.includes("boolean"))
        return typeof value === "boolean";
    if (types.includes("array"))
        return Array.isArray(value);
    if (types.includes("object"))
        return !!asRecord(value);
    return true;
}
function literalExpression(value, context, code) {
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
function regexpExpression(pattern, context, path) {
    try {
        new RegExp(pattern);
        return `new RegExp(${JSON.stringify(pattern)})`;
    }
    catch {
        addDiagnostic(context, "invalid.schema", "Regular expression pattern is not valid JavaScript.", path);
        return undefined;
    }
}
function addDiagnostic(context, code, message, path) {
    context.diagnostics.push(diagnostic(code, message, path, context.options));
}
function addInvalidSchema(context, message) {
    context.diagnostics.push({
        level: "error",
        code: "invalid.schema",
        path: context.path,
        message,
    });
}
