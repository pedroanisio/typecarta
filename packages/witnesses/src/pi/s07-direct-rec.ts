// s07-direct-rec
// Define the direct-recursion witness S₇ for the diverse schema set.

import { array, base, field, mu, product, typeVar } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/**
 * S₇ — Direct Recursion (primary witness: π₇).
 * μα. {value: string, children: α[]}
 */
export const S07_DIRECT_REC: TypeTerm = mu(
	"alpha",
	product([field("value", base("string")), field("children", array(typeVar("alpha")))]),
);
