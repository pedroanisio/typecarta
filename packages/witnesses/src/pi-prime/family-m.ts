// family-m
// Define Family M witnesses (π'₄₈..π'₄₉) covering computation types.
import { arrow, base, intersection } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₄₈ — Function / Arrow Type: (string) => number. */
export const SP48_ARROW: TypeTerm = arrow([base("string")], base("number"));

/** SP₄₉ — Overloaded Function: intersection of arrow types. */
export const SP49_OVERLOADED: TypeTerm = intersection([
	arrow([base("string")], base("number")),
	arrow([base("number")], base("string")),
]);
