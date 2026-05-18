import type { CriterionId } from "./types.js";

export type SelfCapabilitySupport =
	| "native-node"
	| "apply-constructor"
	| "annotation"
	| "extension"
	| "unsupported"
	| "out-of-scope";

export interface SelfCapability {
	readonly criterionId: CriterionId;
	readonly support: SelfCapabilitySupport;
	readonly mechanism: string;
	readonly witnessKind: string;
	readonly notes: string;
}

/**
 * Machine-readable TypeCarta capability evidence.
 *
 * This registry is intentionally witness-backed: every supported entry here
 * has a corresponding self-witness term in `SELF_WITNESSES`.
 */
export const SELF_CAPABILITIES = [
	{
		criterionId: "pi-prime-08",
		support: "apply-constructor",
		mechanism: "TypeTerm apply constructor",
		witnessKind: "apply:tuple",
		notes: "Positional tuples use the well-known tuple constructor.",
	},
	{
		criterionId: "pi-prime-44",
		support: "extension",
		mechanism: "TypeTerm extension node",
		witnessKind: "extension:foreign-key",
		notes:
			"Inter-object referential constraints are represented as explicit foreign-key extensions.",
	},
	{
		criterionId: "pi-prime-47",
		support: "apply-constructor",
		mechanism: "TypeTerm apply constructor",
		witnessKind: "apply:map",
		notes: "Map/dictionary types use the well-known map constructor.",
	},
	{
		criterionId: "pi-prime-48",
		support: "apply-constructor",
		mechanism: "TypeTerm apply constructor",
		witnessKind: "apply:arrow",
		notes: "Function types use the well-known arrow constructor.",
	},
	{
		criterionId: "pi-prime-53",
		support: "annotation",
		mechanism: "TypeTerm annotation",
		witnessKind: "annotation:deprecated",
		notes: "Deprecation is represented with a deprecated annotation.",
	},
	{
		criterionId: "pi-prime-54",
		support: "annotation",
		mechanism: "TypeTerm annotation",
		witnessKind: "annotation:version",
		notes: "Versioned schema identity is represented with a version annotation.",
	},
	{
		criterionId: "pi-prime-55",
		support: "annotation",
		mechanism: "TypeTerm annotation",
		witnessKind: "annotation:backwardCompatibleWith",
		notes: "Backward compatibility is represented with a backwardCompatibleWith annotation.",
	},
	{
		criterionId: "pi-prime-56",
		support: "annotation",
		mechanism: "TypeTerm annotation",
		witnessKind: "annotation:description",
		notes: "Documentation is represented with a description annotation.",
	},
	{
		criterionId: "pi-prime-57",
		support: "annotation",
		mechanism: "TypeTerm annotation",
		witnessKind: "annotation:examples",
		notes: "Example values are represented with an examples annotation.",
	},
	{
		criterionId: "pi-prime-58",
		support: "annotation",
		mechanism: "TypeTerm annotation",
		witnessKind: "annotation:custom",
		notes: "Custom metadata is represented by annotation keys outside the well-known set.",
	},
	{
		criterionId: "pi-prime-67",
		support: "extension",
		mechanism: "TypeTerm extension node",
		witnessKind: "extension:path-constraint",
		notes: "Path-navigating constraints are represented as explicit path-constraint extensions.",
	},
] as const satisfies readonly SelfCapability[];

export const SELF_CAPABILITY_BY_ID = new Map(
	SELF_CAPABILITIES.map((capability) => [capability.criterionId, capability]),
);
