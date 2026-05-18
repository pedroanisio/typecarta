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

/** The 15-criterion canonical core subset (formerly Π). */
export const CORE_CRITERIA = CRITERIA.filter((c) => c.core === true);

/** Identifiers of the 15-criterion canonical core subset. */
export const CORE_IDS = CORE_CRITERIA.map((c) => c.id);

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
