import { collect } from "../../ast/traversal.js";
/** Family L — Collection Types (π'₄₅–π'₄₇). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_L: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-45",
		name: "Homogeneous Array / List",
		family: "L",
		description: "Ordered, variable-length collection of homogeneous elements (Array<τ>)",
		evaluate(term: TypeTerm) {
			const isArray = (n: TypeTerm) => n.kind === "apply" && n.constructor === "array";
			if (isArray(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isArray);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No array/list type" };
		},
	},
	{
		id: "pi-prime-46",
		name: "Set / Unique Collection",
		family: "L",
		description: "Unordered collection of unique elements (Set<τ>)",
		evaluate(term: TypeTerm) {
			const isSet = (n: TypeTerm) => n.kind === "apply" && n.constructor === "set";
			if (isSet(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isSet);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No set type" };
		},
	},
	{
		id: "pi-prime-47",
		name: "Map / Dictionary",
		family: "L",
		description: "Key-value collection mapping one type to another (Map<κ, ν>)",
		evaluate(term: TypeTerm) {
			const isMap = (n: TypeTerm) => n.kind === "apply" && n.constructor === "map";
			if (isMap(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isMap);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No map/dictionary type" };
		},
	},
];
