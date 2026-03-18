// s03-unit
// Define the unit/literal witness S₃ for the diverse schema set.

import { literal } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** S₃ — Unit / Literal (primary witness: π₃). ⟦S₃⟧ = {42} */
export const S03_UNIT: TypeTerm = literal(42);
