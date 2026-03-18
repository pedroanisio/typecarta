// s15-hkt
// Define the higher-kinded type witness S₁₅ for the diverse schema set.

import { base, forall, typeVar } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";
import { apply } from "@typecarta/core";

/**
 * S₁₅ — Higher-Kinded (primary witness: π₁₅).
 * Λ(F: * → *). F(string)
 */
export const S15_HKT: TypeTerm = forall("F", apply("apply", [typeVar("F"), base("string")]), {
	annotations: { hkt: true },
});
