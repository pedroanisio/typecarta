import { collect } from "../../ast/traversal.js";
/** Family C — Field Modality (π'₁₁–π'₁₅). */
import type { TypeTerm } from "../../ast/type-term.js";
import type { PiPrimeCriterion } from "./types.js";

function getFields(n: TypeTerm) {
	return n.kind === "apply" && n.constructor === "product" ? (n.fields ?? []) : [];
}

export const FAMILY_C: readonly PiPrimeCriterion[] = [
	{
		id: "pi-prime-11",
		name: "Required Field",
		family: "C",
		refines: "pi-04",
		description: "∀v ∈ ⟦S⟧, lᵢ ∈ dom(v)",
		evaluate(term: TypeTerm) {
			const has = (n: TypeTerm) => getFields(n).some((f) => !f.optional);
			if (has(term)) return { status: "satisfied", witness: term };
			const m = collect(term, has);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No required fields" };
		},
	},
	{
		id: "pi-prime-12",
		name: "Optional-by-Absence",
		family: "C",
		refines: "pi-11",
		description: "Key may be absent from the value",
		evaluate(term: TypeTerm) {
			const has = (n: TypeTerm) => getFields(n).some((f) => f.optional === true);
			if (has(term)) return { status: "satisfied", witness: term };
			const m = collect(term, has);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No optional-by-absence fields" };
		},
	},
	{
		id: "pi-prime-13",
		name: "Nullable-by-Value",
		family: "C",
		description: "Key always present; null carried in-band as a value",
		evaluate(term: TypeTerm) {
			const has = (n: TypeTerm) => {
				const fields = getFields(n);
				return fields.some(
					(f) =>
						f.type.kind === "apply" &&
						f.type.constructor === "union" &&
						f.type.args.some((a) => a.kind === "base" && a.name === "null"),
				);
			};
			if (has(term)) return { status: "satisfied", witness: term };
			const m = collect(term, has);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No nullable-by-value fields" };
		},
	},
	{
		id: "pi-prime-14",
		name: "Default Value",
		family: "C",
		meta: "meta-coerce",
		description: "Field has a default value (validation-with-coercion domain)",
		evaluate(term: TypeTerm) {
			const has = (n: TypeTerm) => getFields(n).some((f) => f.defaultValue !== undefined);
			if (has(term)) return { status: "satisfied", witness: term };
			const m = collect(term, has);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No default values" };
		},
	},
	{
		id: "pi-prime-15",
		name: "Read-Only Marker",
		family: "C",
		meta: "meta-annot",
		description: "Field annotated as read-only (no effect on extension)",
		evaluate(term: TypeTerm) {
			const has = (n: TypeTerm) => getFields(n).some((f) => f.readonly === true);
			if (has(term)) return { status: "satisfied", witness: term };
			const m = collect(term, has);
			return m.length > 0
				? { status: "satisfied", witness: m[0]! }
				: { status: "not-satisfied", reason: "No read-only markers" };
		},
	},
];
