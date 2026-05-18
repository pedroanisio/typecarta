// scorecard/types
// Define the data shapes for scorecard cells, results, totals, and comparisons.

import type { CriterionId } from "../criteria/pi-prime/types.js";

/**
 * Represent the four possible outcomes for a scorecard cell.
 *
 * `n/a` is emitted when the adapter declares (via `supportsKind`) that it
 * does not model the IR constructor used by the witness. It separates
 * adapter holes from genuine target-language gaps; before its introduction
 * both produced `✗`. See docs/guides/scorecard-spec-assessment.md.
 */
export type CellValue = "✓" | "partial" | "✗" | "n/a";

/** Hold the evaluation outcome for a single criterion. */
export interface ScorecardCell {
	readonly criterionId: CriterionId;
	readonly value: CellValue;
	readonly justification?: string;
}

/**
 * Identify the typecarta build that produced a scorecard.
 *
 * Pinned in every rendered report so a stored result can be traced back to a
 * specific commit and adapter version. `generatedAt` is an ISO-8601 timestamp.
 */
export interface ScorecardProvenance {
	readonly typecartaVersion: string;
	readonly commitHash: string;
	readonly generatedAt: string;
}

/** Contain the full evaluation of an IR adapter against the criterion set. */
export interface ScorecardResult {
	readonly adapterName: string;
	readonly cells: ReadonlyMap<CriterionId, ScorecardCell>;
	readonly totals: ScorecardTotals;
	readonly provenance?: ScorecardProvenance;
}

/** Aggregate per-cell counts for a scorecard. */
export interface ScorecardTotals {
	readonly satisfied: number;
	readonly partial: number;
	readonly notSatisfied: number;
	readonly outOfVocabulary: number;
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
