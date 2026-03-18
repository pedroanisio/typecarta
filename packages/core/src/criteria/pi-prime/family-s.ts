import { freeVars } from "../../ast/free-vars.js";
import { collect } from "../../ast/traversal.js";
/** Family S — Phantom & Indexed (π'₆₁–π'₆₂). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_S: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-61",
		name: "Phantom Type Parameter",
		family: "S",
		meta: "meta-op",
		description: "Universally quantified variable that does not appear free in the body",
		evaluate(term: TypeTerm) {
			const isPhantom = (n: TypeTerm) => {
				if (n.kind !== "forall") return false;
				const free = freeVars(n.body);
				return !free.has(n.var);
			};
			if (isPhantom(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isPhantom);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No phantom type parameter" };
		},
	},
	{
		id: "pi-prime-62",
		name: "GADT / Indexed Type",
		family: "S",
		description: "Generalized algebraic data type with indexed constraints or gadt annotation",
		evaluate(term: TypeTerm) {
			const isGadt = (n: TypeTerm) => {
				if (n.annotations?.gadt === true) return true;
				if (n.kind !== "forall") return false;
				// forall whose body is a union containing conditional constraints
				const { body } = n;
				if (body.kind !== "apply" || body.constructor !== "union") return false;
				return body.args.some((a) => a.kind === "conditional");
			};
			if (isGadt(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isGadt);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No GADT / indexed type" };
		},
	},
];
