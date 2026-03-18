// s13-open-shape
// Define the open-shape witness S₁₃ for the diverse schema set.

import { base, field, product } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/**
 * S₁₃ — Open Shape (primary witness: π₁₃).
 * {id: number, ...} — extensible record.
 */
export const S13_OPEN_SHAPE: TypeTerm = product([field("id", base("number"))], { open: true });
