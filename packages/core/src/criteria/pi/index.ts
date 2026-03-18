/**
 * Registry: π₁ .. π₁₅
 *
 * The base criterion set Π (Table 8.5).
 */

import type { CriterionId, CriterionPredicate, CriterionRegistry } from "../types.js";
import { pi01Bottom } from "./pi-01-bottom.js";
import { pi02Top } from "./pi-02-top.js";
import { pi03Unit } from "./pi-03-unit.js";
import { pi04Product } from "./pi-04-product.js";
import { pi05Sum } from "./pi-05-sum.js";
import { pi06Intersection } from "./pi-06-intersection.js";
import { pi07Recursion } from "./pi-07-recursion.js";
import { pi08MutualRec } from "./pi-08-mutual-rec.js";
import { pi09Parametric } from "./pi-09-parametric.js";
import { pi10Refinement } from "./pi-10-refinement.js";
import { pi11Optionality } from "./pi-11-optionality.js";
import { pi12Nominal } from "./pi-12-nominal.js";
import { pi13OpenShape } from "./pi-13-open-shape.js";
import { pi14Dependent } from "./pi-14-dependent.js";
import { pi15Hkt } from "./pi-15-hkt.js";

/** All 15 base criteria in order. */
export const PI_CRITERIA: readonly CriterionPredicate[] = [
	pi01Bottom,
	pi02Top,
	pi03Unit,
	pi04Product,
	pi05Sum,
	pi06Intersection,
	pi07Recursion,
	pi08MutualRec,
	pi09Parametric,
	pi10Refinement,
	pi11Optionality,
	pi12Nominal,
	pi13OpenShape,
	pi14Dependent,
	pi15Hkt,
] as const;

/** Registry map: CriterionId → CriterionPredicate. */
export const PI_REGISTRY: CriterionRegistry = new Map<CriterionId, CriterionPredicate>(
	PI_CRITERIA.map((c) => [c.id, c]),
);

export {
	pi01Bottom,
	pi02Top,
	pi03Unit,
	pi04Product,
	pi05Sum,
	pi06Intersection,
	pi07Recursion,
	pi08MutualRec,
	pi09Parametric,
	pi10Refinement,
	pi11Optionality,
	pi12Nominal,
	pi13OpenShape,
	pi14Dependent,
	pi15Hkt,
};
