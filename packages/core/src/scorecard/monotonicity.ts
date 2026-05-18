// scorecard/monotonicity
// Check that a "superset" scorecard never regresses against a "subset" one.
//
// Some adapter pairs declare a strict containment relation. For example,
// XSD 1.1 is a strict superset of XSD 1.0 — every 1.0 schema is a legal
// 1.1 schema, and 1.1 adds xs:assert / xs:alternative / xs:override.
// JSON Schema 2020-12 is a strict superset of draft-07. In those cases the
// superset adapter's verdict for every row should be at least as strong as
// the subset adapter's. A regression indicates a bug in the superset
// adapter, the witness fixtures, or the criterion evaluator — not a
// finding about the target language.
//
// Two independent monotonicity dimensions are checked:
//
//   1. Vocabulary monotonicity: if the subset adapter modeled an IR kind
//      (cell ≠ "n/a"), the superset adapter must model it too. The
//      superset cannot lose vocabulary the subset had.
//
//   2. Encoding-strength monotonicity: when both adapters model the kind,
//      the superset's verdict must rank at least as high as the subset's
//      under the order ✗ < ◐ < ✓.
//
// The "n/a → anything else" transition is always permitted (vocabulary
// gained). The "✗/◐/✓ → n/a" transition is always a violation.

import type { CriterionId } from "../criteria/pi-prime/types.js";
import type { CellValue, ScorecardCell, ScorecardResult } from "./types.js";

/**
 * Encoding-strength rank used for monotonicity ordering. `n/a` is left
 * out — it is handled by the vocabulary check, not the strength check.
 */
const ENCODING_STRENGTH_RANK: Readonly<Record<Exclude<CellValue, "n/a">, number>> = {
	"✗": 0,
	partial: 1,
	"✓": 2,
};

/** One monotonicity violation found on a specific row. */
export interface MonotonicityViolation {
	readonly criterionId: string;
	readonly subsetValue: CellValue;
	readonly supersetValue: CellValue;
	readonly kind: "vocabulary-lost" | "encoding-regressed";
	readonly subsetJustification?: string;
	readonly supersetJustification?: string;
}

/** Result of running the monotonicity check on a scorecard pair. */
export interface MonotonicityResult {
	readonly subsetName: string;
	readonly supersetName: string;
	readonly violations: readonly MonotonicityViolation[];
}

/**
 * Check that `superset`'s scorecard is monotonically at-least-as-strong
 * as `subset`'s for every row both score.
 *
 * Returns an empty `violations` array iff every row obeys the contract.
 *
 * @param subset - the scorecard for the subset adapter
 * @param superset - the scorecard for the superset adapter (must encode
 *   strictly more than the subset)
 * @returns the per-row violations, if any
 */
export function checkMonotonicity(
	subset: ScorecardResult,
	superset: ScorecardResult,
): MonotonicityResult {
	const violations: MonotonicityViolation[] = [];
	const allIds = new Set<CriterionId>([
		...subset.cells.keys(),
		...superset.cells.keys(),
	]);

	for (const id of allIds) {
		const subCell = subset.cells.get(id);
		const supCell = superset.cells.get(id);
		if (subCell === undefined || supCell === undefined) continue;

		const violation = compareCells(id, subCell, supCell);
		if (violation !== undefined) violations.push(violation);
	}

	return {
		subsetName: subset.adapterName,
		supersetName: superset.adapterName,
		violations,
	};
}

function compareCells(
	criterionId: string,
	subset: ScorecardCell,
	superset: ScorecardCell,
): MonotonicityViolation | undefined {
	// (1) Vocabulary monotonicity.
	if (subset.value !== "n/a" && superset.value === "n/a") {
		return makeViolation(criterionId, subset, superset, "vocabulary-lost");
	}
	// `n/a → ✗/◐/✓` is a vocabulary gain and always legal. `n/a → n/a` is
	// no change. In either case fall through to the strength check, which
	// silently skips when either side is n/a.
	if (subset.value === "n/a" || superset.value === "n/a") return undefined;

	// (2) Encoding-strength monotonicity.
	const subRank = ENCODING_STRENGTH_RANK[subset.value];
	const supRank = ENCODING_STRENGTH_RANK[superset.value];
	if (supRank < subRank) {
		return makeViolation(criterionId, subset, superset, "encoding-regressed");
	}
	return undefined;
}

function makeViolation(
	criterionId: string,
	subset: ScorecardCell,
	superset: ScorecardCell,
	kind: MonotonicityViolation["kind"],
): MonotonicityViolation {
	return {
		criterionId,
		subsetValue: subset.value,
		supersetValue: superset.value,
		kind,
		...(subset.justification !== undefined
			? { subsetJustification: subset.justification }
			: {}),
		...(superset.justification !== undefined
			? { supersetJustification: superset.justification }
			: {}),
	};
}

/** Format a {@link MonotonicityResult} as a one-message-per-line string. */
export function formatMonotonicityViolations(result: MonotonicityResult): string {
	if (result.violations.length === 0) {
		return `${result.subsetName} ⊆ ${result.supersetName}: no monotonicity violations.`;
	}
	const header = `${result.subsetName} ⊆ ${result.supersetName}: ${result.violations.length} violation(s).`;
	const lines = result.violations.map((v) => {
		const arrow = `${v.subsetValue} → ${v.supersetValue}`;
		return `  ${v.criterionId}  ${arrow}  (${v.kind})`;
	});
	return [header, ...lines].join("\n");
}
