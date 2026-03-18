// family-c
// Define Family C witnesses (π'₁₁..π'₁₅) covering field modality.
import { base, field, product, union } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₁₁ — Required Field: all fields mandatory. */
export const SP11_REQUIRED_FIELD: TypeTerm = product([
	field("name", base("string")),
	field("age", base("number")),
]);

/** SP₁₂ — Optional-by-Absence: key may be absent. */
export const SP12_OPTIONAL_FIELD: TypeTerm = product([
	field("name", base("string")),
	field("nickname", base("string"), { optional: true }),
]);

/** SP₁₃ — Nullable-by-Value: key always present, null carried in-band. */
export const SP13_NULLABLE_FIELD: TypeTerm = product([
	field("name", base("string")),
	field("middleName", union([base("string"), base("null")])),
]);

/** SP₁₄ — Default Value: field with a default coercion value. */
export const SP14_DEFAULT_VALUE: TypeTerm = product([
	field("role", base("string"), { defaultValue: "user" }),
]);

/** SP₁₅ — Read-Only Marker: field annotated as immutable. */
export const SP15_READONLY_FIELD: TypeTerm = product([
	field("id", base("string"), { readonly: true }),
	field("name", base("string")),
]);
