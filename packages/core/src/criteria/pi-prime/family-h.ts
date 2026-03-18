import { collect } from "../../ast/traversal.js";
/** Family H — Parametricity & HKT (π'₂₈–π'₃₃). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_H: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-28",
		name: "Rank-1 Generics",
		family: "H",
		refines: "pi-09",
		description: "Λα.τ — universal quantifier at the outermost level",
		evaluate(term: TypeTerm) {
			if (term.kind === "forall") return { status: "satisfied", witness: term };
			const m = collect(term, (n) => n.kind === "forall");
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No forall (rank-1 generics) node" };
		},
	},
	{
		id: "pi-prime-29",
		name: "Bounded Generics",
		family: "H",
		description: "Λα<:B.τ — forall with an upper-bound constraint",
		evaluate(term: TypeTerm) {
			const isBounded = (n: TypeTerm) => n.kind === "forall" && n.bound !== undefined;
			if (isBounded(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isBounded);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No bounded forall node" };
		},
	},
	{
		id: "pi-prime-30",
		name: "Generic Default",
		family: "H",
		meta: "meta-annot",
		description: "Λα=D.τ — forall with a default type parameter",
		evaluate(term: TypeTerm) {
			const hasDefault = (n: TypeTerm) => n.kind === "forall" && n.default !== undefined;
			if (hasDefault(term)) return { status: "satisfied", witness: term };
			const m = collect(term, hasDefault);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No forall with default type" };
		},
	},
	{
		id: "pi-prime-31",
		name: "Higher-Rank Polymorphism",
		family: "H",
		description: "Quantifier nested under a constructor — forall inside an apply node",
		evaluate(term: TypeTerm) {
			const isHigherRank = (n: TypeTerm) => {
				if (n.kind !== "apply") return false;
				return collect(n, (inner) => inner.kind === "forall").length > 0;
			};
			if (isHigherRank(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isHigherRank);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No higher-rank polymorphism (forall inside apply)" };
		},
	},
	{
		id: "pi-prime-32",
		name: "Higher-Kinded Type Parameter",
		family: "H",
		refines: "pi-15",
		description: "Type parameter that is itself a type constructor (HKT)",
		evaluate(term: TypeTerm) {
			const isHKT = (n: TypeTerm) => {
				if (n.kind !== "forall") return false;
				if (n.annotations?.hkt === true) return true;
				return n.bound !== undefined && n.bound.kind === "apply" && n.bound.constructor === "arrow";
			};
			if (isHKT(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isHKT);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No higher-kinded type parameter" };
		},
	},
	{
		id: "pi-prime-33",
		name: "Variance Annotation",
		family: "H",
		meta: "meta-op",
		description: "Forall with explicit variance (co-, contra-, in-, bi-variant)",
		evaluate(term: TypeTerm) {
			const hasVariance = (n: TypeTerm) => n.kind === "forall" && n.variance !== undefined;
			if (hasVariance(term)) return { status: "satisfied", witness: term };
			const m = collect(term, hasVariance);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No forall with variance annotation" };
		},
	},
];
