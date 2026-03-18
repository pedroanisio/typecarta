import { collect } from "../../ast/traversal.js";
/** Family F — Intersection (π'₂₃–π'₂₄). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_F: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-23",
		name: "Record-Merge Intersection",
		family: "F",
		refines: "pi-06",
		description: "Intersection where both operands contribute structural fields",
		evaluate(term: TypeTerm) {
			function isRecordMerge(n: TypeTerm): boolean {
				if (n.kind !== "apply" || n.constructor !== "intersection" || n.args.length < 2)
					return false;
				return n.args.every(
					(a: TypeTerm) =>
						a.kind === "apply" && a.constructor === "product" && (a.fields?.length ?? 0) > 0,
				);
			}
			if (isRecordMerge(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isRecordMerge);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No record-merge intersection" };
		},
	},
	{
		id: "pi-prime-24",
		name: "Refinement Intersection",
		family: "F",
		description: "Intersection of structural type with refinement predicate",
		evaluate(term: TypeTerm) {
			function isRefinementIntersection(n: TypeTerm): boolean {
				if (n.kind !== "apply" || n.constructor !== "intersection" || n.args.length < 2)
					return false;
				return n.args.some((a: TypeTerm) => a.kind === "refinement");
			}
			if (isRefinementIntersection(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isRefinementIntersection);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No refinement intersection" };
		},
	},
];
