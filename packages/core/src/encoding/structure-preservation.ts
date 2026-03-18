// Structure Preservation
//
// Verify structure preservation (monotonicity) of an encoding (Definition 5.5).
// Confirm that subtyping in the source language implies subtyping in the IR.

import type { TypeTerm } from "../ast/type-term.js";
import type { ExtensionEvaluator } from "../semantics/extension.js";
import { isSubtype } from "../semantics/subtyping.js";
import type { Value } from "../semantics/value-universe.js";
import type { Encoding } from "./encoding.js";

/** Hold the outcome of a structure-preservation (monotonicity) check. */
export interface StructurePreservationResult {
	readonly isPreserving: boolean;
	readonly violations: readonly StructureViolation[];
}

/** Describe a single structure-preservation violation where source subtyping fails to transfer to the IR. */
export interface StructureViolation {
	readonly a: TypeTerm;
	readonly b: TypeTerm;
	readonly reason: string;
}

/**
 * Check whether an encoding preserves subtyping order from source to IR.
 *
 * @param encoding - The encoding to verify.
 * @param sourceEvaluator - Evaluator for the source schema language.
 * @param targetEvaluator - Evaluator for the target IR.
 * @param subtypePairs - Pairs of type terms where a subtyping relation may hold in the source.
 * @param testValues - Sample values used to check subtyping via extension membership.
 * @returns A {@link StructurePreservationResult} indicating whether subtyping is preserved.
 */
export function checkStructurePreservation(
	encoding: Encoding,
	sourceEvaluator: ExtensionEvaluator,
	targetEvaluator: ExtensionEvaluator,
	subtypePairs: readonly [TypeTerm, TypeTerm][],
	testValues: readonly Value[],
): StructurePreservationResult {
	const violations: StructureViolation[] = [];

	for (const [a, b] of subtypePairs) {
		// Check if a ≤ b in source
		const sourceA = sourceEvaluator.evaluate(a);
		const sourceB = sourceEvaluator.evaluate(b);
		const sourceSubtype = isSubtype(sourceA, sourceB, testValues);

		if (sourceSubtype.holds) {
			// Then φ(a) ≤ φ(b) must hold in target
			const encodedA = encoding.encode(a);
			const encodedB = encoding.encode(b);
			const targetA = targetEvaluator.evaluate(encodedA);
			const targetB = targetEvaluator.evaluate(encodedB);
			const targetSubtype = isSubtype(targetA, targetB, testValues);

			if (!targetSubtype.holds) {
				violations.push({
					a,
					b,
					reason: "a ≤ b in source but φ(a) ≤ φ(b) fails in target",
				});
			}
		}
	}

	return { isPreserving: violations.length === 0, violations };
}
