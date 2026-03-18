// TypeTerm
// Define the central AST type for typecarta as a discriminated union of 16
// first-class node kinds plus an Extension escape hatch.
// Derive binding decisions from ADR-002 over Remark 3.2.1 and the full
// Π' criterion set.

// -- § 1  Annotations -- metadata attachable to any node --
/** Arbitrary metadata attachable to any node (covers all [meta-annot] criteria). */
export type Annotations = Readonly<Record<string, unknown>>;

// -- § 2  Variance -- variance annotations for type parameters --
/** Variance annotation for type parameters (π'₃₃). */
export type Variance = "covariant" | "contravariant" | "invariant" | "bivariant";

// -- § 3  Field Descriptor -- fields within product/record types --
/** Field within a product/record type. */
export interface FieldDescriptor {
	readonly name: string;
	readonly type: TypeTerm;
	readonly optional?: boolean;
	readonly readonly?: boolean;
	readonly defaultValue?: unknown;
	readonly annotations?: Annotations;
}

// -- § 4  Predicate -- decidable predicates for refinement types --
/** A decidable predicate over values, used in refinement types. */
export type RefinementPredicate =
	| {
			readonly kind: "range";
			readonly min?: number;
			readonly max?: number;
			readonly exclusive?: boolean;
	  }
	| { readonly kind: "pattern"; readonly regex: string }
	| { readonly kind: "multipleOf"; readonly divisor: number }
	| {
			readonly kind: "custom";
			readonly name: string;
			readonly params?: Readonly<Record<string, unknown>>;
	  }
	| {
			readonly kind: "and";
			readonly left: RefinementPredicate;
			readonly right: RefinementPredicate;
	  }
	| { readonly kind: "or"; readonly left: RefinementPredicate; readonly right: RefinementPredicate }
	| { readonly kind: "not"; readonly inner: RefinementPredicate };

// -- § 5  Constructor Identity -- well-known constructor names --
/** Well-known constructor names for Apply nodes. */
export type ConstructorName =
	| "product"
	| "union"
	| "intersection"
	| "array"
	| "set"
	| "map"
	| "arrow"
	| "tuple"
	| "concat"
	| (string & {});

// -- § 6  TypeTerm Node Kinds -- individual AST node interfaces --

/** Bottom type node — ⟦⊥⟧ = ∅. Primary witness: π₁. */
export interface BottomNode {
	readonly kind: "bottom";
	readonly annotations?: Annotations;
}

/** Top / universal type node — ⟦⊤⟧ = 𝒱. Primary witness: π₂. */
export interface TopNode {
	readonly kind: "top";
	readonly annotations?: Annotations;
}

/** Literal / singleton type node — |⟦S⟧| = 1. Primary witness: π₃. */
export interface LiteralNode {
	readonly kind: "literal";
	readonly value: string | number | boolean | null;
	readonly annotations?: Annotations;
}

/** Base type reference node (e.g. `string`, `number`). */
export interface BaseNode {
	readonly kind: "base";
	readonly name: string;
	readonly annotations?: Annotations;
}

/** Type variable reference node. */
export interface VarNode {
	readonly kind: "var";
	readonly name: string;
	readonly annotations?: Annotations;
}

/** Constructor application node — covers product, union, intersection, array, etc. */
export interface ApplyNode {
	readonly kind: "apply";
	readonly constructor: ConstructorName;
	readonly args: readonly TypeTerm[];
	/** For product/record constructors, structured field descriptors. */
	readonly fields?: readonly FieldDescriptor[];
	readonly annotations?: Annotations;
}

/** Universal quantifier node — Λα.τ (Def. 3.2 clause 3). Primary witness: π₉. */
export interface ForallNode {
	readonly kind: "forall";
	readonly var: string;
	readonly bound?: TypeTerm;
	readonly variance?: Variance;
	readonly default?: TypeTerm;
	readonly body: TypeTerm;
	readonly annotations?: Annotations;
}

/** Fixpoint / recursive type node — μα.F(α) (Remark 3.2.1). Primary witness: π₇. */
export interface MuNode {
	readonly kind: "mu";
	readonly var: string;
	readonly body: TypeTerm;
	readonly annotations?: Annotations;
}

/** Refinement type node — {v:τ | P(v)}. Primary witness: π₁₀. */
export interface RefinementNode {
	readonly kind: "refinement";
	readonly base: TypeTerm;
	readonly predicate: RefinementPredicate;
	readonly annotations?: Annotations;
}

/** Type-level complement node — ¬τ (Remark 3.2.1, π'₅₉). */
export interface ComplementNode {
	readonly kind: "complement";
	readonly inner: TypeTerm;
	readonly annotations?: Annotations;
}

/** Key enumeration node — keyof τ (Remark 3.2.1, π'₆₃). */
export interface KeyOfNode {
	readonly kind: "keyof";
	readonly inner: TypeTerm;
	readonly annotations?: Annotations;
}

/** Conditional type node — τ₁ extends τ₂ ? τ_A : τ_B (Remark 3.2.1, π'₆₅). */
export interface ConditionalNode {
	readonly kind: "conditional";
	readonly check: TypeTerm;
	readonly extends: TypeTerm;
	readonly then: TypeTerm;
	readonly else: TypeTerm;
	readonly annotations?: Annotations;
}

/** Mapped type node — {[K in S]: F(K, S[K])} (π'₆₄). */
export interface MappedNode {
	readonly kind: "mapped";
	readonly keySource: TypeTerm;
	readonly valueTransform: TypeTerm;
	readonly annotations?: Annotations;
}

/** Row-polymorphic record node — {fields | ρ} (π'₆₆). */
export interface RowPolyNode {
	readonly kind: "rowpoly";
	readonly fields: readonly FieldDescriptor[];
	readonly rowVar: string;
	readonly annotations?: Annotations;
}

/** Nominal / branded type node — nominal(Tag, τ). Primary witness: π₁₂. */
export interface NominalNode {
	readonly kind: "nominal";
	readonly tag: string;
	readonly inner: TypeTerm;
	readonly sealed: boolean;
	readonly annotations?: Annotations;
}

/** Let binding node — let n = τ in body (π'₅₀). */
export interface LetNode {
	readonly kind: "let";
	readonly name: string;
	readonly binding: TypeTerm;
	readonly body: TypeTerm;
	readonly annotations?: Annotations;
}

/** Adapter-specific extension node — opaque escape hatch for IR-specific constructs. */
export interface ExtensionNode {
	readonly kind: "extension";
	readonly extensionKind: string;
	readonly payload: unknown;
	readonly children?: readonly TypeTerm[];
	readonly annotations?: Annotations;
}

// -- § 7  TypeTerm Union -- discriminated union of all node kinds --

/** The central AST type — a discriminated union of all type-term node kinds. */
export type TypeTerm =
	| BottomNode
	| TopNode
	| LiteralNode
	| BaseNode
	| VarNode
	| ApplyNode
	| ForallNode
	| MuNode
	| RefinementNode
	| ComplementNode
	| KeyOfNode
	| ConditionalNode
	| MappedNode
	| RowPolyNode
	| NominalNode
	| LetNode
	| ExtensionNode;

// -- § 8  Kind Extraction -- utility types for kind-based dispatch --

/** Extract a specific node type by its kind discriminant. */
export type KindOf<K extends TypeTerm["kind"]> = Extract<TypeTerm, { kind: K }>;

/** All valid kind discriminants. */
export type TypeTermKind = TypeTerm["kind"];

/** Exhaustive visitor type — forces handling of every node kind. */
export type TypeTermVisitor<R> = {
	readonly [K in TypeTermKind]: (node: KindOf<K>) => R;
};

/** Partial visitor — only handle some node kinds. */
export type PartialVisitor<R> = {
	readonly [K in TypeTermKind]?: (node: KindOf<K>) => R;
};

// -- § 9  Type Guards -- runtime narrowing utilities --

/**
 * Determine whether an unknown value is a valid {@link TypeTerm}.
 * @param value - The value to test.
 * @returns `true` if `value` is a non-null object with a string `kind` property.
 */
export function isTypeTerm(value: unknown): value is TypeTerm {
	return (
		typeof value === "object" &&
		value !== null &&
		"kind" in value &&
		typeof (value as { kind: unknown }).kind === "string"
	);
}

/**
 * Narrow a {@link TypeTerm} to the node interface matching the given kind discriminant.
 * @param term - The term to narrow.
 * @param kind - The kind discriminant to match.
 * @returns `true` if `term.kind === kind`.
 */
export function isKind<K extends TypeTermKind>(term: TypeTerm, kind: K): term is KindOf<K> {
	return term.kind === kind;
}
