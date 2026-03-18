// s09-parametric
// Define the parametric/generic witness S₉ for the diverse schema set.

import { base, field, forall, product, typeVar } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/**
 * S₉ — Parametric / Generic (primary witness: π₉).
 * Λα. {data: α, meta: string}
 */
export const S09_PARAMETRIC: TypeTerm = forall(
	"alpha",
	product([field("data", typeVar("alpha")), field("meta", base("string"))]),
);
