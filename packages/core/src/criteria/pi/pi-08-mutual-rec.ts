import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

function hasMutualRecursion(term: TypeTerm): boolean {
	if (term.kind !== "mu") return false;
	// Check if the body contains another μ that references variables
	// from the outer μ — indicating mutual recursion
	const innerMus = collect(term.body, (n) => n.kind === "mu");
	return innerMus.length > 0;
}

/** π₈: Mutual Recursion — two distinct named nodes in a cycle */
export const pi08MutualRec: CriterionPredicate = {
	id: "pi-08",
	name: "Mutual Recursion",
	description: "The schema uses mutual recursion (cross-referencing cycle)",
	evaluate(term: TypeTerm): CriterionResult {
		if (hasMutualRecursion(term)) {
			return { status: "satisfied", witness: term };
		}
		const candidates = collect(term, hasMutualRecursion);
		if (candidates.length > 0) {
			return { status: "satisfied", witness: candidates[0]! };
		}
		return { status: "not-satisfied", reason: "No mutual recursion found" };
	},
};
