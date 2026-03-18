// family-e
// Define Family E witnesses (π'₁₉..π'₂₂) covering sum and union types.
import { base, field, literal, product, union } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₁₉ — Untagged Union: no distinguished discriminant field. */
export const SP19_UNTAGGED_UNION: TypeTerm = union([base("string"), base("number")]);

/** SP₂₀ — Discriminated Union (literal tag): each branch has a literal-typed tag. */
export const SP20_DISCRIMINATED_UNION: TypeTerm = union([
	product([field("kind", literal("circle")), field("radius", base("number"))]),
	product([
		field("kind", literal("rect")),
		field("width", base("number")),
		field("height", base("number")),
	]),
]);

/** SP₂₁ — Shape-Discriminated Union: disjoint key sets, no literal tag. */
export const SP21_SHAPE_DISCRIMINATED: TypeTerm = union([
	product([field("email", base("string")), field("verified", base("boolean"))]),
	product([field("phone", base("string")), field("countryCode", base("string"))]),
]);

/** SP₂₂ — Exhaustive / Closed Union: meta-assertion that case set is complete. */
export const SP22_EXHAUSTIVE_UNION: TypeTerm = union(
	[
		product([field("tag", literal("a")), field("val", base("number"))]),
		product([field("tag", literal("b")), field("val", base("string"))]),
	],
	{ exhaustive: true },
);
