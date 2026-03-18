// family-l
// Define Family L witnesses (π'₄₅..π'₄₇) covering collection types.
import { array, base, map, set } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₄₅ — Homogeneous Array / List: Array<string>. */
export const SP45_ARRAY: TypeTerm = array(base("string"));

/** SP₄₆ — Set / Unique Collection: Set<number>. */
export const SP46_SET: TypeTerm = set(base("number"));

/** SP₄₇ — Map / Dictionary: Map<string, number>. */
export const SP47_MAP: TypeTerm = map(base("string"), base("number"));
