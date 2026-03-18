// scorecard/types
// Define the data shapes for scorecard cells, results, totals, and comparisons.

import type { CriterionId } from "../criteria/types.js";

/** Represent the three possible outcomes for a scorecard cell. */
export type CellValue = "✓" | "partial" | "✗";

/** Hold the evaluation outcome for a single criterion. */
export interface ScorecardCell {
	readonly criterionId: CriterionId;
	readonly value: CellValue;
	readonly justification?: string;
}

/** Contain the full evaluation of an IR adapter against the criterion set. */
export interface ScorecardResult {
	readonly adapterName: string;
	readonly cells: ReadonlyMap<CriterionId, ScorecardCell>;
	readonly totals: ScorecardTotals;
}

/** Aggregate satisfied, partial, and not-satisfied counts for a scorecard. */
export interface ScorecardTotals {
	readonly satisfied: number;
	readonly partial: number;
	readonly notSatisfied: number;
}

/** Pair two scorecard results with their per-criterion differences. */
export interface ScorecardComparison {
	readonly left: ScorecardResult;
	readonly right: ScorecardResult;
	readonly differences: readonly ScorecardDiff[];
}

/** Record a value difference between two scorecards for one criterion. */
export interface ScorecardDiff {
	readonly criterionId: CriterionId;
	readonly leftValue: CellValue;
	readonly rightValue: CellValue;
}
