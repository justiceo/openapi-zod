import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Primitives",
    version: "1.0.0",
  },
  openapi: "3.0.3",
} as const;

export const ActiveSchema = z.boolean();
export type Active = z.infer<typeof ActiveSchema>;

export const AgeSchema = z.int().gte(0);
export type Age = z.infer<typeof AgeSchema>;

export const AnythingSchema = z.null();
export type Anything = z.infer<typeof AnythingSchema>;

export const EmailSchema = z.email().max(255);
export type Email = z.infer<typeof EmailSchema>;

export const RatingSchema = z.number().gt(0).lte(5);
export type Rating = z.infer<typeof RatingSchema>;

export const SlugSchema = z.string().min(3).regex(new RegExp("^[a-z0-9-]+$"));
export type Slug = z.infer<typeof SlugSchema>;

export const UnknownFormatSchema = z.string();
export type UnknownFormat = z.infer<typeof UnknownFormatSchema>;

export const routes = [] as const;
