import { arrow, base, extension, map, tuple } from "../../ast/constructors.js";
import type { TypeTerm } from "../../ast/type-term.js";
import type { CriterionId } from "./types.js";

export interface SelfWitness {
	readonly criterionId: CriterionId;
	readonly name: string;
	readonly term: TypeTerm;
}

/** Canonical TypeCarta witnesses for criteria that external comparisons often misclassify. */
export const SELF_WITNESSES = [
	{
		criterionId: "pi-prime-08",
		name: "positional tuple",
		term: tuple([base("string"), base("number")]),
	},
	{
		criterionId: "pi-prime-44",
		name: "foreign-key extension",
		term: extension("foreign-key", {
			from: ["order", "customerId"],
			to: ["customer", "id"],
		}),
	},
	{
		criterionId: "pi-prime-47",
		name: "map/dictionary",
		term: map(base("string"), base("number")),
	},
	{
		criterionId: "pi-prime-48",
		name: "function/arrow",
		term: arrow([base("string")], base("boolean")),
	},
	{
		criterionId: "pi-prime-53",
		name: "deprecation annotation",
		term: base("string", { deprecated: true }),
	},
	{
		criterionId: "pi-prime-54",
		name: "version annotation",
		term: base("string", { version: "1.0.0" }),
	},
	{
		criterionId: "pi-prime-55",
		name: "backward compatibility annotation",
		term: base("string", { backwardCompatibleWith: "0.9.0" }),
	},
	{
		criterionId: "pi-prime-56",
		name: "description annotation",
		term: base("string", { description: "A documented string value." }),
	},
	{
		criterionId: "pi-prime-57",
		name: "example values annotation",
		term: base("string", { examples: ["alpha", "beta"] }),
	},
	{
		criterionId: "pi-prime-58",
		name: "custom metadata annotation",
		term: base("string", { domainOwner: "catalog" }),
	},
	{
		criterionId: "pi-prime-67",
		name: "path-navigating constraint extension",
		term: extension("path-constraint", {
			path: ["parent", "name"],
			operator: "exists",
		}),
	},
] as const satisfies readonly SelfWitness[];
