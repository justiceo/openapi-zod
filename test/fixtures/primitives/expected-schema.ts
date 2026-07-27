// AUTO-GENERATED FILE. DO NOT EDIT.

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

export const BinarySchema = z.string();
export type Binary = z.infer<typeof BinarySchema>;

export const ByteSchema = z.base64();
export type Byte = z.infer<typeof ByteSchema>;

export const DoubleSchema = z.float64();
export type Double = z.infer<typeof DoubleSchema>;

export const DurationSchema = z.iso.duration();
export type Duration = z.infer<typeof DurationSchema>;

export const EmailSchema = z.email().max(255);
export type Email = z.infer<typeof EmailSchema>;

export const FloatSchema = z.float32();
export type Float = z.infer<typeof FloatSchema>;

export const HostnameSchema = z.hostname();
export type Hostname = z.infer<typeof HostnameSchema>;

export const IdnEmailSchema = z.stringFormat("idn-email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/u);
export type IdnEmail = z.infer<typeof IdnEmailSchema>;

export const IdnHostnameSchema = z.stringFormat("idn-hostname", /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?(?:\.[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?)*$/u);
export type IdnHostname = z.infer<typeof IdnHostnameSchema>;

export const Int32Schema = z.int32();
export type Int32 = z.infer<typeof Int32Schema>;

export const Int64Schema = z.int();
export type Int64 = z.infer<typeof Int64Schema>;

export const Ipv4Schema = z.ipv4();
export type Ipv4 = z.infer<typeof Ipv4Schema>;

export const Ipv6Schema = z.ipv6();
export type Ipv6 = z.infer<typeof Ipv6Schema>;

export const IriSchema = z.stringFormat("iri", /^[A-Za-z][A-Za-z0-9+.-]*:\S*$/u);
export type Iri = z.infer<typeof IriSchema>;

export const IriReferenceSchema = z.stringFormat("iri-reference", /^\S*$/u);
export type IriReference = z.infer<typeof IriReferenceSchema>;

export const JsonPointerSchema = z.stringFormat("json-pointer", /^(?:\/(?:[^~/]|~0|~1)*)*$/);
export type JsonPointer = z.infer<typeof JsonPointerSchema>;

export const PasswordSchema = z.string();
export type Password = z.infer<typeof PasswordSchema>;

export const RatingSchema = z.number().gt(0).lte(5);
export type Rating = z.infer<typeof RatingSchema>;

export const RegexSchema = z.string().refine((value) => { try { new RegExp(value); return true; } catch { return false; } }, "Invalid regular expression");
export type Regex = z.infer<typeof RegexSchema>;

export const RelativeJsonPointerSchema = z.stringFormat("relative-json-pointer", /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/);
export type RelativeJsonPointer = z.infer<typeof RelativeJsonPointerSchema>;

export const SlugSchema = z.string().min(3).regex(new RegExp("^[a-z0-9-]+$"));
export type Slug = z.infer<typeof SlugSchema>;

export const TimeSchema = z.iso.time();
export type Time = z.infer<typeof TimeSchema>;

export const UnknownFormatSchema = z.string();
export type UnknownFormat = z.infer<typeof UnknownFormatSchema>;

export const UriReferenceSchema = z.stringFormat("uri-reference", /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s]*$|^[^\s:]*$|^\/[^\s]*$|^[^\s]*\?[^\s]*$|^[^\s]*#[^\s]*$/);
export type UriReference = z.infer<typeof UriReferenceSchema>;

export const UriTemplateSchema = z.stringFormat("uri-template", /^(?:[^{}]|\{[^{}]*\})*$/);
export type UriTemplate = z.infer<typeof UriTemplateSchema>;
