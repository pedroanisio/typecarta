// s01-bottom
// Define the bottom-type witness S₁ for the diverse schema set.

import { bottom } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** S₁ — Bottom (primary witness: π₁). ⟦S₁⟧ = ∅ */
export const S01_BOTTOM: TypeTerm = bottom();
