// strong
// Assess strong universality of an IR over a schema class (Def. 6.3).

import type { FaithfulnessResult } from "../encoding/faithfulness.js";

/** Represent the result of a strong universality assessment (Def. 6.3). */
export interface StrongUniversalityResult {
	readonly holds: boolean;
	readonly encodings: ReadonlyMap<string, FaithfulnessResult>;
}
