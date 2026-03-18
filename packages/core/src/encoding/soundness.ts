// Soundness
//
// Verify semantic soundness of an encoding (Definition 5.2).
// Detect values accepted by the IR encoding but rejected by the source language.

import type { TypeTerm } from "../ast/type-term.js";
import type { ExtensionEvaluator } from "../semantics/extension.js";
import type { Value } from "../semantics/value-universe.js";
import type { Encoding } from "./encoding.js";

/** Hold the outcome of a semantic soundness check. */
export interface SoundnessResult {
	readonly isSound: boolean;
	readonly violations: readonly SoundnessViolation[];
}

/** Describe a single soundness violation where a value is accepted by the encoding but rejected by the source. */
export interface SoundnessViolation {
	readonly term: TypeTerm;
	readonly encoded: TypeTerm;
	readonly counterexample: Value;
	readonly reason: string;
}

/**
 * Check semantic soundness of an encoding by sampling test terms and values.
 *
 * @param encoding - The encoding to verify.
 * @param sourceEvaluator - Evaluator for the source schema language.
 * @param targetEvaluator - Evaluator for the target IR.
 * @param testTerms - Type terms to check against.
 * @param testValues - Sample values to probe membership.
 * @returns A {@link SoundnessResult} indicating whether all encoded terms are sound.
 *
 * @remarks
 * For each test term, verify that the IR extension is a subset of the source
 * extension. A violation means the encoding over-approximates the source type.
 */
export function checkSoundness(
	encoding: Encoding,
	sourceEvaluator: ExtensionEvaluator,
	targetEvaluator: ExtensionEvaluator,
	testTerms: readonly TypeTerm[],
	testValues: readonly Value[],
): SoundnessResult {
	const violations: SoundnessViolation[] = [];

	for (const term of testTerms) {
		const encoded = encoding.encode(term);
		for (const v of testValues) {
			const inTarget = targetEvaluator.inhabits(v, encoded);
			const inSource = sourceEvaluator.inhabits(v, term);
			if (inTarget && !inSource) {
				violations.push({
					term,
					encoded,
					counterexample: v,
					reason: "Value accepted by encoding but rejected by source",
				});
			}
		}
	}

	return { isSound: violations.length === 0, violations };
}
