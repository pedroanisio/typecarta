// encoding-check/evaluate
// Run all rho-property checks against an encoding adapter.

import type { TypeTerm } from "../ast/type-term.js";
import type { Encoding } from "../encoding/encoding.js";
import type { ExtensionEvaluator } from "../semantics/extension.js";
import type { Value } from "../semantics/value-universe.js";
import { checkDepthPreservation } from "./rho-depth.js";
import { checkGenericPreservation } from "./rho-generic.js";
import { checkWidthPreservation } from "./rho-width.js";
import type { EncodingCheckResult } from "./types.js";

/** Pair a subtype/supertype witness with the rho property to evaluate. */
export interface EncodingCheckWitnessPair {
	readonly property: "rho-width" | "rho-depth" | "rho-generic";
	readonly subtype: TypeTerm;
	readonly supertype: TypeTerm;
}

/** Aggregate the results of running an encoding-check suite. */
export interface EncodingCheckSuiteResult {
	readonly results: readonly EncodingCheckResult[];
	readonly allPassed: boolean;
}

/**
 * Run all configured encoding-check evaluations.
 *
 * @param pairs - The witness pairs to evaluate, each tagged with a rho property.
 * @param encoding - The encoding function phi to test.
 * @param targetEvaluator - The extension evaluator for the target IR.
 * @param testValues - The universe of test values for subtype checking.
 * @returns An {@link EncodingCheckSuiteResult} with individual results and an aggregate pass flag.
 */
export function runEncodingChecks(
	pairs: readonly EncodingCheckWitnessPair[],
	encoding: Encoding,
	targetEvaluator: ExtensionEvaluator,
	testValues: readonly Value[],
): EncodingCheckSuiteResult {
	const results: EncodingCheckResult[] = [];

	for (const pair of pairs) {
		let result: EncodingCheckResult;
		switch (pair.property) {
			case "rho-width":
				result = checkWidthPreservation(
					pair.subtype,
					pair.supertype,
					encoding,
					targetEvaluator,
					testValues,
				);
				break;
			case "rho-depth":
				result = checkDepthPreservation(
					pair.subtype,
					pair.supertype,
					encoding,
					targetEvaluator,
					testValues,
				);
				break;
			case "rho-generic":
				result = checkGenericPreservation(
					pair.subtype,
					pair.supertype,
					encoding,
					targetEvaluator,
					testValues,
				);
				break;
		}
		results.push(result);
	}

	return {
		results,
		allPassed: results.every((r) => r.holds),
	};
}
