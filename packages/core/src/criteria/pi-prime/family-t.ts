import { collect } from "../../ast/traversal.js";
/** Family T — Type-Level Computation (π'₆₃–π'₆₅). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_T: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-63",
		name: "Structural Key Enumeration",
		family: "T",
		description: "keyof operator extracting the key set of a structural type",
		evaluate(term: TypeTerm) {
			const isKeyof = (n: TypeTerm) => n.kind === "keyof";
			if (isKeyof(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isKeyof);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No keyof node" };
		},
	},
	{
		id: "pi-prime-64",
		name: "Mapped Type",
		family: "T",
		description: "Type-level map transforming keys to values ({[K in S]: F(K)})",
		evaluate(term: TypeTerm) {
			const isMapped = (n: TypeTerm) => n.kind === "mapped";
			if (isMapped(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isMapped);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No mapped type node" };
		},
	},
	{
		id: "pi-prime-65",
		name: "Conditional Type",
		family: "T",
		description: "Conditional type branching on subtype relation (τ extends σ ? A : B)",
		evaluate(term: TypeTerm) {
			const isConditional = (n: TypeTerm) => n.kind === "conditional";
			if (isConditional(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isConditional);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No conditional type node" };
		},
	},
];
