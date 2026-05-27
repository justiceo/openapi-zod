import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Advanced",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

const __openapiZodStableJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => __openapiZodStableJson(item)).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${__openapiZodStableJson(object[key])}`).join(",")}}`;
};

const __openapiZodOneOf = (value: unknown, ctx: z.core.$RefinementCtx, schemas: z.ZodType[]): void => {
  let matches = 0;
  for (const schema of schemas) {
    if (schema.safeParse(value).success) matches += 1;
  }
  if (matches !== 1) ctx.addIssue({ code: "custom", message: "Expected exactly one schema to match." });
};

const __openapiZodUniqueItems = (items: unknown[], ctx: z.core.$RefinementCtx): void => {
  const seen = new Set<string>();
  for (const item of items) {
    const key = __openapiZodStableJson(item);
    if (seen.has(key)) {
      ctx.addIssue({ code: "custom", message: "Expected array items to be unique." });
      return;
    }
    seen.add(key);
  }
};

const __openapiZodPropertyNames = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, schema: z.ZodType): void => {
  for (const key of Object.keys(value)) {
    if (!schema.safeParse(key).success) ctx.addIssue({ code: "custom", path: [key], message: "Object property name did not match the required schema." });
  }
};

const __openapiZodPatternProperties = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, patterns: Array<[RegExp, z.ZodType]>): void => {
  for (const [key, child] of Object.entries(value)) {
    for (const [pattern, schema] of patterns) {
      if (pattern.test(key) && !schema.safeParse(child).success) ctx.addIssue({ code: "custom", path: [key], message: "Object property did not match its patternProperties schema." });
    }
  }
};

const __openapiZodContains = (items: unknown[], ctx: z.core.$RefinementCtx, schema: z.ZodType, min: number, max: number | undefined): void => {
  let matches = 0;
  for (const item of items) {
    if (schema.safeParse(item).success) matches += 1;
  }
  if (matches < min) ctx.addIssue({ code: "custom", message: `Expected at least ${min} matching array item(s).` });
  if (max !== undefined && matches > max) ctx.addIssue({ code: "custom", message: `Expected at most ${max} matching array item(s).` });
};

const __openapiZodConditional = (value: unknown, ctx: z.core.$RefinementCtx, ifSchema: z.ZodType, thenSchema: z.ZodType | undefined, elseSchema: z.ZodType | undefined): void => {
  const matched = ifSchema.safeParse(value).success;
  if (matched && thenSchema && !thenSchema.safeParse(value).success) ctx.addIssue({ code: "custom", message: "Value did not match the conditional then schema." });
  if (!matched && elseSchema && !elseSchema.safeParse(value).success) ctx.addIssue({ code: "custom", message: "Value did not match the conditional else schema." });
};

const __openapiZodDependentRequired = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, dependencies: Record<string, string[]>): void => {
  for (const [key, required] of Object.entries(dependencies)) {
    if (!(key in value)) continue;
    for (const requiredKey of required) {
      if (!(requiredKey in value)) ctx.addIssue({ code: "custom", path: [requiredKey], message: `Property ${requiredKey} is required when ${key} is present.` });
    }
  }
};

const __openapiZodDependentSchemas = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, schemas: Array<[string, z.ZodType]>): void => {
  for (const [key, schema] of schemas) {
    if (key in value && !schema.safeParse(value).success) ctx.addIssue({ code: "custom", path: [key], message: `Object did not match dependent schema for ${key}.` });
  }
};

export const ConditionalValueSchema = z.unknown().superRefine((value, ctx) => __openapiZodConditional(value, ctx, z.object({
  mode: z.literal("strict"),
}), z.object({
  strictValue: z.string(),
}), z.object({
  relaxedValue: z.string(),
}))).pipe(z.object({
  mode: z.string().optional(),
}));
export type ConditionalValue = z.infer<typeof ConditionalValueSchema>;

export const ContactChoiceSchema = z.unknown().superRefine((value, ctx) => __openapiZodOneOf(value, ctx, [z.object({
  email: z.email(),
}), z.object({
  phone: z.string(),
})])).pipe(z.union([z.object({
  email: z.email(),
}), z.object({
  phone: z.string(),
})]));
export type ContactChoice = z.infer<typeof ContactChoiceSchema>;

export const ContainsNumberSchema = z.array(z.number()).superRefine((items, ctx) => __openapiZodContains(items, ctx, z.int(), 2, 3));
export type ContainsNumber = z.infer<typeof ContainsNumberSchema>;

export const DependentSchemaSchema = z.object({
  kind: z.string().optional(),
}).superRefine((value, ctx) => __openapiZodDependentSchemas(value, ctx, [["kind", z.object({
  value: z.string(),
})]]));
export type Dependent = z.infer<typeof DependentSchemaSchema>;

export const FlexibleTupleSchema = z.tuple([z.string(), z.int()], z.boolean());
export type FlexibleTuple = z.infer<typeof FlexibleTupleSchema>;

export const PatternedMapSchema = z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length >= 1, { message: "Expected at least 1 properties." }).refine((value) => Object.keys(value).length <= 3, { message: "Expected at most 3 properties." }).superRefine((value, ctx) => __openapiZodPropertyNames(value, ctx, z.string().regex(new RegExp("^[a-z-]+$")))).superRefine((value, ctx) => __openapiZodPatternProperties(value, ctx, [[new RegExp("^x-"), z.int()]])).superRefine((value, ctx) => __openapiZodDependentRequired(value, ctx, {
  "credit-card": ["billing-address"],
}));
export type PatternedMap = z.infer<typeof PatternedMapSchema>;

export const UniqueDeepSchema = z.array(z.object({
  id: z.string().optional(),
})).superRefine((items, ctx) => __openapiZodUniqueItems(items, ctx));
export type UniqueDeep = z.infer<typeof UniqueDeepSchema>;

export const routes = [] as const;
