// s11-optionality
// Define the optionality witness S₁₁ for the diverse schema set.

import { base, field, product } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/**
 * S₁₁ — Optionality (primary witness: π₁₁).
 * {required: string, optional?: string}
 */
export const S11_OPTIONALITY: TypeTerm = product([
	field("required", base("string")),
	field("optional", base("string"), { optional: true }),
]);
