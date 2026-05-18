/**
 * Π' expanded criterion set — 70 criteria across 22 families (§12).
 *
 * All families are auto-registered on import.
 */

export {
	CRITERION_IDS,
	type CriterionId,
	type CriterionFamily,
	type CriterionResult,
	type Criterion,
	type CriterionRegistry,
	type MetaTag,
} from "./types.js";

export {
	registerCriterion,
	getCriterionRegistry,
	getCriterion,
	criterionRegistrySize,
} from "./registry.js";

export {
	SELF_CAPABILITIES,
	SELF_CAPABILITY_BY_ID,
	type SelfCapability,
	type SelfCapabilitySupport,
} from "./self-capabilities.js";
export { SELF_WITNESSES, type SelfWitness } from "./self-witnesses.js";

import { FAMILY_A } from "./family-a.js";
import { FAMILY_B } from "./family-b.js";
import { FAMILY_C } from "./family-c.js";
import { FAMILY_D } from "./family-d.js";
import { FAMILY_E } from "./family-e.js";
import { FAMILY_F } from "./family-f.js";
import { FAMILY_G } from "./family-g.js";
import { FAMILY_H } from "./family-h.js";
import { FAMILY_I } from "./family-i.js";
import { FAMILY_J } from "./family-j.js";
import { FAMILY_K } from "./family-k.js";
import { FAMILY_L } from "./family-l.js";
import { FAMILY_M } from "./family-m.js";
import { FAMILY_N } from "./family-n.js";
import { FAMILY_O } from "./family-o.js";
import { FAMILY_P } from "./family-p.js";
import { FAMILY_Q } from "./family-q.js";
import { FAMILY_R } from "./family-r.js";
import { FAMILY_S } from "./family-s.js";
import { FAMILY_T } from "./family-t.js";
import { FAMILY_U } from "./family-u.js";
import { FAMILY_V } from "./family-v.js";
// ─── Import and register all 22 families ───────────────────────────
import { registerCriterion } from "./registry.js";
import type { Criterion, CriterionId } from "./types.js";

/** All 70 criteria in one flat array (ordered by family then ID). */
export const CRITERIA = [
	...FAMILY_A,
	...FAMILY_B,
	...FAMILY_C,
	...FAMILY_D,
	...FAMILY_E,
	...FAMILY_F,
	...FAMILY_G,
	...FAMILY_H,
	...FAMILY_I,
	...FAMILY_J,
	...FAMILY_K,
	...FAMILY_L,
	...FAMILY_M,
	...FAMILY_N,
	...FAMILY_O,
	...FAMILY_P,
	...FAMILY_Q,
	...FAMILY_R,
	...FAMILY_S,
	...FAMILY_T,
	...FAMILY_U,
	...FAMILY_V,
] as const;

/** Identifiers of the 15-criterion canonical core subset in spec §9 c-index order. */
export const CORE_IDS = [
	"pi-prime-01",
	"pi-prime-03",
	"pi-prime-05",
	"pi-prime-09",
	"pi-prime-20",
	"pi-prime-23",
	"pi-prime-25",
	"pi-prime-26",
	"pi-prime-28",
	"pi-prime-38",
	"pi-prime-12",
	"pi-prime-35",
	"pi-prime-17",
	"pi-prime-42",
	"pi-prime-32",
] as const satisfies readonly CriterionId[];

const CRITERIA_BY_ID = new Map(CRITERIA.map((criterion) => [criterion.id, criterion]));

/** The 15-criterion canonical core subset (formerly Π), ordered by spec §9 c-index. */
export const CORE_CRITERIA = CORE_IDS.map((id) => {
	const criterion = CRITERIA_BY_ID.get(id);
	if (criterion === undefined) {
		throw new Error(`Missing core criterion ${id}`);
	}
	if (criterion.core !== true) {
		throw new Error(`Criterion ${id} is listed in CORE_IDS but is not marked core`);
	}
	return criterion;
}) as readonly Criterion[];

// Auto-register all criteria
for (const criterion of CRITERIA) {
	registerCriterion(criterion);
}

export {
	FAMILY_A,
	FAMILY_B,
	FAMILY_C,
	FAMILY_D,
	FAMILY_E,
	FAMILY_F,
	FAMILY_G,
	FAMILY_H,
	FAMILY_I,
	FAMILY_J,
	FAMILY_K,
	FAMILY_L,
	FAMILY_M,
	FAMILY_N,
	FAMILY_O,
	FAMILY_P,
	FAMILY_Q,
	FAMILY_R,
	FAMILY_S,
	FAMILY_T,
	FAMILY_U,
	FAMILY_V,
};
