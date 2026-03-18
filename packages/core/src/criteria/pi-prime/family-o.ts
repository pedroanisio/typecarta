import { collect } from "../../ast/traversal.js";
/** Family O — Evolution & Compatibility [meta-annot] (π'₅₃–π'₅₅). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

export const FAMILY_O: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-53",
		name: "Deprecation Annotation",
		family: "O",
		meta: "meta-annot",
		description: "Type carries a deprecation marker (deprecated: true)",
		evaluate(term: TypeTerm) {
			const isDeprecated = (n: TypeTerm) => n.annotations?.deprecated === true;
			if (isDeprecated(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isDeprecated);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No deprecation annotation" };
		},
	},
	{
		id: "pi-prime-54",
		name: "Versioned Schema Identity",
		family: "O",
		meta: "meta-annot",
		description: "Type carries a version annotation for schema identity",
		evaluate(term: TypeTerm) {
			const isVersioned = (n: TypeTerm) => n.annotations?.version !== undefined;
			if (isVersioned(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isVersioned);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No version annotation" };
		},
	},
	{
		id: "pi-prime-55",
		name: "Backward Compatibility",
		family: "O",
		meta: "meta-annot",
		description: "Type carries a backward-compatibility reference annotation",
		evaluate(term: TypeTerm) {
			const isBackCompat = (n: TypeTerm) => n.annotations?.backwardCompatibleWith !== undefined;
			if (isBackCompat(term)) return { status: "satisfied", witness: term };
			const m = collect(term, isBackCompat);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No backward compatibility annotation" };
		},
	},
];
