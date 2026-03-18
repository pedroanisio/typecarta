// encoding-check/types
// Define shared types for encoding-check properties (Def. 13.1).

import type { TypeTerm } from "../ast/type-term.js";

/** Identify an encoding-check property by name. */
export type EncodingCheckPropertyId = "rho-width" | "rho-depth" | "rho-generic";

/** Represent the result of evaluating an encoding-check property against a witness pair. */
export interface EncodingCheckResult {
	readonly property: EncodingCheckPropertyId;
	readonly holds: boolean;
	readonly witness: readonly [TypeTerm, TypeTerm];
	readonly reason?: string;
}
