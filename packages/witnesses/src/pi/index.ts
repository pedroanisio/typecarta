// pi/index
// Aggregate the 15 diverse witness schemas (S1..S15) and expose them as the DIVERSE_SCHEMAS array.

import type { TypeTerm } from "@typecarta/core";
import type { PiId } from "@typecarta/core";

import { S01_BOTTOM } from "./s01-bottom.js";
import { S02_TOP } from "./s02-top.js";
import { S03_UNIT } from "./s03-unit.js";
import { S04_PRODUCT } from "./s04-product.js";
import { S05_SUM } from "./s05-sum.js";
import { S06_INTERSECTION } from "./s06-intersection.js";
import { S07_DIRECT_REC } from "./s07-direct-rec.js";
import { S08_MUTUAL_REC } from "./s08-mutual-rec.js";
import { S09_PARAMETRIC } from "./s09-parametric.js";
import { S10_REFINEMENT } from "./s10-refinement.js";
import { S11_OPTIONALITY } from "./s11-optionality.js";
import { S12_NOMINAL } from "./s12-nominal.js";
import { S13_OPEN_SHAPE } from "./s13-open-shape.js";
import { S14_DEPENDENT } from "./s14-dependent.js";
import { S15_HKT } from "./s15-hkt.js";

/** A witness schema paired with its primary criterion. */
export interface WitnessSchema {
	readonly id: PiId;
	readonly name: string;
	readonly schema: TypeTerm;
}

/** The diverse schema set ℂ = {S₁, ..., S₁₅}. */
export const DIVERSE_SCHEMAS: readonly WitnessSchema[] = [
	{ id: "pi-01", name: "S₁ — Bottom", schema: S01_BOTTOM },
	{ id: "pi-02", name: "S₂ — Top", schema: S02_TOP },
	{ id: "pi-03", name: "S₃ — Unit", schema: S03_UNIT },
	{ id: "pi-04", name: "S₄ — Product", schema: S04_PRODUCT },
	{ id: "pi-05", name: "S₅ — Sum", schema: S05_SUM },
	{ id: "pi-06", name: "S₆ — Intersection", schema: S06_INTERSECTION },
	{ id: "pi-07", name: "S₇ — Direct Recursion", schema: S07_DIRECT_REC },
	{ id: "pi-08", name: "S₈ — Mutual Recursion", schema: S08_MUTUAL_REC },
	{ id: "pi-09", name: "S₉ — Parametric", schema: S09_PARAMETRIC },
	{ id: "pi-10", name: "S₁₀ — Refinement", schema: S10_REFINEMENT },
	{ id: "pi-11", name: "S₁₁ — Optionality", schema: S11_OPTIONALITY },
	{ id: "pi-12", name: "S₁₂ — Nominal", schema: S12_NOMINAL },
	{ id: "pi-13", name: "S₁₃ — Open Shape", schema: S13_OPEN_SHAPE },
	{ id: "pi-14", name: "S₁₄ — Dependent", schema: S14_DEPENDENT },
	{ id: "pi-15", name: "S₁₅ — HKT", schema: S15_HKT },
] as const;

export {
	S01_BOTTOM,
	S02_TOP,
	S03_UNIT,
	S04_PRODUCT,
	S05_SUM,
	S06_INTERSECTION,
	S07_DIRECT_REC,
	S08_MUTUAL_REC,
	S09_PARAMETRIC,
	S10_REFINEMENT,
	S11_OPTIONALITY,
	S12_NOMINAL,
	S13_OPEN_SHAPE,
	S14_DEPENDENT,
	S15_HKT,
};
