// encoding-check/rho-width
// Check the rho_W property: width subtyping preservation (Def. 13.2).

import type { TypeTerm } from "../ast/type-term.js";
import type { Encoding } from "../encoding/encoding.js";
import type { ExtensionEvaluator } from "../semantics/extension.js";
import { isSubtype } from "../semantics/subtyping.js";
import type { Value } from "../semantics/value-universe.js";
import type { EncodingCheckResult } from "./types.js";

/**
 * Check that width subtyping is preserved under the encoding.
 *
 * @param wide - The wider (more fields) type term.
 * @param narrow - The narrower type term.
 * @param encoding - The encoding function phi to test.
 * @param targetEvaluator - The extension evaluator for the target IR.
 * @param testValues - The universe of test values for subtype checking.
 * @returns An {@link EncodingCheckResult} for the rho-width property.
 */
export function checkWidthPreservation(
	wide: TypeTerm,
	narrow: TypeTerm,
	encoding: Encoding,
	targetEvaluator: ExtensionEvaluator,
	testValues: readonly Value[],
): EncodingCheckResult {
	const encodedWide = encoding.encode(wide);
	const encodedNarrow = encoding.encode(narrow);

	const widthExt = targetEvaluator.evaluate(encodedWide);
	const narrowExt = targetEvaluator.evaluate(encodedNarrow);
	const result = isSubtype(widthExt, narrowExt, testValues);

	return {
		property: "rho-width",
		holds: result.holds,
		witness: [wide, narrow],
		reason: result.holds ? "Width subtyping preserved" : "φ(S_wide) ≤ φ(S_narrow) does not hold",
	};
}
