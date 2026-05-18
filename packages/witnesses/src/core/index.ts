// core/index
// Derive the 15-criterion canonical core witness set from the full Π' witness list
// by intersecting with the `core: true` flag on CRITERIA. Replaces the
// deleted Π witness directory.

import { CRITERIA, type CriterionId } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";
import { ALL_WITNESSES } from "../pi-prime/index.js";

/** A witness schema paired with its core-subset criterion. */
export interface CoreWitnessSchema {
	readonly id: CriterionId;
	readonly name: string;
	readonly schema: TypeTerm;
}

const CORE_IDS = new Set<string>(
	CRITERIA.filter((c) => c.core === true).map((c) => c.id),
);

/** The 15 witnesses for the canonical core subset (formerly ℂ = {S₁..S₁₅}). */
export const CORE_SCHEMAS: readonly CoreWitnessSchema[] = ALL_WITNESSES.filter((w) =>
	CORE_IDS.has(w.id),
);
