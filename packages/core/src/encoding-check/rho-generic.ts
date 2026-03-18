// encoding-check/rho-generic
// Check the rho_G property: subtyping under generics preservation (Def. 13.2).

import type { TypeTerm } from "../ast/type-term.js";
import type { Encoding } from "../encoding/encoding.js";
import type { ExtensionEvaluator } from "../semantics/extension.js";
import { isSubtype } from "../semantics/subtyping.js";
import type { Value } from "../semantics/value-universe.js";
import type { EncodingCheckResult } from "./types.js";

/**
 * Check that subtyping under generic instantiations is preserved by the encoding.
 *
 * @param instantiation1 - The first generic instantiation type term.
 * @param instantiation2 - The second generic instantiation type term.
 * @param encoding - The encoding function phi to test.
 * @param targetEvaluator - The extension evaluator for the target IR.
 * @param testValues - The universe of test values for subtype checking.
 * @returns An {@link EncodingCheckResult} for the rho-generic property.
 */
export function checkGenericPreservation(
	instantiation1: TypeTerm,
	instantiation2: TypeTerm,
	encoding: Encoding,
	targetEvaluator: ExtensionEvaluator,
	testValues: readonly Value[],
): EncodingCheckResult {
	const encoded1 = encoding.encode(instantiation1);
	const encoded2 = encoding.encode(instantiation2);

	const ext1 = targetEvaluator.evaluate(encoded1);
	const ext2 = targetEvaluator.evaluate(encoded2);
	const result = isSubtype(ext1, ext2, testValues);

	return {
		property: "rho-generic",
		holds: result.holds,
		witness: [instantiation1, instantiation2],
		reason: result.holds ? "Generic subtyping preserved" : "φ(F(τ₁)) ≤ φ(F(τ₂)) does not hold",
	};
}
