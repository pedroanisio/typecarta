import { collect } from "../../ast/traversal.js";
/** Family J — Refinement & Predicates (π'₃₈–π'₄₁, π'₆₈–π'₆₉). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_J: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-38",
		name: "Range / Bound Constraint",
		family: "J",
		refines: "pi-10",
		description: "{v:τ | min ≤ v ≤ max} — refinement with a range predicate",
		evaluate(term: TypeTerm) {
			const isRange = (n: TypeTerm) => n.kind === "refinement" && n.predicate.kind === "range";
			if (isRange(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isRange);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No range refinement predicate" };
		},
	},
	{
		id: "pi-prime-39",
		name: "Pattern / Regex Constraint",
		family: "J",
		description: "{v:τ | v ∼ /regex/} — refinement with a pattern predicate",
		evaluate(term: TypeTerm) {
			const isPattern = (n: TypeTerm) => n.kind === "refinement" && n.predicate.kind === "pattern";
			if (isPattern(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isPattern);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No pattern refinement predicate" };
		},
	},
	{
		id: "pi-prime-40",
		name: "Modular / Divisibility Constraint",
		family: "J",
		description: "{v:τ | v mod d = 0} — refinement with a multipleOf predicate",
		evaluate(term: TypeTerm) {
			const isMultipleOf = (n: TypeTerm) =>
				n.kind === "refinement" && n.predicate.kind === "multipleOf";
			if (isMultipleOf(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isMultipleOf);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No multipleOf refinement predicate" };
		},
	},
	{
		id: "pi-prime-41",
		name: "Compound Decidable Predicate",
		family: "J",
		refines: "pi-10",
		description: "Refinement with compound (and/or) predicate composition",
		evaluate(term: TypeTerm) {
			const isCompound = (n: TypeTerm) =>
				n.kind === "refinement" && (n.predicate.kind === "and" || n.predicate.kind === "or");
			if (isCompound(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isCompound);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No compound (and/or) refinement predicate" };
		},
	},
	{
		id: "pi-prime-68",
		name: "String Concatenation Closure",
		family: "J",
		description: "concat(τ₁, τ₂) — apply node with constructor 'concat'",
		evaluate(term: TypeTerm) {
			const isConcat = (n: TypeTerm) => n.kind === "apply" && n.constructor === "concat";
			if (isConcat(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isConcat);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No concat constructor node" };
		},
	},
	{
		id: "pi-prime-69",
		name: "String Pattern Decomposition",
		family: "J",
		meta: "meta-op",
		description: "Concat node annotated with stringDecomposition for pattern splitting",
		evaluate(term: TypeTerm) {
			const isDecomp = (n: TypeTerm) =>
				n.kind === "apply" &&
				n.constructor === "concat" &&
				n.annotations?.stringDecomposition === true;
			if (isDecomp(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isDecomp);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No concat node with stringDecomposition annotation" };
		},
	},
];
