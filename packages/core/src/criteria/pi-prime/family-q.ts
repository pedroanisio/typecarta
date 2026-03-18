import { collect } from "../../ast/traversal.js";
/** Family Q — Type-Level Negation (π'₅₉). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_Q: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-59",
		name: "Type-Level Complement",
		family: "Q",
		description: "Type-level negation / complement (¬τ)",
		evaluate(term: TypeTerm) {
			const isComplement = (n: TypeTerm) => n.kind === "complement";
			if (isComplement(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isComplement);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No complement node" };
		},
	},
];
