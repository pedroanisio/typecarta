// family-q
// Define Family Q witness (π'₅₉) covering type-level negation.
import { base, complement } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₅₉ — Type-Level Complement: ¬string — everything that is not a string. */
export const SP59_COMPLEMENT: TypeTerm = complement(base("string"));
