// Models
//
// Determine whether an IR models a schema language (Definition 5.6).
// Verify that a given encoding is semantically faithful.

import type { TypeTerm } from "../ast/type-term.js";
import type { ExtensionEvaluator } from "../semantics/extension.js";
import type { Value } from "../semantics/value-universe.js";
import type { Encoding } from "./encoding.js";
import { type FaithfulnessResult, checkFaithfulness } from "./faithfulness.js";

/** Hold the outcome of checking whether an IR models a schema language via a given encoding. */
export interface ModelsResult {
	readonly models: boolean;
	readonly faithfulness: FaithfulnessResult;
	readonly encoding: Encoding;
}

/**
 * Check whether an IR models a schema language by verifying faithfulness of the given encoding.
 *
 * @param encoding - The candidate encoding to verify.
 * @param sourceEvaluator - Evaluator for the source schema language.
 * @param targetEvaluator - Evaluator for the target IR.
 * @param testTerms - Type terms to check against.
 * @param testValues - Sample values to probe membership.
 * @returns A {@link ModelsResult} that is true only when the encoding is semantically faithful.
 */
export function checkModels(
	encoding: Encoding,
	sourceEvaluator: ExtensionEvaluator,
	targetEvaluator: ExtensionEvaluator,
	testTerms: readonly TypeTerm[],
	testValues: readonly Value[],
): ModelsResult {
	const faithfulness = checkFaithfulness(
		encoding,
		sourceEvaluator,
		targetEvaluator,
		testTerms,
		testValues,
	);

	return {
		models: faithfulness.isFaithful,
		faithfulness,
		encoding,
	};
}
