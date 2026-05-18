// LinkML adapter.
//
// LinkML (Linked Data Modeling Language) is a Python-first modeling
// language with a class-based metamodel. A LinkML schema declares:
//
//   - types       Primitive value-domain types (built-in + user-defined).
//   - classes     Record types with named slots; support is_a + mixins.
//   - slots       Reusable field definitions with range / required / multivalued.
//   - enums       Permissible-value enumerations, optionally with URIs.
//   - subsets     Tagged groupings of schema elements.
//   - rules       Per-class XPath-like predicates over instances.
//   - imports     Cross-schema composition.
//
// This adapter models the LinkML surface as plain-object descriptors
// (not the actual YAML library); a downstream tool can serialize a
// {@link LinkmlSchema} to YAML if needed.
//
// Vendored canonical spec sources: vendor/specs/linkml/.
//   - meta.yaml is the metamodel in LinkML form (the highest-fidelity
//     source).
//   - schemas-*.html are the rendered prose docs for each major
//     construct (slots, inheritance, constraints, enums, …).
//
// The IR encoding follows the conventions established by the XSD adapter:
//   - schema-level imports/targetNamespace → extension("module", …).
//   - is_a + mixins → record-merge intersection (product ∩ product).
//   - abstract → extension("visibility", { level: "abstract" }, …).
//   - rules → extension("xsd-assert", { test }, …) — same convention
//     1.1's XSD adapter uses, so cross-language scorecard rows are
//     comparable.
//   - permissible_value.meaning (URI) → nominal(meaning, literal(value)).

import type { IRAdapter, RefinementPredicate, Signature, TypeTerm } from "@typecarta/core";
import {
	andPredicate,
	array,
	base,
	bottom,
	createSignature,
	extension,
	field,
	letBinding,
	literal,
	nominal,
	patternConstraint,
	product,
	rangeConstraint,
	refinement,
	top,
	union,
} from "@typecarta/core";

// ─── Built-in datatypes ─────────────────────────────────────────────

/**
 * LinkML built-in datatype names (the contents of the
 * `linkml:types` schema). The set below covers the commonly used
 * standard types. Users may declare additional types via the
 * `types` section of a schema.
 */
export type LinkmlBuiltinName =
	| "string"
	| "integer"
	| "boolean"
	| "float"
	| "double"
	| "decimal"
	| "time"
	| "date"
	| "datetime"
	| "date_or_datetime"
	| "uriorcurie"
	| "curie"
	| "uri"
	| "ncname"
	| "objectidentifier"
	| "nodeidentifier"
	| "jsonpointer"
	| "jsonpath"
	| "sparqlpath";

export const LINKML_BUILTIN_NAMES: readonly LinkmlBuiltinName[] = [
	"string",
	"integer",
	"boolean",
	"float",
	"double",
	"decimal",
	"time",
	"date",
	"datetime",
	"date_or_datetime",
	"uriorcurie",
	"curie",
	"uri",
	"ncname",
	"objectidentifier",
	"nodeidentifier",
	"jsonpointer",
	"jsonpath",
	"sparqlpath",
];

const LINKML_BUILTIN_NAME_SET: ReadonlySet<string> = new Set(LINKML_BUILTIN_NAMES);

// ─── Descriptor types ───────────────────────────────────────────────

/** LinkML common metadata applied to most schema elements. */
export interface LinkmlMetadata {
	readonly description?: string;
	readonly title?: string;
	readonly aliases?: readonly string[];
	readonly in_subset?: readonly string[];
	readonly deprecated?: string;
	readonly comments?: readonly string[];
	readonly see_also?: readonly string[];
}

/** LinkML user-defined type (`types.<name>`). */
export interface LinkmlType extends LinkmlMetadata {
	readonly name: string;
	/** The built-in type this user-defined type derives from. */
	readonly typeof?: LinkmlBuiltinName;
	/** Alternative spelling: some schemas use `base` instead of `typeof`. */
	readonly base?: LinkmlBuiltinName;
	readonly pattern?: string;
	readonly minimum_value?: number;
	readonly maximum_value?: number;
	readonly uri?: string;
}

/** LinkML slot definition (`slots.<name>` or `class.attributes.<name>`). */
export interface LinkmlSlot extends LinkmlMetadata {
	readonly name: string;
	/** The range — a class name, enum name, type name, or builtin. */
	readonly range?: string;
	readonly required?: boolean;
	readonly multivalued?: boolean;
	readonly inlined?: boolean;
	readonly inlined_as_list?: boolean;
	readonly pattern?: string;
	readonly minimum_value?: number;
	readonly maximum_value?: number;
	readonly identifier?: boolean;
	readonly key?: boolean;
	readonly slot_uri?: string;
}

/** LinkML rule — XPath-like predicate over instances of a class. */
export interface LinkmlRule extends LinkmlMetadata {
	readonly preconditions?: unknown;
	readonly postconditions?: unknown;
	/**
	 * A literal XPath / boolean expression. The adapter passes it
	 * through to xs:assert-equivalent encoding so cross-language
	 * scorecard rows for pi-prime-43 are comparable.
	 */
	readonly expression?: string;
}

/** LinkML class definition (`classes.<name>`). */
export interface LinkmlClass extends LinkmlMetadata {
	readonly name: string;
	/** Parent class name (single inheritance via `is_a`). */
	readonly is_a?: string;
	/** Mixin class names (multiple inheritance via `mixins`). */
	readonly mixins?: readonly string[];
	/** Inlined slot definitions ("attributes" in LinkML). */
	readonly attributes?: Readonly<Record<string, LinkmlSlot>>;
	/** Slot names referencing the schema-level `slots:` section. */
	readonly slots?: readonly string[];
	/** Per-slot overrides for inherited slots. */
	readonly slot_usage?: Readonly<Record<string, Partial<LinkmlSlot>>>;
	readonly abstract?: boolean;
	readonly mixin?: boolean;
	readonly tree_root?: boolean;
	readonly class_uri?: string;
	readonly rules?: readonly LinkmlRule[];
}

/** A single permissible value within an enum. */
export interface LinkmlPermissibleValue extends LinkmlMetadata {
	readonly text: string;
	/** A URI giving the semantic meaning of this permissible value. */
	readonly meaning?: string;
}

/** LinkML enum definition (`enums.<name>`). */
export interface LinkmlEnum extends LinkmlMetadata {
	readonly name: string;
	readonly permissible_values: Readonly<Record<string, LinkmlPermissibleValue>>;
	readonly enum_uri?: string;
}

/** LinkML schema — the top-level descriptor. */
export interface LinkmlSchema {
	readonly kind: "schema";
	readonly id: string;
	readonly name: string;
	readonly title?: string;
	readonly description?: string;
	readonly version?: string;
	readonly prefixes?: Readonly<Record<string, string>>;
	readonly default_prefix?: string;
	readonly imports?: readonly string[];
	readonly types?: Readonly<Record<string, LinkmlType>>;
	readonly classes?: Readonly<Record<string, LinkmlClass>>;
	readonly slots?: Readonly<Record<string, LinkmlSlot>>;
	readonly enums?: Readonly<Record<string, LinkmlEnum>>;
	readonly subsets?: Readonly<Record<string, LinkmlMetadata>>;
}

/**
 * A LinkML descriptor — either a whole schema, a single class/enum/type,
 * or a primitive-name reference. Lets parse/encode operate on either
 * granularity. The `kind` discriminant is mandatory on every variant.
 */
export type LinkmlDescriptor =
	| LinkmlSchema
	| { readonly kind: "type-ref"; readonly name: string }
	| { readonly kind: "builtin"; readonly name: LinkmlBuiltinName }
	| ({ readonly kind: "class" } & LinkmlClass)
	| ({ readonly kind: "type" } & LinkmlType)
	| ({ readonly kind: "enum" } & LinkmlEnum);

// ─── Signature ──────────────────────────────────────────────────────

const LINKML_SUPPORTED_KINDS: ReadonlySet<TypeTerm["kind"]> = new Set([
	"bottom",
	"top",
	"literal",
	"base",
	"apply",
	"refinement",
	"nominal", // → class_uri / slot_uri / permissible-value meaning
	"let", // → named class / type alias
	"extension", // → module / visibility / xsd-assert (rules) / foreign-key (key slots)
] satisfies readonly TypeTerm["kind"][]);

const LINKML_SIGNATURE: Signature = createSignature(
	LINKML_BUILTIN_NAMES as readonly string[],
	[
		{ name: "product", arity: 1 },
		{ name: "array", arity: 1 },
		{ name: "union", arity: 2 },
		{ name: "intersection", arity: 2 },
	],
);

// ─── Adapter class ──────────────────────────────────────────────────

/** Adapt LinkML schema descriptors to and from the typecarta IR. */
export class LinkmlAdapter implements IRAdapter<Signature, LinkmlDescriptor> {
	readonly name = "LinkML";
	readonly specVersion = "1.11";
	readonly signature = LINKML_SIGNATURE;

	parse(source: LinkmlDescriptor): TypeTerm {
		return parseDescriptor(source);
	}

	encode(term: TypeTerm): LinkmlDescriptor {
		return encodeToDescriptor(term);
	}

	isEncodable(term: TypeTerm): boolean {
		try {
			this.encode(term);
			return true;
		} catch {
			return false;
		}
	}

	supportsKind(kind: TypeTerm["kind"]): boolean {
		return LINKML_SUPPORTED_KINDS.has(kind);
	}

	inhabits(value: unknown, term: TypeTerm): boolean {
		return checkInhabitation(value, term);
	}
}

// ─── Parse ──────────────────────────────────────────────────────────

function parseDescriptor(desc: LinkmlDescriptor): TypeTerm {
	switch (desc.kind) {
		case "builtin":
			return base(desc.name);
		case "type-ref":
			return nominal(desc.name, top());
		case "type":
			return parseType(desc);
		case "class":
			return parseClass(desc, undefined);
		case "enum":
			return parseEnum(desc);
		case "schema":
			return parseSchema(desc);
	}
}

function parseSchema(schema: LinkmlSchema): TypeTerm {
	// Collect all classes as named bindings; the schema itself becomes an
	// extension("module", …) wrapping them. If there's a tree_root class,
	// the schema's "value" is that class; otherwise the schema is a bag.
	const classes = Object.values(schema.classes ?? {});
	const enums = Object.values(schema.enums ?? {});
	const types = Object.values(schema.types ?? {});

	const treeRoot = classes.find((c) => c.tree_root === true);
	const inner: TypeTerm = treeRoot ? parseClass(treeRoot, schema) : top();

	const payload: Record<string, unknown> = {
		name: schema.name,
		...(schema.id !== undefined ? { targetNamespace: schema.id } : {}),
		...(schema.imports !== undefined ? { imports: schema.imports } : {}),
		...(schema.description !== undefined ? { documentation: schema.description } : {}),
	};
	if (types.length > 0) payload.types = types.map((t) => t.name);
	if (enums.length > 0) payload.enums = enums.map((e) => e.name);
	if (classes.length > 0) payload.classes = classes.map((c) => c.name);
	return extension("module", payload, [inner]);
}

function parseClass(c: LinkmlClass, schema: LinkmlSchema | undefined): TypeTerm {
	const slotsByName = new Map<string, LinkmlSlot>();
	// Inlined attributes win over schema-level slot definitions.
	for (const [name, s] of Object.entries(c.attributes ?? {})) {
		slotsByName.set(name, { ...s, name });
	}
	for (const slotName of c.slots ?? []) {
		if (slotsByName.has(slotName)) continue;
		const def = schema?.slots?.[slotName];
		slotsByName.set(slotName, def !== undefined ? def : { name: slotName });
	}
	// Apply slot_usage overrides.
	for (const [name, override] of Object.entries(c.slot_usage ?? {})) {
		const existing = slotsByName.get(name);
		slotsByName.set(name, { ...(existing ?? { name }), ...override, name });
	}

	const fields = [...slotsByName.values()].map((s) => parseSlot(s, schema));
	const annotations: Record<string, unknown> = {};
	if (c.description !== undefined) annotations.documentation = c.description;
	if (c.abstract === true) annotations.abstract = true;
	if (c.mixin === true) annotations.mixin = true;
	if (c.in_subset !== undefined) annotations.in_subset = c.in_subset;

	let body: TypeTerm =
		Object.keys(annotations).length > 0 ? product(fields, annotations) : product(fields);

	// is_a + mixins → record-merge intersection. We represent parents and
	// mixins by their nominal names; resolution is a separate pass that
	// downstream tooling may run if it has the schema in scope.
	const parents: TypeTerm[] = [];
	if (c.is_a !== undefined) parents.push(nominal(c.is_a, top()));
	for (const m of c.mixins ?? []) parents.push(nominal(m, top()));
	if (parents.length > 0) {
		body = parents.reduce<TypeTerm>(
			(acc, parent) => ({
				kind: "apply",
				constructor: "intersection",
				args: [acc, parent],
			}),
			body,
		);
	}

	// Rules → xsd-assert extensions (cross-language scorecard parity).
	for (const r of c.rules ?? []) {
		if (r.expression !== undefined) {
			body = extension("xsd-assert", { test: r.expression }, [body]);
		}
	}

	// abstract → visibility extension (matches XSD adapter).
	if (c.abstract === true) {
		body = extension("visibility", { level: "abstract" }, [body]);
	}

	// class_uri → nominal wrapper.
	if (c.class_uri !== undefined) {
		body = nominal(c.class_uri, body);
	}

	return letBinding(c.name, body, base(c.name));
}

function parseSlot(slot: LinkmlSlot, schema: LinkmlSchema | undefined): ReturnType<typeof field> {
	const rangeTerm = resolveRange(slot.range, schema);
	const refined = applySlotFacets(rangeTerm, slot);
	const arrayed = slot.multivalued === true ? array(refined) : refined;
	const annotations: Record<string, unknown> = {};
	if (slot.description !== undefined) annotations.documentation = slot.description;
	if (slot.slot_uri !== undefined) annotations.slot_uri = slot.slot_uri;
	if (slot.identifier === true || slot.key === true) annotations.key = true;
	if (slot.inlined === true) annotations.inlined = true;
	if (slot.inlined_as_list === true) annotations.inlined_as_list = true;

	return field(slot.name, arrayed, {
		...(slot.required === true ? {} : { optional: true }),
		...(Object.keys(annotations).length > 0 ? { annotations } : {}),
	});
}

function resolveRange(rangeName: string | undefined, schema: LinkmlSchema | undefined): TypeTerm {
	if (rangeName === undefined) return base("string"); // LinkML default
	if (LINKML_BUILTIN_NAME_SET.has(rangeName)) return base(rangeName);
	if (schema?.types?.[rangeName] !== undefined) {
		return parseType(schema.types[rangeName]);
	}
	if (schema?.enums?.[rangeName] !== undefined) {
		return parseEnum(schema.enums[rangeName]);
	}
	return nominal(rangeName, top());
}

function applySlotFacets(baseTerm: TypeTerm, slot: LinkmlSlot): TypeTerm {
	const predicates: RefinementPredicate[] = [];
	if (slot.pattern !== undefined) predicates.push(patternConstraint(slot.pattern));
	if (slot.minimum_value !== undefined || slot.maximum_value !== undefined) {
		predicates.push(rangeConstraint(slot.minimum_value, slot.maximum_value));
	}
	if (predicates.length === 0) return baseTerm;
	const combined = predicates.reduce((acc, p) => andPredicate(acc, p));
	return refinement(baseTerm, combined);
}

function parseType(t: LinkmlType): TypeTerm {
	const builtin = t.typeof ?? t.base ?? "string";
	let inner: TypeTerm = base(builtin);
	const predicates: RefinementPredicate[] = [];
	if (t.pattern !== undefined) predicates.push(patternConstraint(t.pattern));
	if (t.minimum_value !== undefined || t.maximum_value !== undefined) {
		predicates.push(rangeConstraint(t.minimum_value, t.maximum_value));
	}
	if (predicates.length > 0) {
		const combined = predicates.reduce((acc, p) => andPredicate(acc, p));
		inner = refinement(inner, combined);
	}
	if (t.uri !== undefined) inner = nominal(t.uri, inner);
	return letBinding(t.name, inner, base(t.name));
}

function parseEnum(e: LinkmlEnum): TypeTerm {
	const values = Object.values(e.permissible_values);
	if (values.length === 0) return letBinding(e.name, bottom(), base(e.name));
	const literals: TypeTerm[] = values.map((pv) => {
		const lit = literal(pv.text);
		// permissible_value.meaning (URI) → nominal wrapper around the literal.
		return pv.meaning !== undefined ? nominal(pv.meaning, lit) : lit;
	});
	const body: TypeTerm = literals.length === 1 ? literals[0]! : union(literals);
	const wrapped = e.enum_uri !== undefined ? nominal(e.enum_uri, body) : body;
	return letBinding(e.name, wrapped, base(e.name));
}

// ─── Encode ─────────────────────────────────────────────────────────

function encodeToDescriptor(term: TypeTerm): LinkmlDescriptor {
	switch (term.kind) {
		case "bottom":
			// LinkML has no explicit empty type; encode as an enum with no
			// permissible_values, which is uninhabited.
			return { kind: "enum", name: "Bottom", permissible_values: {} };
		case "top":
			return { kind: "builtin", name: "string" };
		case "literal":
			return encodeLiteral(term);
		case "base":
			return encodeBase(term.name);
		case "apply":
			return encodeApply(term);
		case "refinement":
			return encodeRefinement(term);
		case "nominal":
			return encodeNominal(term);
		case "let":
			return encodeLet(term);
		case "extension":
			return encodeExtension(term);
		default:
			throw new Error(`Cannot encode ${term.kind} to LinkML`);
	}
}

function encodeLiteral(term: Extract<TypeTerm, { kind: "literal" }>): LinkmlDescriptor {
	if (term.value === null) {
		throw new Error("Cannot encode literal(null) to LinkML — null is not a LinkML value");
	}
	const text = String(term.value);
	return {
		kind: "enum",
		name: `Lit_${text.replace(/[^A-Za-z0-9_]/g, "_")}`,
		permissible_values: { [text]: { text } },
	};
}

function encodeBase(name: string): LinkmlDescriptor {
	if (name === "number") return { kind: "builtin", name: "decimal" };
	if (name === "null") {
		throw new Error('Cannot encode base("null") to LinkML — null is not a LinkML type');
	}
	if (LINKML_BUILTIN_NAME_SET.has(name)) {
		return { kind: "builtin", name: name as LinkmlBuiltinName };
	}
	throw new Error(`Cannot encode base type "${name}" to LinkML`);
}

function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): LinkmlDescriptor {
	switch (term.constructor) {
		case "product":
			return encodeProduct(term);
		case "array":
		case "set":
			throw new Error(
				`Cannot encode bare ${term.constructor}(...) to LinkML — wrap in a slot via multivalued=true`,
			);
		case "union":
			return encodeUnion(term);
		case "intersection":
			return encodeIntersection(term);
		case "map":
			throw new Error(
				"Cannot encode map to LinkML — LinkML has no map primitive. " +
					"Model as a class with a key-typed slot.",
			);
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to LinkML`);
	}
}

function encodeUnion(term: Extract<TypeTerm, { kind: "apply" }>): LinkmlDescriptor {
	// A union of literals is a LinkML enum — the canonical encoding.
	const allLiterals = term.args.every((a) => a.kind === "literal");
	if (allLiterals && term.args.length > 0) {
		const permissible_values: Record<string, LinkmlPermissibleValue> = {};
		for (const a of term.args) {
			if (a.kind !== "literal") continue;
			const text = String(a.value);
			permissible_values[text] = { text };
		}
		return {
			kind: "enum",
			name: "AnonymousEnum",
			permissible_values,
		};
	}
	// A union whose arms are all `nominal(_, literal)` (i.e. semantic enum
	// values with URIs) → enum with meanings.
	const allMeaningfulLiterals = term.args.every(
		(a) => a.kind === "nominal" && a.inner.kind === "literal",
	);
	if (allMeaningfulLiterals && term.args.length > 0) {
		const permissible_values: Record<string, LinkmlPermissibleValue> = {};
		for (const a of term.args) {
			if (a.kind !== "nominal" || a.inner.kind !== "literal") continue;
			const text = String(a.inner.value);
			permissible_values[text] = { text, meaning: a.tag };
		}
		return {
			kind: "enum",
			name: "AnonymousEnum",
			permissible_values,
		};
	}
	throw new Error(
		"Cannot encode bare union(...) to LinkML — supported shapes: " +
			"union of literals (→ enum), union of nominal(literal) (→ enum with meanings). " +
			"For other shapes wrap in a slot's any_of.",
	);
}

function encodeProduct(term: Extract<TypeTerm, { kind: "apply" }>): LinkmlDescriptor {
	const annotations = (term.annotations ?? {}) as Record<string, unknown>;
	const attributes: Record<string, LinkmlSlot> = {};
	for (const f of term.fields ?? []) {
		attributes[f.name] = fieldToSlot(f);
	}
	return {
		kind: "class",
		name: "AnonymousClass",
		attributes,
		...(typeof annotations.documentation === "string"
			? { description: annotations.documentation }
			: {}),
		...(annotations.abstract === true ? { abstract: true } : {}),
		...(annotations.mixin === true ? { mixin: true } : {}),
	};
}

function fieldToSlot(f: {
	readonly name: string;
	readonly type: TypeTerm;
	readonly optional?: boolean;
	readonly annotations?: Record<string, unknown>;
}): LinkmlSlot {
	const annotations = (f.annotations ?? {}) as Record<string, unknown>;
	let typeTerm = f.type;
	let multivalued = false;
	if (typeTerm.kind === "apply" && typeTerm.constructor === "array") {
		multivalued = true;
		typeTerm = typeTerm.args[0]!;
	}
	const range = rangeNameForTerm(typeTerm);
	return {
		name: f.name,
		...(range !== undefined ? { range } : {}),
		...(f.optional === true ? {} : { required: true }),
		...(multivalued ? { multivalued: true } : {}),
		...extractSlotFacets(typeTerm),
		...(typeof annotations.documentation === "string"
			? { description: annotations.documentation }
			: {}),
		...(typeof annotations.slot_uri === "string" ? { slot_uri: annotations.slot_uri } : {}),
		...(annotations.key === true ? { identifier: true } : {}),
		...(annotations.inlined === true ? { inlined: true } : {}),
		...(annotations.inlined_as_list === true ? { inlined_as_list: true } : {}),
	};
}

function rangeNameForTerm(t: TypeTerm): string | undefined {
	if (t.kind === "base") return t.name;
	if (t.kind === "nominal") return t.tag;
	if (t.kind === "refinement") return rangeNameForTerm(t.base);
	if (t.kind === "let") return t.name;
	return undefined;
}

function extractSlotFacets(t: TypeTerm): Partial<LinkmlSlot> {
	if (t.kind !== "refinement") return {};
	return predicateToSlotFacets(t.predicate);
}

function predicateToSlotFacets(predicate: RefinementPredicate): Partial<LinkmlSlot> {
	switch (predicate.kind) {
		case "range":
			return {
				...(predicate.min !== undefined ? { minimum_value: predicate.min } : {}),
				...(predicate.max !== undefined ? { maximum_value: predicate.max } : {}),
			};
		case "pattern":
			return { pattern: predicate.regex };
		case "multipleOf":
			throw new Error(
				"Cannot encode multipleOfConstraint to LinkML — LinkML has no multipleOf primitive",
			);
		case "and":
			return {
				...predicateToSlotFacets(predicate.left),
				...predicateToSlotFacets(predicate.right),
			};
		case "or":
		case "not":
		case "custom":
			throw new Error(
				`Cannot encode predicate "${predicate.kind}" to LinkML — slot facets are conjunctive only`,
			);
		default:
			return {};
	}
}

function encodeIntersection(term: Extract<TypeTerm, { kind: "apply" }>): LinkmlDescriptor {
	const args = term.args;
	if (args.length === 2) {
		const [a, b] = args;
		if (a === undefined || b === undefined) {
			throw new Error("Cannot encode intersection with missing arguments to LinkML");
		}
		// product ∩ product → merge fields into a single class.
		if (isRecord(a) && isRecord(b)) {
			return encodeProduct(mergeFields(a, b));
		}
		// product ∩ nominal(parent) → class with is_a.
		if (isRecord(a) && b.kind === "nominal") {
			const productDesc = encodeProduct(a);
			if (productDesc.kind === "class") return { ...productDesc, is_a: b.tag };
		}
		if (a.kind === "nominal" && isRecord(b)) {
			const productDesc = encodeProduct(b);
			if (productDesc.kind === "class") return { ...productDesc, is_a: a.tag };
		}
		// refinement ∩ refinement → merged type with combined facets.
		if (a.kind === "refinement" && b.kind === "refinement") {
			return encodeRefinement({
				kind: "refinement",
				base: a.base,
				predicate: andPredicate(a.predicate, b.predicate),
			});
		}
		// base ∩ refinement(base) → encode just the refinement (SP24 shape).
		if (a.kind === "base" && b.kind === "refinement") return encodeRefinement(b);
		if (b.kind === "base" && a.kind === "refinement") return encodeRefinement(a);
	}
	throw new Error(
		"Cannot encode intersection to LinkML — supported shapes: " +
			"product ∩ product (merge attributes), product ∩ nominal (is_a), " +
			"refinement ∩ refinement (combined facets), base ∩ refinement (facets)",
	);
}

function isRecord(t: TypeTerm): t is Extract<TypeTerm, { kind: "apply" }> {
	return t.kind === "apply" && t.constructor === "product";
}

function mergeFields(
	a: Extract<TypeTerm, { kind: "apply" }>,
	b: Extract<TypeTerm, { kind: "apply" }>,
): Extract<TypeTerm, { kind: "apply" }> {
	type Field = NonNullable<typeof a.fields>[number];
	const seen = new Set<string>();
	const aFields: readonly Field[] = a.fields ?? [];
	const bFields: readonly Field[] = b.fields ?? [];
	const merged: Field[] = [];
	for (const f of [...aFields, ...bFields]) {
		if (seen.has(f.name)) continue;
		seen.add(f.name);
		merged.push(f);
	}
	return { ...a, fields: merged };
}

function encodeRefinement(term: Extract<TypeTerm, { kind: "refinement" }>): LinkmlDescriptor {
	const inner = encodeToDescriptor(term.base);
	if (inner.kind !== "builtin" && inner.kind !== "type") {
		throw new Error("Cannot encode refinement over non-atomic LinkML base");
	}
	const baseBuiltin = inner.kind === "builtin" ? inner.name : (inner.typeof ?? "string");
	return {
		kind: "type",
		name: "AnonymousType",
		typeof: baseBuiltin,
		...predicateToTypeFacets(term.predicate),
	};
}

function predicateToTypeFacets(predicate: RefinementPredicate): Partial<LinkmlType> {
	switch (predicate.kind) {
		case "range":
			return {
				...(predicate.min !== undefined ? { minimum_value: predicate.min } : {}),
				...(predicate.max !== undefined ? { maximum_value: predicate.max } : {}),
			};
		case "pattern":
			return { pattern: predicate.regex };
		case "multipleOf":
			throw new Error(
				"Cannot encode multipleOfConstraint to LinkML — LinkML has no multipleOf primitive",
			);
		case "and":
			return {
				...predicateToTypeFacets(predicate.left),
				...predicateToTypeFacets(predicate.right),
			};
		case "or":
		case "not":
		case "custom":
			throw new Error(
				`Cannot encode predicate "${predicate.kind}" to LinkML — type facets are conjunctive only`,
			);
		default:
			return {};
	}
}

function encodeNominal(term: Extract<TypeTerm, { kind: "nominal" }>): LinkmlDescriptor {
	const inner = encodeToDescriptor(term.inner);
	if (inner.kind === "class") {
		return { ...inner, name: term.tag, class_uri: term.tag };
	}
	if (inner.kind === "type") {
		return { ...inner, name: term.tag, uri: term.tag };
	}
	if (inner.kind === "enum") {
		return { ...inner, name: term.tag, enum_uri: term.tag };
	}
	if (inner.kind === "builtin") {
		return {
			kind: "type",
			name: term.tag,
			typeof: inner.name,
			uri: term.tag,
		};
	}
	return {
		kind: "type",
		name: term.tag,
		typeof: "string",
		uri: term.tag,
	};
}

function encodeLet(term: Extract<TypeTerm, { kind: "let" }>): LinkmlDescriptor {
	const inner = encodeToDescriptor(term.binding);
	if (inner.kind === "class") return { ...inner, name: term.name };
	if (inner.kind === "type") return { ...inner, name: term.name };
	if (inner.kind === "enum") return { ...inner, name: term.name };
	if (inner.kind === "builtin") {
		return { kind: "type", name: term.name, typeof: inner.name };
	}
	throw new Error(`Cannot encode let-binding "${term.name}" over ${term.binding.kind} to LinkML`);
}

function encodeExtension(
	term: Extract<TypeTerm, { kind: "extension" }>,
): LinkmlDescriptor {
	switch (term.extensionKind) {
		case "module":
			return encodeModule(term);
		case "visibility":
			return encodeVisibility(term);
		case "xsd-assert":
			return encodeAssertion(term);
		case "foreign-key":
		case "path-constraint":
		case "xsd-extends":
			if (term.children && term.children.length > 0) {
				return encodeToDescriptor(term.children[0]!);
			}
			throw new Error(`Extension "${term.extensionKind}" requires a child term`);
		default:
			throw new Error(`Cannot encode extension "${term.extensionKind}" to LinkML`);
	}
}

function encodeModule(term: Extract<TypeTerm, { kind: "extension" }>): LinkmlDescriptor {
	const payload = (term.payload ?? {}) as {
		readonly name?: string;
		readonly targetNamespace?: string;
		readonly imports?: readonly string[];
		readonly documentation?: string;
	};
	const child = term.children?.[0];
	const schema: LinkmlSchema = {
		kind: "schema",
		id: payload.targetNamespace ?? `urn:typecarta:${payload.name ?? "anonymous"}`,
		name: payload.name ?? "anonymous",
		...(payload.documentation !== undefined ? { description: payload.documentation } : {}),
		...(payload.imports !== undefined ? { imports: payload.imports } : {}),
	};
	if (child !== undefined) {
		const childDesc = encodeToDescriptor(child);
		if (childDesc.kind === "class") {
			return { ...schema, classes: { [childDesc.name]: childDesc } };
		}
		if (childDesc.kind === "type") {
			return { ...schema, types: { [childDesc.name]: childDesc } };
		}
		if (childDesc.kind === "enum") {
			return { ...schema, enums: { [childDesc.name]: childDesc } };
		}
	}
	return schema;
}

function encodeVisibility(
	term: Extract<TypeTerm, { kind: "extension" }>,
): LinkmlDescriptor {
	const payload = (term.payload ?? {}) as { readonly level?: string };
	const child = term.children?.[0];
	if (child === undefined) throw new Error("visibility extension requires a child term");
	const inner = encodeToDescriptor(child);
	if (inner.kind !== "class") return inner;
	if (payload.level === "abstract") return { ...inner, abstract: true };
	if (payload.level === "mixin") return { ...inner, mixin: true };
	return inner;
}

function encodeAssertion(
	term: Extract<TypeTerm, { kind: "extension" }>,
): LinkmlDescriptor {
	const payload = (term.payload ?? {}) as { readonly test?: string };
	const child = term.children?.[0];
	if (child === undefined) throw new Error("xsd-assert extension requires a child term");
	const inner = encodeToDescriptor(child);
	if (inner.kind !== "class") return inner;
	if (payload.test === undefined) return inner;
	const existing = inner.rules ?? [];
	return {
		...inner,
		rules: [...existing, { expression: payload.test }],
	};
}

// ─── Inhabitation ───────────────────────────────────────────────────

function checkInhabitation(value: unknown, term: TypeTerm): boolean {
	switch (term.kind) {
		case "bottom":
			return false;
		case "top":
			return true;
		case "literal":
			return value === term.value;
		case "base":
			return checkBaseInhabitation(value, term.name);
		case "apply":
			return checkApplyInhabitation(value, term);
		case "refinement":
			return (
				checkInhabitation(value, term.base) &&
				checkPredicateInhabitation(value, term.predicate)
			);
		case "nominal":
			return checkInhabitation(value, term.inner);
		case "let":
			// In LinkML the `letBinding(name, structural, base(name))` pattern
			// names a class/type/enum — the structural body lives in `binding`,
			// and `body` is the reference back. For inhabits in a
			// closed-world check (no resolution table) follow `binding`.
			return checkInhabitation(value, term.binding);
		case "extension": {
			const inner = term.children?.[0];
			return inner !== undefined ? checkInhabitation(value, inner) : true;
		}
		default:
			return false;
	}
}

function checkBaseInhabitation(value: unknown, name: string): boolean {
	switch (name) {
		case "string":
		case "time":
		case "date":
		case "datetime":
		case "date_or_datetime":
		case "uriorcurie":
		case "curie":
		case "uri":
		case "ncname":
		case "objectidentifier":
		case "nodeidentifier":
		case "jsonpointer":
		case "jsonpath":
		case "sparqlpath":
			return typeof value === "string";
		case "boolean":
			return typeof value === "boolean";
		case "integer":
			return typeof value === "number" && Number.isInteger(value);
		case "float":
		case "double":
		case "decimal":
		case "number":
			return typeof value === "number";
		default:
			return false;
	}
}

function checkApplyInhabitation(
	value: unknown,
	term: Extract<TypeTerm, { kind: "apply" }>,
): boolean {
	switch (term.constructor) {
		case "product": {
			if (typeof value !== "object" || value === null) return false;
			const obj = value as Record<string, unknown>;
			for (const f of term.fields ?? []) {
				if (!f.optional && !(f.name in obj)) return false;
				if (f.name in obj && !checkInhabitation(obj[f.name], f.type)) return false;
			}
			return true;
		}
		case "array":
		case "set": {
			const elementType = term.args[0];
			if (!Array.isArray(value) || elementType === undefined) return false;
			if (term.constructor === "set" && new Set(value).size !== value.length) return false;
			return value.every((item) => checkInhabitation(item, elementType));
		}
		case "union":
			return term.args.some((arg) => checkInhabitation(value, arg));
		case "intersection":
			return term.args.every((arg) => checkInhabitation(value, arg));
		default:
			return false;
	}
}

function checkPredicateInhabitation(value: unknown, predicate: RefinementPredicate): boolean {
	switch (predicate.kind) {
		case "range":
			if (typeof value !== "number") return false;
			if (predicate.exclusive === true) {
				if (predicate.min !== undefined && value <= predicate.min) return false;
				if (predicate.max !== undefined && value >= predicate.max) return false;
			} else {
				if (predicate.min !== undefined && value < predicate.min) return false;
				if (predicate.max !== undefined && value > predicate.max) return false;
			}
			return true;
		case "pattern":
			return typeof value === "string" && new RegExp(predicate.regex).test(value);
		case "multipleOf":
			return typeof value === "number" && value % predicate.divisor === 0;
		case "and":
			return (
				checkPredicateInhabitation(value, predicate.left) &&
				checkPredicateInhabitation(value, predicate.right)
			);
		case "or":
			return (
				checkPredicateInhabitation(value, predicate.left) ||
				checkPredicateInhabitation(value, predicate.right)
			);
		case "not":
			return !checkPredicateInhabitation(value, predicate.inner);
		case "custom":
			return true;
		default:
			return true;
	}
}
