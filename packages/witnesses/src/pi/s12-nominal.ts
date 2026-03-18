// s12-nominal
// Define the nominal-identity witness S₁₂ for the diverse schema set.

import { base, nominal } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/**
 * S₁₂ — Nominal Identity (primary witness: π₁₂).
 * UserId ≠ PostId despite ⟦UserId⟧ = ⟦PostId⟧ = string
 */
export const S12_USER_ID: TypeTerm = nominal("UserId", base("string"));
/** PostId branded type — structurally identical to UserId. */
export const S12_POST_ID: TypeTerm = nominal("PostId", base("string"));
/** S₁₂ primary export — the UserId nominal type. */
export const S12_NOMINAL: TypeTerm = S12_USER_ID;
