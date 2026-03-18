// s05-sum
// Define the discriminated-sum witness S₅ for the diverse schema set.

import { base, field, literal, product, union } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** S₅ — Discriminated Sum (primary witness: π₅). */
export const S05_SUM: TypeTerm = union([
	product([field("tag", literal("ok")), field("value", base("string"))]),
	product([field("tag", literal("err")), field("error", base("string"))]),
]);
