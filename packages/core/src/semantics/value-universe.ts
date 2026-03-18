// Value Universe — Definition 2.1
//
// Define the abstract semantic domain 𝒱 and the Extension interface.
// Adapters supply concrete value universes.
//
// Spec: Definition 2.1, typecarta formal semantics.

/** A value in the universe 𝒱. */
export type Value = unknown;

/** Test membership of a value in a type: τ(v) → {true, false}. */
export type TypePredicate = (value: Value) => boolean;

/** Represent the extension ⟦τ⟧ = { v in 𝒱 | τ(v) = true } as a predicate over values. */
export interface Extension {
	/** Check if a value is in the extension. */
	readonly contains: TypePredicate;
	/** Optional finite sample for testing/comparison. */
	readonly sample?: readonly Value[];
}

/**
 * Create an extension from a predicate and optional sample values.
 *
 * @param contains - Membership predicate for the extension.
 * @param sample - Finite sample for testing and comparison (optional).
 * @returns An {@link Extension} backed by the given predicate.
 */
export function createExtension(contains: TypePredicate, sample?: readonly Value[]): Extension {
	return sample ? { contains, sample } : { contains };
}

/** The empty extension (⊥ / bottom). */
export const EMPTY_EXTENSION: Extension = createExtension(() => false, []);

/** The universal extension (⊤ / top). */
export const UNIVERSAL_EXTENSION: Extension = createExtension(() => true);

/**
 * Create an extension containing exactly one value.
 *
 * @param value - The sole member of the extension.
 * @returns A singleton {@link Extension}.
 */
export function singletonExtension(value: Value): Extension {
	return createExtension(
		(v) =>
			Object.is(v, value) ||
			(typeof v === "object" && v !== null && JSON.stringify(v) === JSON.stringify(value)),
		[value],
	);
}

/**
 * Test extension equality by sampling membership over a set of values.
 *
 * @param a - First extension.
 * @param b - Second extension.
 * @param testValues - Values to probe for membership agreement.
 * @returns `true` when every test value yields the same membership in both extensions.
 *
 * @remarks
 * Heuristic only -- exact equality is undecidable for predicate-based extensions.
 */
export function extensionsEqualBySampling(
	a: Extension,
	b: Extension,
	testValues: readonly Value[],
): boolean {
	return testValues.every((v) => a.contains(v) === b.contains(v));
}
