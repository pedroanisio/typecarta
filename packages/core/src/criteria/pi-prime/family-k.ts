import { collect } from "../../ast/traversal.js";
/** Family K — Value Dependency (π'₄₂–π'₄₄, π'₆₇). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_K: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-42",
		name: "Finite Tagged Dependent Choice",
		family: "K",
		refines: "pi-14",
		description: "Discriminated union where branch field types depend on a tag literal",
		evaluate(term: TypeTerm) {
			const isDiscriminated = (n: TypeTerm) => {
				if (n.kind !== "apply" || n.constructor !== "union") return false;
				// Each branch must be a product with at least one literal-typed field (the tag)
				return (
					n.args.length >= 2 &&
					n.args.every((branch) => {
						if (branch.kind !== "apply" || branch.constructor !== "product") return false;
						return (branch.fields ?? []).some((f) => f.type.kind === "literal");
					})
				);
			};
			if (isDiscriminated(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isDiscriminated);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No discriminated union with tag-dependent branches" };
		},
	},
	{
		id: "pi-prime-43",
		name: "Intra-Object Cross-Field Constraint",
		family: "K",
		description: "Constraint relating multiple fields within the same product",
		evaluate(term: TypeTerm) {
			const isCrossField = (n: TypeTerm) => {
				if (n.kind === "apply" && n.constructor === "product" && n.annotations?.crossField === true)
					return true;
				if (n.kind === "refinement" && n.base.kind === "apply" && n.base.constructor === "product")
					return true;
				return false;
			};
			if (isCrossField(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isCrossField);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No cross-field constraint on a product" };
		},
	},
	{
		id: "pi-prime-44",
		name: "Inter-Object Referential Constraint",
		family: "K",
		meta: "meta-multi",
		description: "Foreign-key extension linking fields across separate objects",
		evaluate(term: TypeTerm) {
			const isForeignKey = (n: TypeTerm) =>
				n.kind === "extension" && n.extensionKind === "foreign-key";
			if (isForeignKey(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isForeignKey);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No foreign-key extension node" };
		},
	},
	{
		id: "pi-prime-67",
		name: "Path-Navigating Constraint",
		family: "K",
		description: "Constraint that navigates a path through nested structure",
		evaluate(term: TypeTerm) {
			const isPathConstraint = (n: TypeTerm) => {
				if (n.kind === "extension" && n.extensionKind === "path-constraint") return true;
				if (n.annotations?.pathConstraint === true) return true;
				return false;
			};
			if (isPathConstraint(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isPathConstraint);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No path-navigating constraint" };
		},
	},
];
