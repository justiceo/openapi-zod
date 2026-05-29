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
export function helperCode(helpers) {
    const lines = [];
    const needsStableJson = helpers.has("uniqueItems") || helpers.has("literal");
    if (needsStableJson) {
        lines.push("", "const __openapiZodStableJson = (value: unknown): string => {", "  if (value === null || typeof value !== \"object\") return JSON.stringify(value);", "  if (Array.isArray(value)) return `[${value.map((item) => __openapiZodStableJson(item)).join(\",\")}]`;", "  const object = value as Record<string, unknown>;", "  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${__openapiZodStableJson(object[key])}`).join(\",\")}}`;", "};");
    }
    if (helpers.has("oneOf")) {
        lines.push("", "const __openapiZodOneOf = (value: unknown, ctx: z.core.$RefinementCtx, schemas: z.ZodType[]): void => {", "  let matches = 0;", "  for (const schema of schemas) {", "    if (schema.safeParse(value).success) matches += 1;", "  }", "  if (matches !== 1) ctx.addIssue({ code: \"custom\", message: \"Expected exactly one schema to match.\" });", "};");
    }
    if (helpers.has("uniqueItems")) {
        lines.push("", "const __openapiZodUniqueItems = (items: unknown[], ctx: z.core.$RefinementCtx): void => {", "  const seen = new Set<string>();", "  for (const item of items) {", "    const key = __openapiZodStableJson(item);", "    if (seen.has(key)) {", "      ctx.addIssue({ code: \"custom\", message: \"Expected array items to be unique.\" });", "      return;", "    }", "    seen.add(key);", "  }", "};");
    }
    if (helpers.has("propertyNames")) {
        lines.push("", "const __openapiZodPropertyNames = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, schema: z.ZodType): void => {", "  for (const key of Object.keys(value)) {", "    if (!schema.safeParse(key).success) ctx.addIssue({ code: \"custom\", path: [key], message: \"Object property name did not match the required schema.\" });", "  }", "};");
    }
    if (helpers.has("patternProperties")) {
        lines.push("", "const __openapiZodPatternProperties = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, patterns: Array<[RegExp, z.ZodType]>): void => {", "  for (const [key, child] of Object.entries(value)) {", "    for (const [pattern, schema] of patterns) {", "      if (pattern.test(key) && !schema.safeParse(child).success) ctx.addIssue({ code: \"custom\", path: [key], message: \"Object property did not match its patternProperties schema.\" });", "    }", "  }", "};");
    }
    if (helpers.has("contains")) {
        lines.push("", "const __openapiZodContains = (items: unknown[], ctx: z.core.$RefinementCtx, schema: z.ZodType, min: number, max: number | undefined): void => {", "  let matches = 0;", "  for (const item of items) {", "    if (schema.safeParse(item).success) matches += 1;", "  }", "  if (matches < min) ctx.addIssue({ code: \"custom\", message: `Expected at least ${min} matching array item(s).` });", "  if (max !== undefined && matches > max) ctx.addIssue({ code: \"custom\", message: `Expected at most ${max} matching array item(s).` });", "};");
    }
    if (helpers.has("conditional")) {
        lines.push("", "const __openapiZodConditional = (value: unknown, ctx: z.core.$RefinementCtx, ifSchema: z.ZodType, thenSchema: z.ZodType | undefined, elseSchema: z.ZodType | undefined): void => {", "  const matched = ifSchema.safeParse(value).success;", "  if (matched && thenSchema && !thenSchema.safeParse(value).success) ctx.addIssue({ code: \"custom\", message: \"Value did not match the conditional then schema.\" });", "  if (!matched && elseSchema && !elseSchema.safeParse(value).success) ctx.addIssue({ code: \"custom\", message: \"Value did not match the conditional else schema.\" });", "};");
    }
    if (helpers.has("dependentRequired")) {
        lines.push("", "const __openapiZodDependentRequired = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, dependencies: Record<string, string[]>): void => {", "  for (const [key, required] of Object.entries(dependencies)) {", "    if (!(key in value)) continue;", "    for (const requiredKey of required) {", "      if (!(requiredKey in value)) ctx.addIssue({ code: \"custom\", path: [requiredKey], message: `Property ${requiredKey} is required when ${key} is present.` });", "    }", "  }", "};");
    }
    if (helpers.has("dependentSchemas")) {
        lines.push("", "const __openapiZodDependentSchemas = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, schemas: Array<[string, z.ZodType]>): void => {", "  for (const [key, schema] of schemas) {", "    if (key in value && !schema.safeParse(value).success) ctx.addIssue({ code: \"custom\", path: [key], message: `Object did not match dependent schema for ${key}.` });", "  }", "};");
    }
    return lines;
}
export function zodObjectExpression(properties) {
    const keys = Object.keys(properties).sort();
    if (keys.length === 0)
        return "z.object({})";
    return `z.object({\n${keys.map((key) => `  ${propertyKey(key)}: ${indentMultiline(properties[key], 2)},`).join("\n")}\n})`;
}
export function objectExpression(properties, indent) {
    const keys = Object.keys(properties);
    if (keys.length === 0)
        return "{}";
    const pad = " ".repeat(indent);
    const childPad = " ".repeat(indent + 2);
    return `{\n${keys.map((key) => `${childPad}${propertyKey(key)}: ${indentMultiline(properties[key], indent + 2)},`).join("\n")}\n${pad}}`;
}
export function literalObjectExpression(value, indent) {
    if (value === undefined)
        return "undefined";
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value))
        return arrayExpression(value.map((item) => literalObjectExpression(item, 0)), indent);
    const object = asRecord(value);
    if (!object)
        return "undefined";
    const entries = {};
    for (const key of Object.keys(object).sort()) {
        if (key.startsWith("x-"))
            continue;
        entries[key] = literalObjectExpression(object[key], 0);
    }
    return objectExpression(entries, indent);
}
export function arrayLiteral(values) {
    return `[${values.join(", ")}]`;
}
export function arrayExpression(values, indent) {
    if (values.length === 0)
        return "[]";
    if (values.every((value) => !value.includes("\n")))
        return arrayLiteral(values);
    const pad = " ".repeat(indent);
    const childPad = " ".repeat(indent + 2);
    return `[\n${values.map((value) => `${childPad}${indentMultiline(value, indent + 2)},`).join("\n")}\n${pad}]`;
}
export function indentMultiline(value, indent) {
    const padding = " ".repeat(indent);
    return value.split("\n").map((line, index) => index === 0 ? line : `${padding}${line}`).join("\n");
}
export function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1).replace(/[^A-Za-z0-9_$]/g, "");
}
export function buildNames(componentNames, options, diagnostics) {
    const schemaNames = new Map();
    const typeNames = new Map();
    const operationNames = new Map();
    const order = new Map();
    const usedSchemaNames = new Map();
    const usedTypeNames = new Map();
    for (const [index, componentName] of componentNames.entries()) {
        order.set(componentName, index);
        const schemaBase = sanitizeIdentifier(`${options.schemaNamePrefix}${componentName}${options.schemaNameSuffix}`);
        schemaNames.set(componentName, uniqueName(schemaBase, usedSchemaNames, componentName, diagnostics));
        const typeBase = sanitizeIdentifier(options.schemaNameSuffix && componentName.endsWith(options.schemaNameSuffix)
            ? componentName.slice(0, -options.schemaNameSuffix.length)
            : componentName);
        typeNames.set(componentName, uniqueName(typeBase, usedTypeNames, componentName, diagnostics));
    }
    return { schemaNames, typeNames, operationNames, order };
}
export function uniqueName(base, used, componentName, diagnostics) {
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    if (count === 0)
        return base;
    diagnostics.push({
        level: "warning",
        code: "name.collision",
        path: `#/components/schemas/${escapePointer(componentName)}`,
        message: `Generated name "${base}" collided; using "${base}_${count + 1}".`,
    });
    return `${base}_${count + 1}`;
}
export function sanitizeIdentifier(value) {
    let result = value.replace(/[^A-Za-z0-9_$]/g, "");
    if (!/^[A-Za-z_$]/.test(result))
        result = `Schema${result}`;
    if (reservedWords.has(result))
        result = `Schema${result}`;
    return result || "Schema";
}
export function jsonLiteral(value) {
    if (value === null)
        return "null";
    if (typeof value === "string" || typeof value === "boolean")
        return JSON.stringify(value);
    if (typeof value === "number")
        return Number.isFinite(value) ? String(value) : undefined;
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
export function stableJson(value) {
    if (value === null || typeof value === "string" || typeof value === "boolean")
        return JSON.stringify(value);
    if (typeof value === "number")
        return Number.isFinite(value) ? String(value) : undefined;
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
export function propertyKey(value) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) && !reservedWords.has(value)
        ? value
        : JSON.stringify(value);
}
export function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
export function isSchemaObject(value) {
    return !!asRecord(value);
}
export function asRecord(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return undefined;
    return value;
}
export function escapePointer(value) {
    return value.replace(/~/g, "~0").replace(/\//g, "~1");
}
export function unescapePointer(value) {
    return value.replace(/~1/g, "/").replace(/~0/g, "~");
}
