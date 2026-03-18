// family-b
// Define Family B witnesses (π'₈..π'₁₀) covering products, records, and tuples.
import { array, base, field, product, tuple } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₈ — Positional Tuple: ordered, index-addressed product. */
export const SP08_POSITIONAL_TUPLE: TypeTerm = tuple([
	base("string"),
	base("number"),
	base("boolean"),
]);

/** SP₉ — Labelled Record: product with named fields. */
export const SP09_LABELLED_RECORD: TypeTerm = product([
	field("id", base("number")),
	field("name", base("string")),
	field("email", base("string")),
]);

/** SP₁₀ — Variadic / Rest Element: tuple with fixed prefix and array tail. */
export const SP10_VARIADIC_TUPLE: TypeTerm = tuple([
	base("string"),
	base("number"),
	array(base("boolean")),
]);
