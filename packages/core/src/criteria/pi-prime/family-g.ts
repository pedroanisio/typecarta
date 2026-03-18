import { collect } from "../../ast/traversal.js";
/** Family G — Recursion (π'₂₅–π'₂₇). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_G: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-25",
		name: "Direct Self-Recursion",
		family: "G",
		refines: "pi-07",
		description: "μα.F(α) — fixpoint node for direct self-recursion",
		evaluate(term: TypeTerm) {
			if (term.kind === "mu") return { status: "satisfied", witness: term };
			const m = collect(term, (n) => n.kind === "mu");
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No mu (self-recursion) node" };
		},
	},
	{
		id: "pi-prime-26",
		name: "Mutual Recursion",
		family: "G",
		refines: "pi-08",
		description: "Nested μ inside μ — mutual recursion via double fixpoint",
		evaluate(term: TypeTerm) {
			const isMutualRec = (n: TypeTerm) => {
				if (n.kind !== "mu") return false;
				return collect(n.body, (inner) => inner.kind === "mu").length > 0;
			};
			if (isMutualRec(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isMutualRec);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No nested mu (mutual recursion)" };
		},
	},
	{
		id: "pi-prime-27",
		name: "Recursive Generic",
		family: "G",
		description: "Λα.μβ.F(α,β) — forall whose body contains a μ fixpoint",
		evaluate(term: TypeTerm) {
			const isRecGeneric = (n: TypeTerm) => {
				if (n.kind !== "forall") return false;
				return collect(n.body, (inner) => inner.kind === "mu").length > 0;
			};
			if (isRecGeneric(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isRecGeneric);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No forall containing mu (recursive generic)" };
		},
	},
];
