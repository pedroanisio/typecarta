import { collect } from "../../ast/traversal.js";
/** Family P — Meta-Annotation [meta-annot] (π'₅₆–π'₅₈). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

/** Well-known annotation keys that are not considered custom metadata. */
const WELL_KNOWN_KEYS = new Set([
	"description",
	"examples",
	"deprecated",
	"version",
	"open",
	"backwardCompatibleWith",
	"visibility",
	"bivariant",
	"gadt",
	"stateMachine",
]);

export const FAMILY_P: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-56",
		name: "Description / Documentation",
		family: "P",
		meta: "meta-annot",
		description: "Type carries a human-readable description annotation",
		evaluate(term: TypeTerm) {
			const hasDescription = (n: TypeTerm) => n.annotations?.description !== undefined;
			if (hasDescription(term)) return { status: "satisfied", witness: term };
			const m = collect(term, hasDescription);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No description annotation" };
		},
	},
	{
		id: "pi-prime-57",
		name: "Example Values",
		family: "P",
		meta: "meta-annot",
		description: "Type carries example value annotations",
		evaluate(term: TypeTerm) {
			const hasExamples = (n: TypeTerm) => n.annotations?.examples !== undefined;
			if (hasExamples(term)) return { status: "satisfied", witness: term };
			const m = collect(term, hasExamples);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No examples annotation" };
		},
	},
	{
		id: "pi-prime-58",
		name: "Custom Extension Metadata",
		family: "P",
		meta: "meta-annot",
		description: "Type carries custom annotation keys beyond the well-known set",
		evaluate(term: TypeTerm) {
			const hasCustomAnnotation = (n: TypeTerm) => {
				if (!n.annotations) return false;
				return Object.keys(n.annotations).some((k) => !WELL_KNOWN_KEYS.has(k));
			};
			if (hasCustomAnnotation(term)) return { status: "satisfied", witness: term };
			const m = collect(term, hasCustomAnnotation);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No custom extension metadata" };
		},
	},
];
