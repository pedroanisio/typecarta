// Extension computation — Definition 2.2
//
// Define the interface for computing ⟦τ⟧, mapping a TypeTerm to its
// Extension (the set of values it accepts).
//
// Spec: Definition 2.2, typecarta formal semantics.

import type { TypeTerm } from "../ast/type-term.js";
import type { Extension, Value } from "./value-universe.js";

/** Compute ⟦τ⟧ for a given TypeTerm. Adapters supply the concrete implementation. */
export interface ExtensionEvaluator {
	/** Compute the extension of a type term. */
	evaluate(term: TypeTerm): Extension;

	/** Check if a value inhabits a type term: v ∈ ⟦τ⟧. */
	inhabits(value: Value, term: TypeTerm): boolean;
}

/**
 * Create an {@link ExtensionEvaluator} from an evaluate function.
 *
 * @param evaluate - Function that maps a type term to its extension.
 * @returns An evaluator with `evaluate` and derived `inhabits` methods.
 */
export function createEvaluator(evaluate: (term: TypeTerm) => Extension): ExtensionEvaluator {
	return {
		evaluate,
		inhabits(value: Value, term: TypeTerm): boolean {
			return evaluate(term).contains(value);
		},
	};
}
