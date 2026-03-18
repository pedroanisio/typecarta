// Completeness
//
// Verify semantic completeness of an encoding (Definition 5.3).
// Detect values accepted by the source language but rejected by the IR encoding.

import type { TypeTerm } from "../ast/type-term.js";
import type { ExtensionEvaluator } from "../semantics/extension.js";
import type { Value } from "../semantics/value-universe.js";
import type { Encoding } from "./encoding.js";

/** Hold the outcome of a semantic completeness check. */
export interface CompletenessResult {
	readonly isComplete: boolean;
	readonly violations: readonly CompletenessViolation[];
}

/** Describe a single completeness violation where a value is accepted by the source but rejected by the encoding. */
export interface CompletenessViolation {
	readonly term: TypeTerm;
	readonly encoded: TypeTerm;
	readonly counterexample: Value;
	readonly reason: string;
}

/**
 * Check semantic completeness of an encoding by sampling test terms and values.
 *
 * @param encoding - The encoding to verify.
 * @param sourceEvaluator - Evaluator for the source schema language.
 * @param targetEvaluator - Evaluator for the target IR.
 * @param testTerms - Type terms to check against.
 * @param testValues - Sample values to probe membership.
 * @returns A {@link CompletenessResult} indicating whether all source values are captured.
 *
 * @remarks
 * For each test term, verify that the source extension is a subset of the IR
 * extension. A violation means the encoding under-approximates the source type.
 */
export function checkCompleteness(
	encoding: Encoding,
	sourceEvaluator: ExtensionEvaluator,
	targetEvaluator: ExtensionEvaluator,
	testTerms: readonly TypeTerm[],
	testValues: readonly Value[],
): CompletenessResult {
	const violations: CompletenessViolation[] = [];

	for (const term of testTerms) {
		const encoded = encoding.encode(term);
		for (const v of testValues) {
			const inSource = sourceEvaluator.inhabits(v, term);
			const inTarget = targetEvaluator.inhabits(v, encoded);
			if (inSource && !inTarget) {
				violations.push({
					term,
					encoded,
					counterexample: v,
					reason: "Value accepted by source but rejected by encoding",
				});
			}
		}
	}

	return { isComplete: violations.length === 0, violations };
}
