// Constructors
// Provide ergonomic, validated construction of TypeTerm AST nodes.
// Derived forms (per ADR-002) desugar into first-class nodes here.

import type {
	Annotations,
	ApplyNode,
	BaseNode,
	BottomNode,
	ComplementNode,
	ConditionalNode,
	ExtensionNode,
	FieldDescriptor,
	ForallNode,
	KeyOfNode,
	LetNode,
	LiteralNode,
	MappedNode,
	MuNode,
	NominalNode,
	RefinementNode,
	RefinementPredicate,
	RowPolyNode,
	TopNode,
	TypeTerm,
	VarNode,
	Variance,
} from "./type-term.js";

// -- § 1  First-class Constructors -- build first-class AST nodes --

/**
 * Create a bottom type (⊥) — the type with empty extension.
 * @param annotations - Optional metadata to attach.
 * @returns A {@link BottomNode}.
 */
export function bottom(annotations?: Annotations): BottomNode {
	return annotations ? { kind: "bottom", annotations } : { kind: "bottom" };
}

/**
 * Create a top type (⊤) — the type accepting all values.
 * @param annotations - Optional metadata to attach.
 * @returns A {@link TopNode}.
 */
export function top(annotations?: Annotations): TopNode {
	return annotations ? { kind: "top", annotations } : { kind: "top" };
}

/**
 * Create a literal / singleton type for a specific value.
 * @param value - The singleton value.
 * @param annotations - Optional metadata to attach.
 * @returns A {@link LiteralNode}.
 */
export function literal(
	value: string | number | boolean | null,
	annotations?: Annotations,
): LiteralNode {
	return annotations ? { kind: "literal", value, annotations } : { kind: "literal", value };
}

/**
 * Create a base type reference by name (e.g. "string", "number").
 * @param name - The base type name.
 * @param annotations - Optional metadata to attach.
 * @returns A {@link BaseNode}.
 */
export function base(name: string, annotations?: Annotations): BaseNode {
	return annotations ? { kind: "base", name, annotations } : { kind: "base", name };
}

/**
 * Create a type variable reference.
 * @param name - The variable name.
 * @param annotations - Optional metadata to attach.
 * @returns A {@link VarNode}.
 */
export function typeVar(name: string, annotations?: Annotations): VarNode {
	return annotations ? { kind: "var", name, annotations } : { kind: "var", name };
}

/**
 * Create a constructor application node.
 * @param constructor - The constructor name (e.g. "product", "union").
 * @param args - Positional type arguments.
 * @param fields - Optional structured field descriptors for record constructors.
 * @param annotations - Optional metadata to attach.
 * @returns An {@link ApplyNode}.
 */
export function apply(
	constructor: string,
	args: readonly TypeTerm[],
	fields?: readonly FieldDescriptor[],
	annotations?: Annotations,
): ApplyNode {
	const node: ApplyNode = { kind: "apply", constructor, args };
	const result: Record<string, unknown> = { ...node };
	if (fields) result.fields = fields;
	if (annotations) result.annotations = annotations;
	return result as unknown as ApplyNode;
}

/**
 * Create a universal quantifier (Λα.τ).
 * @param varName - The bound type variable name.
 * @param body - The quantified body.
 * @param options - Optional bound, variance, default, and annotations.
 * @returns A {@link ForallNode}.
 */
export function forall(
	varName: string,
	body: TypeTerm,
	options?: {
		bound?: TypeTerm;
		variance?: Variance;
		default?: TypeTerm;
		annotations?: Annotations;
	},
): ForallNode {
	const node: Record<string, unknown> = { kind: "forall", var: varName, body };
	if (options?.bound) node.bound = options.bound;
	if (options?.variance) node.variance = options.variance;
	if (options?.default) node.default = options.default;
	if (options?.annotations) node.annotations = options.annotations;
	return node as unknown as ForallNode;
}

/**
 * Create a fixpoint / recursive type (μα.F(α)).
 * @param varName - The recursion variable name.
 * @param body - The recursive body referencing `varName`.
 * @param annotations - Optional metadata to attach.
 * @returns A {@link MuNode}.
 */
export function mu(varName: string, body: TypeTerm, annotations?: Annotations): MuNode {
	return annotations
		? { kind: "mu", var: varName, body, annotations }
		: { kind: "mu", var: varName, body };
}

/**
 * Create a refinement type ({v:τ | P(v)}).
 * @param baseType - The base type to refine.
 * @param predicate - The decidable predicate constraining values.
 * @param annotations - Optional metadata to attach.
 * @returns A {@link RefinementNode}.
 */
export function refinement(
	baseType: TypeTerm,
	predicate: RefinementPredicate,
	annotations?: Annotations,
): RefinementNode {
	return annotations
		? { kind: "refinement", base: baseType, predicate, annotations }
		: { kind: "refinement", base: baseType, predicate };
}

/**
 * Create a type-level complement (¬τ).
 * @param inner - The type to negate.
 * @param annotations - Optional metadata to attach.
 * @returns A {@link ComplementNode}.
 */
export function complement(inner: TypeTerm, annotations?: Annotations): ComplementNode {
	return annotations ? { kind: "complement", inner, annotations } : { kind: "complement", inner };
}

/**
 * Create a key enumeration type (keyof τ).
 * @param inner - The type whose keys to enumerate.
 * @param annotations - Optional metadata to attach.
 * @returns A {@link KeyOfNode}.
 */
export function keyOf(inner: TypeTerm, annotations?: Annotations): KeyOfNode {
	return annotations ? { kind: "keyof", inner, annotations } : { kind: "keyof", inner };
}

/**
 * Create a conditional type (check extends target ? then : else).
 * @param check - The type to test.
 * @param extendsType - The constraint type.
 * @param thenType - The result when `check` extends `extendsType`.
 * @param elseType - The result otherwise.
 * @param annotations - Optional metadata to attach.
 * @returns A {@link ConditionalNode}.
 */
export function conditional(
	check: TypeTerm,
	extendsType: TypeTerm,
	thenType: TypeTerm,
	elseType: TypeTerm,
	annotations?: Annotations,
): ConditionalNode {
	return annotations
		? {
				kind: "conditional",
				check,
				extends: extendsType,
				then: thenType,
				else: elseType,
				annotations,
			}
		: { kind: "conditional", check, extends: extendsType, then: thenType, else: elseType };
}

/**
 * Create a mapped type ({[K in S]: F(K)}).
 * @param keySource - The type providing keys.
 * @param valueTransform - The type expression applied to each key.
 * @param annotations - Optional metadata to attach.
 * @returns A {@link MappedNode}.
 */
export function mapped(
	keySource: TypeTerm,
	valueTransform: TypeTerm,
	annotations?: Annotations,
): MappedNode {
	return annotations
		? { kind: "mapped", keySource, valueTransform, annotations }
		: { kind: "mapped", keySource, valueTransform };
}

/**
 * Create a row-polymorphic record type ({fields | ρ}).
 * @param fields - The known field descriptors.
 * @param rowVar - The row variable name representing unknown fields.
 * @param annotations - Optional metadata to attach.
 * @returns A {@link RowPolyNode}.
 */
export function rowPoly(
	fields: readonly FieldDescriptor[],
	rowVar: string,
	annotations?: Annotations,
): RowPolyNode {
	return annotations
		? { kind: "rowpoly", fields, rowVar, annotations }
		: { kind: "rowpoly", fields, rowVar };
}

/**
 * Create a nominal / branded type (nominal(tag, inner)).
 * @param tag - The brand tag name.
 * @param inner - The underlying structural type.
 * @param sealed - Whether the nominal type is opaque (default `false`).
 * @param annotations - Optional metadata to attach.
 * @returns A {@link NominalNode}.
 */
export function nominal(
	tag: string,
	inner: TypeTerm,
	sealed = false,
	annotations?: Annotations,
): NominalNode {
	return annotations
		? { kind: "nominal", tag, inner, sealed, annotations }
		: { kind: "nominal", tag, inner, sealed };
}

/**
 * Create a let binding (let name = binding in body).
 * @param name - The bound name.
 * @param binding - The type expression bound to `name`.
 * @param body - The body where `name` is in scope.
 * @param annotations - Optional metadata to attach.
 * @returns A {@link LetNode}.
 */
export function letBinding(
	name: string,
	binding: TypeTerm,
	body: TypeTerm,
	annotations?: Annotations,
): LetNode {
	return annotations
		? { kind: "let", name, binding, body, annotations }
		: { kind: "let", name, binding, body };
}

/**
 * Create an adapter-specific extension node.
 * @param extensionKind - The extension discriminant string.
 * @param payload - Opaque data for the extension.
 * @param children - Optional child type terms.
 * @param annotations - Optional metadata to attach.
 * @returns An {@link ExtensionNode}.
 */
export function extension(
	extensionKind: string,
	payload: unknown,
	children?: readonly TypeTerm[],
	annotations?: Annotations,
): ExtensionNode {
	const node: Record<string, unknown> = { kind: "extension", extensionKind, payload };
	if (children) node.children = children;
	if (annotations) node.annotations = annotations;
	return node as unknown as ExtensionNode;
}

// -- § 2  Derived-form Constructors -- sugar over apply() --

/**
 * Create a product / record type with named fields.
 * @param fields - The field descriptors.
 * @param annotations - Optional metadata to attach.
 * @returns An {@link ApplyNode} with constructor `"product"`.
 */
export function product(fields: readonly FieldDescriptor[], annotations?: Annotations): ApplyNode {
	return apply("product", [], fields, annotations);
}

/**
 * Create a union / sum type from branches.
 * @param branches - The union member types.
 * @param annotations - Optional metadata to attach.
 * @returns An {@link ApplyNode} with constructor `"union"`.
 */
export function union(branches: readonly TypeTerm[], annotations?: Annotations): ApplyNode {
	return apply("union", branches, undefined, annotations);
}

/**
 * Create an intersection type from members.
 * @param members - The intersection member types.
 * @param annotations - Optional metadata to attach.
 * @returns An {@link ApplyNode} with constructor `"intersection"`.
 */
export function intersection(members: readonly TypeTerm[], annotations?: Annotations): ApplyNode {
	return apply("intersection", members, undefined, annotations);
}

/**
 * Create a homogeneous array type (τ[]).
 * @param element - The element type.
 * @param annotations - Optional metadata to attach.
 * @returns An {@link ApplyNode} with constructor `"array"`.
 */
export function array(element: TypeTerm, annotations?: Annotations): ApplyNode {
	return apply("array", [element], undefined, annotations);
}

/**
 * Create a set / unique collection type.
 * @param element - The element type.
 * @param annotations - Optional metadata to attach.
 * @returns An {@link ApplyNode} with constructor `"set"`.
 */
export function set(element: TypeTerm, annotations?: Annotations): ApplyNode {
	return apply("set", [element], undefined, annotations);
}

/**
 * Create a map / dictionary type (key → value).
 * @param key - The key type.
 * @param value - The value type.
 * @param annotations - Optional metadata to attach.
 * @returns An {@link ApplyNode} with constructor `"map"`.
 */
export function map(key: TypeTerm, value: TypeTerm, annotations?: Annotations): ApplyNode {
	return apply("map", [key, value], undefined, annotations);
}

/**
 * Create a function / arrow type ((params) => return).
 * @param params - The parameter types.
 * @param returnType - The return type.
 * @param annotations - Optional metadata to attach.
 * @returns An {@link ApplyNode} with constructor `"arrow"`.
 */
export function arrow(
	params: readonly TypeTerm[],
	returnType: TypeTerm,
	annotations?: Annotations,
): ApplyNode {
	return apply("arrow", [...params, returnType], undefined, annotations);
}

/**
 * Create a positional tuple type ([τ₁, τ₂, ...]).
 * @param elements - The positional element types.
 * @param annotations - Optional metadata to attach.
 * @returns An {@link ApplyNode} with constructor `"tuple"`.
 */
export function tuple(elements: readonly TypeTerm[], annotations?: Annotations): ApplyNode {
	return apply("tuple", elements, undefined, annotations);
}

/**
 * Create a template literal / string concatenation type.
 * @param parts - The concatenation segments.
 * @param annotations - Optional metadata to attach.
 * @returns An {@link ApplyNode} with constructor `"concat"`.
 */
export function templateLiteral(parts: readonly TypeTerm[], annotations?: Annotations): ApplyNode {
	return apply("concat", parts, undefined, annotations);
}

/**
 * Create a field descriptor for product types.
 * @param name - The field name.
 * @param type - The field's type.
 * @param options - Optional flags for optional, readonly, defaultValue, and annotations.
 * @returns A {@link FieldDescriptor}.
 */
export function field(
	name: string,
	type: TypeTerm,
	options?: {
		optional?: boolean;
		readonly?: boolean;
		defaultValue?: unknown;
		annotations?: Annotations;
	},
): FieldDescriptor {
	const f: Record<string, unknown> = { name, type };
	if (options?.optional) f.optional = true;
	if (options?.readonly) f.readonly = true;
	if (options?.defaultValue !== undefined) f.defaultValue = options.defaultValue;
	if (options?.annotations) f.annotations = options.annotations;
	return f as unknown as FieldDescriptor;
}

// -- § 3  Predicate Constructors -- build refinement predicates --

/**
 * Create a range/bound refinement predicate (min ≤ v ≤ max).
 * @param min - Optional lower bound.
 * @param max - Optional upper bound.
 * @param exclusive - Whether bounds are exclusive.
 * @returns A {@link RefinementPredicate} with kind `"range"`.
 */
export function rangeConstraint(
	min?: number,
	max?: number,
	exclusive?: boolean,
): RefinementPredicate {
	const result: Record<string, unknown> = { kind: "range" };
	if (min !== undefined) result.min = min;
	if (max !== undefined) result.max = max;
	if (exclusive !== undefined) result.exclusive = exclusive;
	return result as unknown as RefinementPredicate;
}

/**
 * Create a regex pattern refinement predicate.
 * @param regex - The regular expression pattern string.
 * @returns A {@link RefinementPredicate} with kind `"pattern"`.
 */
export function patternConstraint(regex: string): RefinementPredicate {
	return { kind: "pattern", regex };
}

/**
 * Create a divisibility refinement predicate (v mod d = 0).
 * @param divisor - The divisor that values must be a multiple of.
 * @returns A {@link RefinementPredicate} with kind `"multipleOf"`.
 */
export function multipleOfConstraint(divisor: number): RefinementPredicate {
	return { kind: "multipleOf", divisor };
}

/**
 * Create a conjunction of two refinement predicates.
 * @param left - The left operand.
 * @param right - The right operand.
 * @returns A {@link RefinementPredicate} with kind `"and"`.
 */
export function andPredicate(
	left: RefinementPredicate,
	right: RefinementPredicate,
): RefinementPredicate {
	return { kind: "and", left, right };
}

/**
 * Create a disjunction of two refinement predicates.
 * @param left - The left operand.
 * @param right - The right operand.
 * @returns A {@link RefinementPredicate} with kind `"or"`.
 */
export function orPredicate(
	left: RefinementPredicate,
	right: RefinementPredicate,
): RefinementPredicate {
	return { kind: "or", left, right };
}

/**
 * Create a negation of a refinement predicate.
 * @param inner - The predicate to negate.
 * @returns A {@link RefinementPredicate} with kind `"not"`.
 */
export function notPredicate(inner: RefinementPredicate): RefinementPredicate {
	return { kind: "not", inner };
}
