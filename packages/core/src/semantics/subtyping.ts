// Subtyping — Definition 2.3
//
// Check the subtyping relation τ₁ ≤ τ₂ via extension inclusion ⟦τ₁⟧ ⊆ ⟦τ₂⟧.
// Use sampling for membership checks; delegate exact decisions to adapters.
//
// Spec: Definition 2.3, typecarta formal semantics.

import type { TypeTerm } from "../ast/type-term.js";
import type { ExtensionEvaluator } from "./extension.js";
import type { Extension, Value } from "./value-universe.js";

/** Represent the outcome of a subtyping check, with an optional counterexample on failure. */
export type SubtypeResult =
	| { readonly holds: true }
	| { readonly holds: false; readonly counterexample?: Value };

/**
 * Check semantic subtyping: ⟦a⟧ ⊆ ⟦b⟧.
 *
 * @param a - Candidate subtype extension.
 * @param b - Candidate supertype extension.
 * @param testValues - Sample values to test (defaults to `a.sample`).
 * @returns A {@link SubtypeResult} indicating whether inclusion holds.
 *
 * @remarks
 * Sound (counterexamples are real) but incomplete (may miss violations)
 * because membership is checked by sampling, not exhaustive enumeration.
 */
export function isSubtype(
	a: Extension,
	b: Extension,
	testValues?: readonly Value[],
): SubtypeResult {
	const values = testValues ?? a.sample ?? [];
	for (const v of values) {
		if (a.contains(v) && !b.contains(v)) {
			return { holds: false, counterexample: v };
		}
	}
	return { holds: true };
}

/**
 * Check semantic type equality via bidirectional subtyping: ⟦a⟧ = ⟦b⟧.
 *
 * @param a - First extension.
 * @param b - Second extension.
 * @param testValues - Sample values to test (defaults to each extension's samples).
 * @returns `true` when both ⟦a⟧ ⊆ ⟦b⟧ and ⟦b⟧ ⊆ ⟦a⟧ hold.
 */
export function isTypeEqual(a: Extension, b: Extension, testValues?: readonly Value[]): boolean {
	const ab = isSubtype(a, b, testValues);
	if (!ab.holds) return false;
	const ba = isSubtype(b, a, testValues);
	return ba.holds;
}

/**
 * Check subtyping between type terms by evaluating their extensions first.
 *
 * @param evaluator - Evaluator that maps type terms to extensions.
 * @param a - Candidate subtype term.
 * @param b - Candidate supertype term.
 * @param testValues - Sample values to test (optional).
 * @returns A {@link SubtypeResult} indicating whether inclusion holds.
 */
export function checkSubtype(
	evaluator: ExtensionEvaluator,
	a: TypeTerm,
	b: TypeTerm,
	testValues?: readonly Value[],
): SubtypeResult {
	return isSubtype(evaluator.evaluate(a), evaluator.evaluate(b), testValues);
}

/**
 * Check type equality between type terms by evaluating their extensions first.
 *
 * @param evaluator - Evaluator that maps type terms to extensions.
 * @param a - First type term.
 * @param b - Second type term.
 * @param testValues - Sample values to test (optional).
 * @returns `true` when bidirectional subtyping holds.
 */
export function checkTypeEqual(
	evaluator: ExtensionEvaluator,
	a: TypeTerm,
	b: TypeTerm,
	testValues?: readonly Value[],
): boolean {
	return isTypeEqual(evaluator.evaluate(a), evaluator.evaluate(b), testValues);
}
