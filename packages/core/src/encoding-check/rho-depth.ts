// encoding-check/rho-depth
// Check the rho_D property: depth subtyping preservation (Def. 13.2).

import type { TypeTerm } from "../ast/type-term.js";
import type { Encoding } from "../encoding/encoding.js";
import type { ExtensionEvaluator } from "../semantics/extension.js";
import { isSubtype } from "../semantics/subtyping.js";
import type { Value } from "../semantics/value-universe.js";
import type { EncodingCheckResult } from "./types.js";

/**
 * Check that depth subtyping is preserved under the encoding.
 *
 * @param deep - The deeper (more nested) type term.
 * @param shallow - The shallower type term.
 * @param encoding - The encoding function phi to test.
 * @param targetEvaluator - The extension evaluator for the target IR.
 * @param testValues - The universe of test values for subtype checking.
 * @returns An {@link EncodingCheckResult} for the rho-depth property.
 */
export function checkDepthPreservation(
	deep: TypeTerm,
	shallow: TypeTerm,
	encoding: Encoding,
	targetEvaluator: ExtensionEvaluator,
	testValues: readonly Value[],
): EncodingCheckResult {
	const encodedDeep = encoding.encode(deep);
	const encodedShallow = encoding.encode(shallow);

	const deepExt = targetEvaluator.evaluate(encodedDeep);
	const shallowExt = targetEvaluator.evaluate(encodedShallow);
	const result = isSubtype(deepExt, shallowExt, testValues);

	return {
		property: "rho-depth",
		holds: result.holds,
		witness: [deep, shallow],
		reason: result.holds ? "Depth subtyping preserved" : "φ(S_deep) ≤ φ(S_shallow) does not hold",
	};
}
