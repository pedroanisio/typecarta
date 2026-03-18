// Faithfulness
//
// Verify semantic faithfulness of an encoding (Definition 5.4).
// Combine soundness and completeness checks to confirm exact semantic equivalence.

import type { TypeTerm } from "../ast/type-term.js";
import type { ExtensionEvaluator } from "../semantics/extension.js";
import type { Value } from "../semantics/value-universe.js";
import { type CompletenessResult, checkCompleteness } from "./completeness.js";
import type { Encoding } from "./encoding.js";
import { type SoundnessResult, checkSoundness } from "./soundness.js";

/** Hold the outcome of a semantic faithfulness check, combining soundness and completeness. */
export interface FaithfulnessResult {
	readonly isFaithful: boolean;
	readonly soundness: SoundnessResult;
	readonly completeness: CompletenessResult;
}

/**
 * Check semantic faithfulness of an encoding by verifying both soundness and completeness.
 *
 * @param encoding - The encoding to verify.
 * @param sourceEvaluator - Evaluator for the source schema language.
 * @param targetEvaluator - Evaluator for the target IR.
 * @param testTerms - Type terms to check against.
 * @param testValues - Sample values to probe membership.
 * @returns A {@link FaithfulnessResult} that is faithful only when both soundness and completeness hold.
 */
export function checkFaithfulness(
	encoding: Encoding,
	sourceEvaluator: ExtensionEvaluator,
	targetEvaluator: ExtensionEvaluator,
	testTerms: readonly TypeTerm[],
	testValues: readonly Value[],
): FaithfulnessResult {
	const soundness = checkSoundness(
		encoding,
		sourceEvaluator,
		targetEvaluator,
		testTerms,
		testValues,
	);
	const completeness = checkCompleteness(
		encoding,
		sourceEvaluator,
		targetEvaluator,
		testTerms,
		testValues,
	);

	return {
		isFaithful: soundness.isSound && completeness.isComplete,
		soundness,
		completeness,
	};
}
