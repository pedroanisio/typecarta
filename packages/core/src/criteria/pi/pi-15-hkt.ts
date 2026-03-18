import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

function isHKT(n: TypeTerm): boolean {
	// A forall where the bound variable has a kind constraint (* -> *)
	if (n.kind !== "forall") return false;
	// Check if the bound is itself a type constructor (arrow kind)
	if (n.bound?.kind === "apply" && n.bound.constructor === "arrow") return true;
	// Check for annotation indicating HKT
	return n.annotations?.hkt === true;
}

/** π₁₅: Higher-Kinded — Λ(F: * → *).F(τ) */
export const pi15Hkt: CriterionPredicate = {
	id: "pi-15",
	name: "Higher-Kinded",
	description: "Abstraction over type constructors (higher-kinded types)",
	evaluate(term: TypeTerm): CriterionResult {
		if (isHKT(term)) {
			return { status: "satisfied", witness: term };
		}
		const hkts = collect(term, isHKT);
		if (hkts.length > 0) {
			return { status: "satisfied", witness: hkts[0]! };
		}
		return { status: "not-satisfied", reason: "No higher-kinded type found" };
	},
};
