// Denotational Semantics — Definition 3.3
// ⟦·⟧_Σ : 𝒯(Σ) → 𝒫(𝒱)
//
// Map type terms compositionally to extensions (sets of values).
// Use Knaster-Tarski least fixpoint in (𝒫(𝒱), ⊆) for μ nodes.
// Adapters supply per-constructor interpretation.
//
// Spec: Definition 3.3, typecarta formal semantics.

import type { TypeTerm } from "../ast/type-term.js";
import type { Extension, TypePredicate, Value } from "./value-universe.js";
import { EMPTY_EXTENSION, UNIVERSAL_EXTENSION, createExtension } from "./value-universe.js";

/** Compute the extension of f(τ₁, ..., τₙ) given the extensions of each τᵢ. */
export type ConstructorInterpretation = (childExtensions: readonly Extension[]) => Extension;

/** Map type variables to their current extensions during fixpoint iteration. */
export type Environment = ReadonlyMap<string, Extension>;

/** Configure the denotational semantics evaluator. */
export interface DenotationConfig {
	/** Map each constructor name to its interpretation function. */
	readonly constructors: ReadonlyMap<string, ConstructorInterpretation>;
	/** Map each base type name to its extension. */
	readonly baseTypes: ReadonlyMap<string, Extension>;
	/** Cap iterations for fixpoint computation (default: 100). */
	readonly maxFixpointIterations?: number;
	/** Sample values for fixpoint convergence checking. */
	readonly testValues?: readonly Value[];
}

/**
 * Evaluate ⟦term⟧ under a denotation configuration.
 *
 * @param term - Type term to evaluate.
 * @param config - Constructor and base-type interpretations.
 * @param env - Variable-to-extension bindings (default: empty).
 * @returns The extension (set of values) denoted by the term.
 * @throws {Error} When a base type, variable, or constructor is unresolved.
 * @throws {Error} When an adapter-specific term kind cannot be denoted.
 *
 * @remarks
 * For μα.F(α), compute the least fixpoint by iterating from ⊥
 * until the extension stabilizes (checked by sampling test values).
 */
export function denote(
	term: TypeTerm,
	config: DenotationConfig,
	env: Environment = new Map(),
): Extension {
	switch (term.kind) {
		case "bottom":
			return EMPTY_EXTENSION;

		case "top":
			return UNIVERSAL_EXTENSION;

		case "literal":
			return createExtension(
				(v) =>
					v === term.value ||
					(typeof v === "object" && v !== null && JSON.stringify(v) === JSON.stringify(term.value)),
				[term.value],
			);

		case "base": {
			const ext = config.baseTypes.get(term.name);
			if (!ext) throw new Error(`Unknown base type: ${term.name}`);
			return ext;
		}

		case "var": {
			const ext = env.get(term.name);
			if (!ext) throw new Error(`Unbound type variable: ${term.name}`);
			return ext;
		}

		case "apply": {
			const interp = config.constructors.get(term.constructor);
			if (!interp) throw new Error(`Unknown constructor: ${term.constructor}`);
			const childExts = term.args.map((a) => denote(a, config, env));
			return interp(childExts);
		}

		case "mu": {
			// Knaster-Tarski least fixpoint iteration
			const maxIter = config.maxFixpointIterations ?? 100;
			const testVals = config.testValues ?? [];
			let current: Extension = EMPTY_EXTENSION;

			for (let i = 0; i < maxIter; i++) {
				const newEnv = new Map(env);
				newEnv.set(term.var, current);
				const next = denote(term.body, config, newEnv);

				// Check convergence by sampling
				const converged = testVals.every((v) => current.contains(v) === next.contains(v));
				if (converged && i > 0) return next;
				current = next;
			}
			return current;
		}

		case "forall":
			// Parametric types don't have a ground extension;
			// return a marker extension. Callers must instantiate first.
			return createExtension(() => false);

		case "complement": {
			const innerExt = denote(term.inner, config, env);
			return createExtension((v) => !innerExt.contains(v));
		}

		case "refinement": {
			const baseExt = denote(term.base, config, env);
			const pred = compilePredicate(term.predicate);
			return createExtension((v) => baseExt.contains(v) && pred(v));
		}

		case "nominal":
			// Extensionally equivalent to inner
			return denote(term.inner, config, env);

		case "let": {
			const bindingExt = denote(term.binding, config, env);
			const newEnv = new Map(env);
			newEnv.set(term.name, bindingExt);
			return denote(term.body, config, newEnv);
		}

		case "keyof":
		case "conditional":
		case "mapped":
		case "rowpoly":
		case "extension":
			// These require adapter-specific interpretation
			throw new Error(`Cannot denote ${term.kind} without adapter-specific interpretation`);
	}
}

/** Compile a RefinementPredicate into a runtime predicate function. */
function compilePredicate(pred: import("../ast/type-term.js").RefinementPredicate): TypePredicate {
	switch (pred.kind) {
		case "range":
			return (v) => {
				if (typeof v !== "number") return false;
				if (pred.min !== undefined && v < pred.min) return false;
				if (pred.max !== undefined && v > pred.max) return false;
				return true;
			};
		case "pattern":
			return (v) => typeof v === "string" && new RegExp(pred.regex).test(v);
		case "multipleOf":
			return (v) => typeof v === "number" && v % pred.divisor === 0;
		case "custom":
			return () => true; // Custom predicates need adapter interpretation
		case "and": {
			const left = compilePredicate(pred.left);
			const right = compilePredicate(pred.right);
			return (v) => left(v) && right(v);
		}
		case "or": {
			const left = compilePredicate(pred.left);
			const right = compilePredicate(pred.right);
			return (v) => left(v) || right(v);
		}
		case "not": {
			const inner = compilePredicate(pred.inner);
			return (v) => !inner(v);
		}
	}
}
