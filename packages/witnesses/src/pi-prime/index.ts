// pi-prime/index
// Aggregate the expanded witness schemas (SP1..SP70) and expose them as the DIVERSE_PRIME_SCHEMAS array.

import type { TypeTerm } from "@typecarta/core";
import type { PiPrimeId } from "@typecarta/core";

// ─── Family A ────────────────────────────────────────────────────────
import {
	SP01_SYNTACTIC_BOTTOM,
	SP02_SEMANTIC_EMPTINESS,
	SP03_GLOBAL_TOP,
	SP04_SORT_RESTRICTED_TOP,
	SP05_SINGLETON_LITERAL,
	SP06_HOMO_ENUM,
	SP07_HETERO_ENUM,
} from "./family-a.js";

// ─── Family B ────────────────────────────────────────────────────────
import { SP08_POSITIONAL_TUPLE, SP09_LABELLED_RECORD, SP10_VARIADIC_TUPLE } from "./family-b.js";

// ─── Family C ────────────────────────────────────────────────────────
import {
	SP11_REQUIRED_FIELD,
	SP12_OPTIONAL_FIELD,
	SP13_NULLABLE_FIELD,
	SP14_DEFAULT_VALUE,
	SP15_READONLY_FIELD,
} from "./family-c.js";

// ─── Family D ────────────────────────────────────────────────────────
import { SP16_CLOSED_RECORD, SP17_OPEN_RECORD, SP18_TYPED_EXTRAS } from "./family-d.js";

// ─── Family E ────────────────────────────────────────────────────────
import {
	SP19_UNTAGGED_UNION,
	SP20_DISCRIMINATED_UNION,
	SP21_SHAPE_DISCRIMINATED,
	SP22_EXHAUSTIVE_UNION,
} from "./family-e.js";

// ─── Family F ────────────────────────────────────────────────────────
import { SP23_RECORD_MERGE, SP24_REFINEMENT_INTERSECTION } from "./family-f.js";

// ─── Family G ────────────────────────────────────────────────────────
import {
	SP25_DIRECT_RECURSION,
	SP26_MUTUAL_RECURSION,
	SP27_RECURSIVE_GENERIC,
} from "./family-g.js";

// ─── Family H ────────────────────────────────────────────────────────
import {
	SP28_RANK1_GENERICS,
	SP29_BOUNDED_GENERICS,
	SP30_GENERIC_DEFAULT,
	SP31_HIGHER_RANK,
	SP32_HKT,
	SP33_VARIANCE,
} from "./family-h.js";

// ─── Family I ────────────────────────────────────────────────────────
import { SP34_STRUCTURAL, SP35_NOMINAL_TAG, SP36_OPAQUE, SP37_COERCION } from "./family-i.js";

// ─── Family J ────────────────────────────────────────────────────────
import {
	SP38_RANGE,
	SP39_PATTERN,
	SP40_MULTIPLE_OF,
	SP41_COMPOUND,
	SP68_STRING_CONCAT,
	SP69_STRING_DECOMPOSITION,
} from "./family-j.js";

// ─── Family K ────────────────────────────────────────────────────────
import {
	SP42_TAGGED_DEPENDENT,
	SP43_CROSS_FIELD,
	SP44_FOREIGN_KEY,
	SP67_PATH_CONSTRAINT,
} from "./family-k.js";

// ─── Family L ────────────────────────────────────────────────────────
import { SP45_ARRAY, SP46_SET, SP47_MAP } from "./family-l.js";

// ─── Family M ────────────────────────────────────────────────────────
import { SP48_ARROW, SP49_OVERLOADED } from "./family-m.js";

// ─── Family N ────────────────────────────────────────────────────────
import { SP50_TYPE_ALIAS, SP51_MODULE, SP52_VISIBILITY } from "./family-n.js";

// ─── Family O ────────────────────────────────────────────────────────
import { SP53_DEPRECATED, SP54_VERSIONED, SP55_BACKWARD_COMPAT } from "./family-o.js";

// ─── Family P ────────────────────────────────────────────────────────
import { SP56_DESCRIPTION, SP57_EXAMPLES, SP58_CUSTOM_META } from "./family-p.js";

// ─── Family Q ────────────────────────────────────────────────────────
import { SP59_COMPLEMENT } from "./family-q.js";

// ─── Family R ────────────────────────────────────────────────────────
import { SP60_BIVARIANT } from "./family-r.js";

// ─── Family S ────────────────────────────────────────────────────────
import { SP61_PHANTOM, SP62_GADT } from "./family-s.js";

// ─── Family T ────────────────────────────────────────────────────────
import { SP63_KEYOF, SP64_MAPPED, SP65_CONDITIONAL } from "./family-t.js";

// ─── Family U ────────────────────────────────────────────────────────
import { SP66_ROW_POLY } from "./family-u.js";

// ─── Family V ────────────────────────────────────────────────────────
import { SP70_STATE_MACHINE } from "./family-v.js";

/** A witness schema paired with its primary pi-prime criterion. */
export interface WitnessPrimeSchema {
	readonly id: PiPrimeId;
	readonly name: string;
	readonly schema: TypeTerm;
}

/** The expanded diverse schema set C' = {SP₁, ..., SP₇₀}. */
export const DIVERSE_PRIME_SCHEMAS: readonly WitnessPrimeSchema[] = [
	// Family A — Cardinality & base-set
	{ id: "pi-prime-01", name: "SP₁ — Syntactic Bottom", schema: SP01_SYNTACTIC_BOTTOM },
	{ id: "pi-prime-02", name: "SP₂ — Semantic Emptiness", schema: SP02_SEMANTIC_EMPTINESS },
	{ id: "pi-prime-03", name: "SP₃ — Global Top", schema: SP03_GLOBAL_TOP },
	{ id: "pi-prime-04", name: "SP₄ — Sort-Restricted Top", schema: SP04_SORT_RESTRICTED_TOP },
	{ id: "pi-prime-05", name: "SP₅ — Singleton Literal", schema: SP05_SINGLETON_LITERAL },
	{ id: "pi-prime-06", name: "SP₆ — Finite Homogeneous Enum", schema: SP06_HOMO_ENUM },
	{ id: "pi-prime-07", name: "SP₇ — Finite Heterogeneous Enum", schema: SP07_HETERO_ENUM },
	// Family B — Products, records, tuples
	{ id: "pi-prime-08", name: "SP₈ — Positional Tuple", schema: SP08_POSITIONAL_TUPLE },
	{ id: "pi-prime-09", name: "SP₉ — Labelled Record", schema: SP09_LABELLED_RECORD },
	{ id: "pi-prime-10", name: "SP₁₀ — Variadic Tuple", schema: SP10_VARIADIC_TUPLE },
	// Family C — Field modality
	{ id: "pi-prime-11", name: "SP₁₁ — Required Field", schema: SP11_REQUIRED_FIELD },
	{ id: "pi-prime-12", name: "SP₁₂ — Optional Field", schema: SP12_OPTIONAL_FIELD },
	{ id: "pi-prime-13", name: "SP₁₃ — Nullable Field", schema: SP13_NULLABLE_FIELD },
	{ id: "pi-prime-14", name: "SP₁₄ — Default Value", schema: SP14_DEFAULT_VALUE },
	{ id: "pi-prime-15", name: "SP₁₅ — Read-Only Field", schema: SP15_READONLY_FIELD },
	// Family D — Shape closure
	{ id: "pi-prime-16", name: "SP₁₆ — Closed Record", schema: SP16_CLOSED_RECORD },
	{ id: "pi-prime-17", name: "SP₁₇ — Open Record", schema: SP17_OPEN_RECORD },
	{ id: "pi-prime-18", name: "SP₁₈ — Typed Extras", schema: SP18_TYPED_EXTRAS },
	// Family E — Sum & union
	{ id: "pi-prime-19", name: "SP₁₉ — Untagged Union", schema: SP19_UNTAGGED_UNION },
	{ id: "pi-prime-20", name: "SP₂₀ — Discriminated Union", schema: SP20_DISCRIMINATED_UNION },
	{ id: "pi-prime-21", name: "SP₂₁ — Shape-Discriminated Union", schema: SP21_SHAPE_DISCRIMINATED },
	{ id: "pi-prime-22", name: "SP₂₂ — Exhaustive Union", schema: SP22_EXHAUSTIVE_UNION },
	// Family F — Intersection
	{ id: "pi-prime-23", name: "SP₂₃ — Record-Merge Intersection", schema: SP23_RECORD_MERGE },
	{
		id: "pi-prime-24",
		name: "SP₂₄ — Refinement Intersection",
		schema: SP24_REFINEMENT_INTERSECTION,
	},
	// Family G — Recursion
	{ id: "pi-prime-25", name: "SP₂₅ — Direct Recursion", schema: SP25_DIRECT_RECURSION },
	{ id: "pi-prime-26", name: "SP₂₆ — Mutual Recursion", schema: SP26_MUTUAL_RECURSION },
	{ id: "pi-prime-27", name: "SP₂₇ — Recursive Generic", schema: SP27_RECURSIVE_GENERIC },
	// Family H — Parametricity & HKT
	{ id: "pi-prime-28", name: "SP₂₈ — Rank-1 Generics", schema: SP28_RANK1_GENERICS },
	{ id: "pi-prime-29", name: "SP₂₉ — Bounded Generics", schema: SP29_BOUNDED_GENERICS },
	{ id: "pi-prime-30", name: "SP₃₀ — Generic Default", schema: SP30_GENERIC_DEFAULT },
	{ id: "pi-prime-31", name: "SP₃₁ — Higher-Rank Polymorphism", schema: SP31_HIGHER_RANK },
	{ id: "pi-prime-32", name: "SP₃₂ — Higher-Kinded Type", schema: SP32_HKT },
	{ id: "pi-prime-33", name: "SP₃₃ — Variance Annotation", schema: SP33_VARIANCE },
	// Family I — Nominal & branding
	{ id: "pi-prime-34", name: "SP₃₄ — Structural Identity", schema: SP34_STRUCTURAL },
	{ id: "pi-prime-35", name: "SP₃₅ — Nominal Tag", schema: SP35_NOMINAL_TAG },
	{ id: "pi-prime-36", name: "SP₃₆ — Opaque / Newtype", schema: SP36_OPAQUE },
	{ id: "pi-prime-37", name: "SP₃₇ — Explicit Coercion", schema: SP37_COERCION },
	// Family J — Refinement & predicates
	{ id: "pi-prime-38", name: "SP₃₈ — Range Constraint", schema: SP38_RANGE },
	{ id: "pi-prime-39", name: "SP₃₉ — Pattern Constraint", schema: SP39_PATTERN },
	{ id: "pi-prime-40", name: "SP₄₀ — MultipleOf Constraint", schema: SP40_MULTIPLE_OF },
	{ id: "pi-prime-41", name: "SP₄₁ — Compound Predicate", schema: SP41_COMPOUND },
	{ id: "pi-prime-68", name: "SP₆₈ — String Concatenation", schema: SP68_STRING_CONCAT },
	{
		id: "pi-prime-69",
		name: "SP₆₉ — String Pattern Decomposition",
		schema: SP69_STRING_DECOMPOSITION,
	},
	// Family K — Value dependency
	{ id: "pi-prime-42", name: "SP₄₂ — Tagged Dependent Choice", schema: SP42_TAGGED_DEPENDENT },
	{ id: "pi-prime-43", name: "SP₄₃ — Cross-Field Constraint", schema: SP43_CROSS_FIELD },
	{ id: "pi-prime-44", name: "SP₄₄ — Foreign Key Constraint", schema: SP44_FOREIGN_KEY },
	{ id: "pi-prime-67", name: "SP₆₇ — Path-Navigating Constraint", schema: SP67_PATH_CONSTRAINT },
	// Family L — Collection types
	{ id: "pi-prime-45", name: "SP₄₅ — Array", schema: SP45_ARRAY },
	{ id: "pi-prime-46", name: "SP₄₆ — Set", schema: SP46_SET },
	{ id: "pi-prime-47", name: "SP₄₇ — Map", schema: SP47_MAP },
	// Family M — Computation types
	{ id: "pi-prime-48", name: "SP₄₈ — Arrow / Function", schema: SP48_ARROW },
	{ id: "pi-prime-49", name: "SP₄₉ — Overloaded Function", schema: SP49_OVERLOADED },
	// Family N — Modularity & scoping
	{ id: "pi-prime-50", name: "SP₅₀ — Named Type Alias", schema: SP50_TYPE_ALIAS },
	{ id: "pi-prime-51", name: "SP₅₁ — Module / Namespace", schema: SP51_MODULE },
	{ id: "pi-prime-52", name: "SP₅₂ — Visibility / Export", schema: SP52_VISIBILITY },
	// Family O — Evolution & compat
	{ id: "pi-prime-53", name: "SP₅₃ — Deprecation", schema: SP53_DEPRECATED },
	{ id: "pi-prime-54", name: "SP₅₄ — Versioned Schema", schema: SP54_VERSIONED },
	{ id: "pi-prime-55", name: "SP₅₅ — Backward Compatibility", schema: SP55_BACKWARD_COMPAT },
	// Family P — Meta-annotation
	{ id: "pi-prime-56", name: "SP₅₆ — Description", schema: SP56_DESCRIPTION },
	{ id: "pi-prime-57", name: "SP₅₇ — Examples", schema: SP57_EXAMPLES },
	{ id: "pi-prime-58", name: "SP₅₈ — Custom Metadata", schema: SP58_CUSTOM_META },
	// Family Q — Type-level negation
	{ id: "pi-prime-59", name: "SP₅₉ — Complement", schema: SP59_COMPLEMENT },
	// Family R — Unsound / bivariant
	{ id: "pi-prime-60", name: "SP₆₀ — Bivariant Position", schema: SP60_BIVARIANT },
	// Family S — Phantom & indexed
	{ id: "pi-prime-61", name: "SP₆₁ — Phantom Type Parameter", schema: SP61_PHANTOM },
	{ id: "pi-prime-62", name: "SP₆₂ — GADT / Indexed Type", schema: SP62_GADT },
	// Family T — Type-level computation
	{ id: "pi-prime-63", name: "SP₆₃ — Key Enumeration", schema: SP63_KEYOF },
	{ id: "pi-prime-64", name: "SP₆₄ — Mapped Type", schema: SP64_MAPPED },
	{ id: "pi-prime-65", name: "SP₆₅ — Conditional Type", schema: SP65_CONDITIONAL },
	// Family U — Row polymorphism
	{ id: "pi-prime-66", name: "SP₆₆ — Row-Polymorphic Record", schema: SP66_ROW_POLY },
	// Family V — Temporal / stateful
	{ id: "pi-prime-70", name: "SP₇₀ — State-Machine Type", schema: SP70_STATE_MACHINE },
] as const;

export {
	// Family A
	SP01_SYNTACTIC_BOTTOM,
	SP02_SEMANTIC_EMPTINESS,
	SP03_GLOBAL_TOP,
	SP04_SORT_RESTRICTED_TOP,
	SP05_SINGLETON_LITERAL,
	SP06_HOMO_ENUM,
	SP07_HETERO_ENUM,
	// Family B
	SP08_POSITIONAL_TUPLE,
	SP09_LABELLED_RECORD,
	SP10_VARIADIC_TUPLE,
	// Family C
	SP11_REQUIRED_FIELD,
	SP12_OPTIONAL_FIELD,
	SP13_NULLABLE_FIELD,
	SP14_DEFAULT_VALUE,
	SP15_READONLY_FIELD,
	// Family D
	SP16_CLOSED_RECORD,
	SP17_OPEN_RECORD,
	SP18_TYPED_EXTRAS,
	// Family E
	SP19_UNTAGGED_UNION,
	SP20_DISCRIMINATED_UNION,
	SP21_SHAPE_DISCRIMINATED,
	SP22_EXHAUSTIVE_UNION,
	// Family F
	SP23_RECORD_MERGE,
	SP24_REFINEMENT_INTERSECTION,
	// Family G
	SP25_DIRECT_RECURSION,
	SP26_MUTUAL_RECURSION,
	SP27_RECURSIVE_GENERIC,
	// Family H
	SP28_RANK1_GENERICS,
	SP29_BOUNDED_GENERICS,
	SP30_GENERIC_DEFAULT,
	SP31_HIGHER_RANK,
	SP32_HKT,
	SP33_VARIANCE,
	// Family I
	SP34_STRUCTURAL,
	SP35_NOMINAL_TAG,
	SP36_OPAQUE,
	SP37_COERCION,
	// Family J
	SP38_RANGE,
	SP39_PATTERN,
	SP40_MULTIPLE_OF,
	SP41_COMPOUND,
	SP68_STRING_CONCAT,
	SP69_STRING_DECOMPOSITION,
	// Family K
	SP42_TAGGED_DEPENDENT,
	SP43_CROSS_FIELD,
	SP44_FOREIGN_KEY,
	SP67_PATH_CONSTRAINT,
	// Family L
	SP45_ARRAY,
	SP46_SET,
	SP47_MAP,
	// Family M
	SP48_ARROW,
	SP49_OVERLOADED,
	// Family N
	SP50_TYPE_ALIAS,
	SP51_MODULE,
	SP52_VISIBILITY,
	// Family O
	SP53_DEPRECATED,
	SP54_VERSIONED,
	SP55_BACKWARD_COMPAT,
	// Family P
	SP56_DESCRIPTION,
	SP57_EXAMPLES,
	SP58_CUSTOM_META,
	// Family Q
	SP59_COMPLEMENT,
	// Family R
	SP60_BIVARIANT,
	// Family S
	SP61_PHANTOM,
	SP62_GADT,
	// Family T
	SP63_KEYOF,
	SP64_MAPPED,
	SP65_CONDITIONAL,
	// Family U
	SP66_ROW_POLY,
	// Family V
	SP70_STATE_MACHINE,
};
