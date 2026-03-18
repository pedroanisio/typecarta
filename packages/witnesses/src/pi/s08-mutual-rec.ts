// s08-mutual-rec
// Define the mutual-recursion witness S₈ for the diverse schema set.

import { array, base, field, mu, product, typeVar } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/**
 * S₈ — Mutual Recursion (primary witness: π₈).
 * A = {value: string, next: B}
 * B = {items: A[]}
 * Encoded as nested μ.
 */
export const S08_A: TypeTerm = mu(
	"alpha",
	product([
		field("value", base("string")),
		field("next", mu("beta", product([field("items", array(typeVar("alpha")))]))),
	]),
);

/** S₈ primary export — the A side of the mutual recursion. */
export const S08_MUTUAL_REC: TypeTerm = S08_A;
