// family-d
// Define Family D witnesses (π'₁₆..π'₁₈) covering shape closure.
import { base, field, product } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₁₆ — Closed Record: dom(v) = {l₁,…,lₙ}, no extra keys. */
export const SP16_CLOSED_RECORD: TypeTerm = product([
	field("x", base("number")),
	field("y", base("number")),
]);

/** SP₁₇ — Open Record (unconstrained extras): {id: number, ...}. */
export const SP17_OPEN_RECORD: TypeTerm = product([field("id", base("number"))], { open: true });

/** SP₁₈ — Open Record (typed extras): extra keys constrained to a type. */
export const SP18_TYPED_EXTRAS: TypeTerm = product([field("id", base("number"))], {
	additionalProperties: "string",
});
