// scorecard/evaluate
// Run criterion predicates against an adapter and produce a scorecard result.

import type { IRAdapter } from "../adapter/interface.js";
import type { TypeTerm } from "../ast/type-term.js";
import { PI_PRIME_CRITERIA } from "../criteria/pi-prime/index.js";
import { PI_CRITERIA } from "../criteria/pi/index.js";
import type { CriterionId, CriterionPredicate } from "../criteria/types.js";
import type { ScorecardCell, ScorecardResult, ScorecardTotals } from "./types.js";

/** Pair a witness schema with its primary criterion. */
export interface WitnessEntry {
	readonly criterionId: CriterionId;
	readonly schema: TypeTerm;
	readonly name: string;
}

/**
 * Evaluate an adapter against a set of witness schemas.
 *
 * For each witness, check whether the schema is encodable, whether the
 * criterion predicate holds on the round-tripped form, and whether the
 * adapter agrees with the source semantics.
 *
 * @param adapter - the IR adapter under test
 * @param witnesses - witness schemas paired with their target criteria
 * @param criteria - criterion predicates to evaluate; defaults to PI_CRITERIA
 * @returns a complete scorecard result with per-criterion cells and totals
 */
export function evaluateScorecard(
	adapter: IRAdapter,
	witnesses: readonly WitnessEntry[],
	criteria?: readonly CriterionPredicate[],
): ScorecardResult {
	const piCriteria = criteria ?? PI_CRITERIA;
	const criteriaMap = new Map(piCriteria.map((c) => [c.id, c]));
	const cells = new Map<CriterionId, ScorecardCell>();

	for (const witness of witnesses) {
		const criterion = criteriaMap.get(witness.criterionId);
		if (!criterion) continue;

		const cell = evaluateCell(adapter, witness, criterion);
		cells.set(witness.criterionId, cell);
	}

	// Fill in criteria not covered by witnesses
	for (const criterion of piCriteria) {
		if (!cells.has(criterion.id)) {
			cells.set(criterion.id, {
				criterionId: criterion.id,
				value: "✗",
				justification: "No witness schema provided",
			});
		}
	}

	return {
		adapterName: adapter.name,
		cells,
		totals: computeTotals(cells),
	};
}

/** Evaluate a single witness against its criterion. */
function evaluateCell(
	adapter: IRAdapter,
	witness: WitnessEntry,
	criterion: CriterionPredicate,
): ScorecardCell {
	// Step 1: Check if the schema is encodable
	if (!adapter.isEncodable(witness.schema)) {
		return {
			criterionId: witness.criterionId,
			value: "✗",
			justification: `Schema ${witness.name} is not encodable in ${adapter.name}`,
		};
	}

	// Step 2: Encode and check if the criterion still holds
	try {
		const encoded = adapter.encode(witness.schema);
		const parsed = adapter.parse(encoded);

		// Check if the criterion is satisfied on the round-tripped form
		const result = criterion.evaluate(parsed);

		switch (result.status) {
			case "satisfied":
				return {
					criterionId: witness.criterionId,
					value: "✓",
					justification: "Faithful encoding exists",
				};
			case "not-satisfied":
				return {
					criterionId: witness.criterionId,
					value: "partial",
					justification: result.reason ?? "Encoding loses criterion-relevant structure",
				};
			case "undecidable":
				return {
					criterionId: witness.criterionId,
					value: "partial",
					justification: result.reason,
				};
		}
	} catch {
		return {
			criterionId: witness.criterionId,
			value: "partial",
			justification: "Encoding exists but round-trip failed",
		};
	}
}

/**
 * Evaluate an adapter against the full 70-criterion Π' set.
 *
 * Convenience wrapper that uses PI_PRIME_CRITERIA as the criterion set.
 * The caller must provide witness schemas covering the desired criteria.
 *
 * @param adapter - the IR adapter under test
 * @param witnesses - witness schemas paired with their target Π' criteria
 * @returns a complete scorecard result with per-criterion cells and totals
 */
export function evaluatePrimeScorecard(
	adapter: IRAdapter,
	witnesses: readonly WitnessEntry[],
): ScorecardResult {
	return evaluateScorecard(adapter, witnesses, PI_PRIME_CRITERIA as readonly CriterionPredicate[]);
}

/** Compute aggregate totals from a cell map. */
function computeTotals(cells: ReadonlyMap<CriterionId, ScorecardCell>): ScorecardTotals {
	let satisfied = 0;
	let partial = 0;
	let notSatisfied = 0;

	for (const cell of cells.values()) {
		switch (cell.value) {
			case "✓":
				satisfied++;
				break;
			case "partial":
				partial++;
				break;
			case "✗":
				notSatisfied++;
				break;
		}
	}

	return { satisfied, partial, notSatisfied };
}
