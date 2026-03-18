// s04-product
// Define the finite-product witness S₄ for the diverse schema set.

import { base, field, product } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** S₄ — Finite Product (primary witness: π₄). */
export const S04_PRODUCT: TypeTerm = product([
	field("id", base("number")),
	field("name", base("string")),
	field("active", base("boolean")),
]);
