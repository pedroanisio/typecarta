import { collect } from "../../ast/traversal.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionPredicate, CriterionResult } from "../types.js";

function isOpenRecord(n: TypeTerm): boolean {
	if (n.kind === "rowpoly") return true;
	if (n.kind !== "apply" || n.constructor !== "product") return false;
	// Check for open-shape annotation
	return n.annotations?.open === true;
}

/** π₁₃: Open Shape — extensible record */
export const pi13OpenShape: CriterionPredicate = {
	id: "pi-13",
	name: "Open Shape",
	description: "The schema allows additional, unknown properties",
	evaluate(term: TypeTerm): CriterionResult {
		if (isOpenRecord(term)) {
			return { status: "satisfied", witness: term };
		}
		if (term.kind === "rowpoly") {
			return { status: "satisfied", witness: term };
		}
		const opens = collect(term, isOpenRecord);
		if (opens.length > 0) {
			return { status: "satisfied", witness: opens[0]! };
		}
		return { status: "not-satisfied", reason: "No open/extensible record found" };
	},
};
