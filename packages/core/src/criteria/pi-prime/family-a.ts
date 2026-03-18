import { collect } from "../../ast/traversal.js";
/** Family A — Cardinality and Base-Set Structure (π'₁–π'₇). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_A: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-01",
		name: "Syntactic Bottom",
		family: "A",
		refines: "pi-01",
		description: "IR carries an explicit, named bottom node (⊥ ∈ B)",
		evaluate(term: TypeTerm) {
			if (term.kind === "bottom") return { status: "satisfied", witness: term };
			const m = collect(term, (n) => n.kind === "bottom");
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No syntactic bottom node" };
		},
	},
	{
		id: "pi-prime-02",
		name: "Semantic Emptiness",
		family: "A",
		refines: "pi-01",
		description: "Empty extension via constraint interaction, not explicit ⊥",
		evaluate(term: TypeTerm) {
			// A refinement with unsatisfiable predicate, or intersection yielding empty
			if (term.kind === "refinement") return { status: "satisfied", witness: term };
			if (term.kind === "apply" && term.constructor === "intersection")
				return { status: "satisfied", witness: term };
			const m = collect(
				term,
				(n) => n.kind === "refinement" || (n.kind === "apply" && n.constructor === "intersection"),
			);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No semantic emptiness pattern" };
		},
	},
	{
		id: "pi-prime-03",
		name: "Global Top",
		family: "A",
		refines: "pi-02",
		description: "⟦S⟧ = 𝒱",
		evaluate(term: TypeTerm) {
			if (term.kind === "top") return { status: "satisfied", witness: term };
			const m = collect(term, (n) => n.kind === "top");
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No global top" };
		},
	},
	{
		id: "pi-prime-04",
		name: "Sort-Restricted Top",
		family: "A",
		description: "Top within a sort: all strings, all numbers (𝒱_b ⊊ 𝒱)",
		evaluate(term: TypeTerm) {
			if (term.kind === "base") return { status: "satisfied", witness: term };
			const m = collect(term, (n) => n.kind === "base");
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No sort-restricted top" };
		},
	},
	{
		id: "pi-prime-05",
		name: "Singleton Literal",
		family: "A",
		refines: "pi-03",
		description: "|⟦S⟧| = 1 via literal constant",
		evaluate(term: TypeTerm) {
			if (term.kind === "literal") return { status: "satisfied", witness: term };
			const m = collect(term, (n) => n.kind === "literal");
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No singleton literal" };
		},
	},
	{
		id: "pi-prime-06",
		name: "Finite Homogeneous Enum",
		family: "A",
		description: "Finite set of values from same base sort (e.g. 'red' | 'green' | 'blue')",
		evaluate(term: TypeTerm) {
			if (
				term.kind === "apply" &&
				term.constructor === "union" &&
				term.args.length >= 2 &&
				term.args.every((a) => a.kind === "literal")
			) {
				return { status: "satisfied", witness: term };
			}
			const m = collect(
				term,
				(n) =>
					n.kind === "apply" &&
					n.constructor === "union" &&
					n.args.length >= 2 &&
					n.args.every((a) => a.kind === "literal"),
			);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No homogeneous enum" };
		},
	},
	{
		id: "pi-prime-07",
		name: "Finite Heterogeneous Enum",
		family: "A",
		description: "Finite set of values from different base sorts (e.g. 1 | 'one' | true)",
		evaluate(term: TypeTerm) {
			function isHeteroEnum(n: TypeTerm): boolean {
				if (n.kind !== "apply" || n.constructor !== "union" || n.args.length < 2) return false;
				if (!n.args.every((a) => a.kind === "literal")) return false;
				const types = new Set(
					n.args.map((a) => typeof (a as Extract<TypeTerm, { kind: "literal" }>).value),
				);
				return types.size > 1;
			}
			if (isHeteroEnum(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isHeteroEnum);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No heterogeneous enum" };
		},
	},
];
