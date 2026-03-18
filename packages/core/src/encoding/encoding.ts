// Encoding
//
// Define the encoding interface that maps source type terms to IR nodes.
// Implement Definition 5.1: φ : T(Sigma) -> N_R as a total function.

import type { TypeTerm } from "../ast/type-term.js";

/** Represent an encoding from a source schema language into an IR. */
export interface Encoding {
	/** Map a source type term to its IR representation. */
	encode(term: TypeTerm): TypeTerm;
	/** Identify the source adapter. */
	readonly sourceName: string;
	/** Identify the target adapter. */
	readonly targetName: string;
}

/**
 * Create an encoding from a mapping function and adapter names.
 *
 * @param sourceName - Name of the source schema adapter.
 * @param targetName - Name of the target IR adapter.
 * @param encodeFn - Function that maps a source type term to an IR type term.
 * @returns A new {@link Encoding} backed by the given function.
 */
export function createEncoding(
	sourceName: string,
	targetName: string,
	encodeFn: (term: TypeTerm) => TypeTerm,
): Encoding {
	return {
		sourceName,
		targetName,
		encode: encodeFn,
	};
}
