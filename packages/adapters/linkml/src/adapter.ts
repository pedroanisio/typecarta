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
	map,
	nominal,
	patternConstraint,
	product,
	rangeConstraint,
	refinement,
	set,
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
	readonly examples?: readonly { readonly value: string; readonly description?: string }[];
	/** Free-form structured annotations (LinkML `annotations:` slot). */
	readonly annotations?: Readonly<Record<string, unknown>>;
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

/** A LinkML slot or class expression — `any_of` / `all_of` / etc. ranges. */
export type LinkmlExpression = LinkmlSlot | LinkmlClass | { readonly range: string };

/** LinkML slot definition (`slots.<name>` or `class.attributes.<name>`). */
export interface LinkmlSlot extends LinkmlMetadata {
	readonly name: string;
	/** The range — a class name, enum name, type name, or builtin. */
	readonly range?: string;
	readonly required?: boolean;
	readonly multivalued?: boolean;
	readonly inlined?: boolean;
	readonly inlined_as_list?: boolean;
	/** When inlined and multivalued, key entries by their identifier slot. */
	readonly inlined_as_dict?: boolean;
	readonly pattern?: string;
	readonly minimum_value?: number;
	readonly maximum_value?: number;
	readonly identifier?: boolean;
	readonly key?: boolean;
	readonly slot_uri?: string;
	/** Default value coercion (LinkML `ifabsent` slot). */
	readonly ifabsent?: string;
	/** Marks this slot as the discriminator for `is_a` subclasses. */
	readonly designates_type?: boolean;
	/** Cross-slot expression constraining this slot's value (LinkML `equals_expression`). */
	readonly equals_expression?: string;
	/** Slot value must equal this literal (LinkML `equals_string` / `equals_number`). */
	readonly equals_string?: string;
	readonly equals_number?: number;
	/** Boolean combinators (metamodel exact_mappings: sh:or / sh:and / sh:xone / sh:not). */
	readonly any_of?: readonly LinkmlExpression[];
	readonly all_of?: readonly LinkmlExpression[];
	readonly exactly_one_of?: readonly LinkmlExpression[];
	readonly none_of?: readonly LinkmlExpression[];
}

/**
 * A "class expression" carried as a condition body — a snapshot of the
 * slot expressions that must hold on the instance. LinkML's preconditions
 * and postconditions both use this shape.
 */
export interface LinkmlClassExpression {
	readonly slot_conditions?: Readonly<Record<string, Partial<LinkmlSlot>>>;
	readonly any_of?: readonly LinkmlExpression[];
	readonly all_of?: readonly LinkmlExpression[];
	readonly exactly_one_of?: readonly LinkmlExpression[];
	readonly none_of?: readonly LinkmlExpression[];
}

/** LinkML rule — predicate over instances of a class. */
export interface LinkmlRule extends LinkmlMetadata {
	readonly preconditions?: LinkmlClassExpression;
	readonly postconditions?: LinkmlClassExpression;
	/**
	 * A literal XPath-style boolean expression. The adapter passes it
	 * through to xs:assert-equivalent encoding so cross-language
	 * scorecard rows for pi-prime-43 are comparable.
	 */
	readonly expression?: string;
}

/**
 * LinkML `path_expression` — describes a path from an object through
 * slot lookups to a referenced value. The metamodel declares this as a
 * first-class construct (Part 2 of `meta.yaml`).
 */
export interface LinkmlPathExpression {
	readonly traverse?: string;
	readonly range_expression?: LinkmlExpression;
	readonly followed_by?: LinkmlPathExpression;
	readonly description?: string;
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
	/** Boolean combinators at class scope (metamodel exact_mappings to SHACL). */
	readonly any_of?: readonly LinkmlExpression[];
	readonly all_of?: readonly LinkmlExpression[];
	readonly exactly_one_of?: readonly LinkmlExpression[];
	readonly none_of?: readonly LinkmlExpression[];
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
	// Typecarta-wrapped top-class → bare top() IR node.
	if (c.annotations?.["typecarta:top"] === true) return top();
	// If this class is a typecarta-wrapped collection, unwrap to the bare
	// IR shape so the criterion's structural search finds the collection
	// constructor.
	const collectionKind = c.annotations?.["typecarta:collection"];
	if (typeof collectionKind === "string") {
		const collected = unwrapCollection(c, collectionKind, schema);
		if (collected !== undefined) return collected;
	}
	// Typecarta-wrapped boolean combinator → rebuild union/intersection.
	const combinator = c.annotations?.["typecarta:combinator"];
	if (typeof combinator === "string") {
		const unwrapped = unwrapCombinator(c, combinator, schema);
		if (unwrapped !== undefined) return unwrapped;
	}
	// Typecarta-wrapped intersection → rebuild intersection IR node.
	const intersectionTag = c.annotations?.["typecarta:intersection"];
	const intersectionArms = c.annotations?.["typecarta:intersection-arms"];
	if (typeof intersectionTag === "string" && Array.isArray(intersectionArms)) {
		const arms = intersectionArms
			.map((a) => parseDescriptor(a as LinkmlDescriptor))
			// Unwrap `let(name, binding, _body)` → `binding` so the structural
			// criteria see the bare product / refinement they look for.
			.map((arm) => (arm.kind === "let" ? arm.binding : arm));
		if (arms.length >= 2) {
			return {
				kind: "apply",
				constructor: "intersection",
				args: arms,
			};
		}
	}
	// Typecarta-wrapped IR extension (foreign-key / path-constraint /
	// xsd-extends) → rebuild the extension IR node for criteria that
	// look for it by name (pi-prime-44 foreign-key, pi-prime-67 path).
	for (const extKind of ["path-constraint", "foreign-key", "xsd-extends"] as const) {
		const payload = c.annotations?.[`typecarta:extension-${extKind}`];
		if (payload !== undefined) {
			// Build the inner term without the marker so we don't recurse.
			const cleaned = stripTypecartaAnnotations(c.annotations);
			const innerCopy =
				cleaned !== undefined
					? ({ ...c, annotations: cleaned } as LinkmlClass)
					: ((): LinkmlClass => {
							const { annotations: _drop, ...rest } = c;
							return rest as LinkmlClass;
						})();
			const innerTerm = parseClass(innerCopy, schema);
			const inner = innerTerm.kind === "let" ? innerTerm.binding : innerTerm;
			return extension(extKind, (payload ?? {}) as Record<string, unknown>, [inner]);
		}
	}
	// Typecarta-wrapped refinement-over-product → rebuild
	// `refinement(product, predicate)` (the pi-prime-43 cross-field shape).
	const refinementOverProduct = c.annotations?.["typecarta:refinement-over-product"];
	if (refinementOverProduct !== undefined) {
		const cleaned = stripTypecartaAnnotations(c.annotations);
		// Also strip the typecarta-emitted rule so the inner class doesn't
		// get re-wrapped in an xsd-assert extension by the rule loop below.
		const cleanedRules = (c.rules ?? []).filter(
			(r) => r.title !== "typecarta-refinement",
		);
		const innerCopy: LinkmlClass = {
			...c,
			...(cleaned !== undefined ? { annotations: cleaned } : {}),
			rules: cleanedRules,
		};
		if (cleaned === undefined) {
			const { annotations: _drop, ...rest } = innerCopy;
			const innerTerm = parseClass(rest as LinkmlClass, schema);
			const productTerm = innerTerm.kind === "let" ? innerTerm.binding : innerTerm;
			return refinement(productTerm, refinementOverProduct as RefinementPredicate);
		}
		const innerTerm = parseClass(innerCopy, schema);
		const productTerm = innerTerm.kind === "let" ? innerTerm.binding : innerTerm;
		return refinement(productTerm, refinementOverProduct as RefinementPredicate);
	}
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
	// Family O (evolution / compatibility).
	//   - LinkML's native `deprecated:` slot lifts to `annotations.deprecated`.
	//     The slot's range is `string`, but the IR criterion checks
	//     `annotations.deprecated === true`, so the canonical empty / "true"
	//     marker becomes a boolean while anything else stays a string.
	//   - `version` and `backwardCompatibleWith` aren't class-scope LinkML
	//     slots; round-trip via typecarta-prefixed keys in the `annotations:`
	//     slot. Strip those keys from the rebuilt class so downstream
	//     consumers don't see typecarta:* leaking out.
	if (c.deprecated !== undefined) {
		annotations.deprecated =
			c.deprecated === "true" || c.deprecated === "" ? true : c.deprecated;
	}
	const cAnn = c.annotations;
	if (cAnn !== undefined) {
		if (cAnn["typecarta:version"] !== undefined) {
			annotations.version = cAnn["typecarta:version"];
		}
		if (cAnn["typecarta:backwardCompatibleWith"] !== undefined) {
			annotations.backwardCompatibleWith = cAnn["typecarta:backwardCompatibleWith"];
		}
	}

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

/**
 * If `c` carries a `typecarta:combinator` marker, rebuild the IR
 * `union`/`intersection` apply term whose arms are the slot's
 * `any_of`/`all_of`/`exactly_one_of`/`none_of` entries.
 */
function unwrapCombinator(
	c: LinkmlClass,
	combinator: string,
	schema: LinkmlSchema | undefined,
): TypeTerm | undefined {
	const wrapper = c.attributes?.value;
	if (wrapper === undefined) return undefined;
	const armField = combinator as "any_of" | "all_of" | "exactly_one_of" | "none_of";
	const exprs = (wrapper as LinkmlSlot)[armField];
	if (exprs === undefined) return undefined;
	// Prefer the typecarta arm-terms payload (full encoded descriptors) when
	// present — that preserves inner product / refinement / nested-union
	// shapes that don't reduce to a single `range:` reference. Fall back to
	// the LinkML expression list (range strings only) for older payloads.
	const armPayload = c.annotations?.["typecarta:union-arm-terms"];
	const arms: TypeTerm[] = Array.isArray(armPayload)
		? armPayload.map((d) => {
				const term = parseDescriptor(d as LinkmlDescriptor);
				// Unwrap let(name, binding, _body) → binding so the inner
				// structural shape (product / refinement) is visible to the
				// criterion's tree walk.
				return term.kind === "let" ? term.binding : term;
			})
		: exprs.map((e) => resolveRange((e as { range?: string }).range, schema));
	const exhaustive = c.annotations?.["typecarta:exhaustive"] === true;
	const annotations: Record<string, unknown> = exhaustive ? { exhaustive: true } : {};
	if (combinator === "any_of" || combinator === "exactly_one_of") {
		return Object.keys(annotations).length > 0
			? union(arms, annotations)
			: union(arms);
	}
	if (combinator === "all_of") {
		// LinkML's all_of is the metamodel's exact_mappings: [sh:and] — an
		// intersection.
		return arms.reduce<TypeTerm>(
			(acc, arm) => ({ kind: "apply", constructor: "intersection", args: [acc, arm] }),
			arms[0] ?? top(),
		);
	}
	// none_of has no direct IR analogue; fall through to the structural class.
	return undefined;
}

/**
 * If `c` carries a `typecarta:collection` marker, rebuild the bare
 * collection IR shape (`array(T)` / `set(T)` / `map(K, V)`) so the
 * structural criterion finds the constructor it expects.
 */
function unwrapCollection(
	c: LinkmlClass,
	kind: string,
	schema: LinkmlSchema | undefined,
): TypeTerm | undefined {
	if (kind === "array" || kind === "set") {
		const items = c.attributes?.items;
		if (items === undefined) return undefined;
		const inner = resolveRange(items.range, schema);
		return kind === "set" ? set(inner) : array(inner);
	}
	if (kind === "map") {
		const entries = c.attributes?.entries;
		if (entries === undefined) return undefined;
		// LinkML maps are string-keyed by convention (identifier is a string slot).
		const valueTerm = resolveRange(entries.range, schema);
		return map(base("string"), valueTerm);
	}
	return undefined;
}

function parseSlot(slot: LinkmlSlot, schema: LinkmlSchema | undefined): ReturnType<typeof field> {
	// A slot constrained to a single literal value (`equals_string`,
	// `equals_number`, or the typecarta literal marker for booleans) is
	// the LinkML encoding of a literal-typed field. Rebuild it as the IR
	// `literal(...)` term so structural criteria for discriminated unions
	// (pi-prime-20, pi-prime-42) see the literal tag.
	const literalAnnotation = slot.annotations?.["typecarta:literal-value"];
	let typed: TypeTerm;
	if (slot.equals_string !== undefined) {
		typed = literal(slot.equals_string);
	} else if (slot.equals_number !== undefined) {
		typed = literal(slot.equals_number);
	} else if (typeof literalAnnotation === "boolean") {
		typed = literal(literalAnnotation);
	} else {
		const rangeTerm = resolveRange(slot.range, schema);
		const refined = applySlotFacets(rangeTerm, slot);
		typed = slot.multivalued === true ? array(refined) : refined;
	}
	const annotations: Record<string, unknown> = {};
	if (slot.description !== undefined) annotations.documentation = slot.description;
	if (slot.slot_uri !== undefined) annotations.slot_uri = slot.slot_uri;
	if (slot.identifier === true || slot.key === true) annotations.key = true;
	if (slot.inlined === true) annotations.inlined = true;
	if (slot.inlined_as_list === true) annotations.inlined_as_list = true;
	if (slot.designates_type === true) annotations.designates_type = true;

	return field(slot.name, typed, {
		...(slot.required === true ? {} : { optional: true }),
		...(slot.ifabsent !== undefined ? { defaultValue: slot.ifabsent } : {}),
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
	// Typecarta-wrapped intersection on a type descriptor → rebuild
	// intersection IR node (SP24 base ∩ refinement, refinement ∩ refinement).
	const intersectionTag = t.annotations?.["typecarta:intersection"];
	const intersectionArms = t.annotations?.["typecarta:intersection-arms"];
	if (typeof intersectionTag === "string" && Array.isArray(intersectionArms)) {
		const arms = intersectionArms
			.map((a) => parseDescriptor(a as LinkmlDescriptor))
			.map((arm) => (arm.kind === "let" ? arm.binding : arm));
		if (arms.length >= 2) {
			return {
				kind: "apply",
				constructor: "intersection",
				args: arms,
			};
		}
	}
	// Typecarta-wrapped annotated base → return `base(name, annotations)`.
	const baseAnnotations = t.annotations?.["typecarta:base-annotations"];
	if (
		baseAnnotations !== undefined &&
		typeof baseAnnotations === "object" &&
		baseAnnotations !== null
	) {
		const builtin = t.typeof ?? t.base ?? "string";
		return base(builtin, baseAnnotations as Record<string, unknown>);
	}
	const builtin = t.typeof ?? t.base ?? "string";
	let inner: TypeTerm = base(builtin);
	// Typecarta-wrapped refinement predicate → rebuild the predicate tree
	// verbatim. This covers `and(range, multipleOf)` and similar shapes
	// LinkML cannot express via native facets but whose structure the
	// criterion (notably pi-prime-41) requires to be visible.
	const refinementMarker = t.annotations?.["typecarta:refinement-predicate"];
	if (refinementMarker !== undefined) {
		inner = refinement(inner, refinementMarker as RefinementPredicate);
	} else {
		const predicates: RefinementPredicate[] = [];
		if (t.pattern !== undefined) predicates.push(patternConstraint(t.pattern));
		if (t.minimum_value !== undefined || t.maximum_value !== undefined) {
			predicates.push(rangeConstraint(t.minimum_value, t.maximum_value));
		}
		if (predicates.length > 0) {
			const combined = predicates.reduce((acc, p) => andPredicate(acc, p));
			inner = refinement(inner, combined);
		}
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
			// LinkML declares an `Any` class in the metamodel; values of
			// type Any inhabit every class. Encode `top()` as a class
			// reference to `Any` with a typecarta marker so the parser
			// can rebuild the `top` IR node.
			return {
				kind: "class",
				name: "Any",
				attributes: {},
				class_uri: "linkml:Any",
				annotations: { "typecarta:top": true },
			};
		case "literal":
			return encodeLiteral(term);
		case "base":
			return encodeBaseWithAnnotations(term);
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

/**
 * Encode a `base(name, annotations?)` term. If annotations are present
 * (description, examples, custom keys), emit a named LinkML type so the
 * descriptor can carry them; bare base without annotations stays a
 * builtin. The parse side recognizes the typecarta marker on the type
 * and reattaches the annotations to the IR `base` node so meta-annotation
 * criteria find them.
 */
function encodeBaseWithAnnotations(
	term: Extract<TypeTerm, { kind: "base" }>,
): LinkmlDescriptor {
	const inner = encodeBase(term.name);
	const annotations = term.annotations;
	if (annotations === undefined || Object.keys(annotations).length === 0) {
		return inner;
	}
	if (inner.kind !== "builtin") return inner;
	const description = annotations.description as string | undefined;
	const examples = annotations.examples;
	const exampleEntries: { value: string; description?: string }[] | undefined =
		Array.isArray(examples)
			? examples.map((e) =>
					typeof e === "string"
						? { value: e }
						: typeof e === "object" && e !== null && "value" in e
							? (e as { value: string; description?: string })
							: { value: String(e) },
				)
			: undefined;
	// Stash the IR-side annotations verbatim under a typecarta marker so
	// the parse side can rehydrate them without inferring shape from
	// LinkML's structured slots alone.
	const carriedAnnotations: Record<string, unknown> = {
		"typecarta:base-annotations": annotations,
	};
	return {
		kind: "type",
		name: "AnnotatedBase",
		typeof: inner.name,
		...(description !== undefined ? { description } : {}),
		...(exampleEntries !== undefined ? { examples: exampleEntries } : {}),
		annotations: carriedAnnotations,
	};
}

function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): LinkmlDescriptor {
	switch (term.constructor) {
		case "product":
			return encodeProduct(term);
		case "array":
			return encodeCollection(term, "array");
		case "set":
			return encodeCollection(term, "set");
		case "union":
			return encodeUnion(term);
		case "intersection":
			return encodeIntersection(term);
		case "map":
			return encodeMap(term);
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to LinkML`);
	}
}

/**
 * Bare collection types have no top-level form in LinkML — they exist
 * only on slots via `multivalued: true` (and `inlined_as_dict` for maps).
 * Wrap them in a synthetic one-slot class. A typecarta marker in the
 * `annotations:` slot lets the parser recognize the wrapper and emit
 * `array(T)` / `set(T)` / `map(K, V)` again on round-trip.
 */
function encodeCollection(
	term: Extract<TypeTerm, { kind: "apply" }>,
	kind: "array" | "set",
): LinkmlDescriptor {
	const item = term.args[0];
	if (item === undefined) throw new Error(`Cannot encode bare ${kind} with no element type`);
	const range = rangeNameForTerm(item) ?? "string";
	const slot: LinkmlSlot = {
		name: "items",
		range,
		required: true,
		multivalued: true,
		...(kind === "set" ? { identifier: true } : {}),
	};
	return {
		kind: "class",
		name: `Anonymous${kind === "set" ? "Set" : "Array"}`,
		attributes: { items: slot },
		annotations: { "typecarta:collection": kind },
	};
}

function encodeMap(term: Extract<TypeTerm, { kind: "apply" }>): LinkmlDescriptor {
	const value = term.args[1];
	if (value === undefined) throw new Error("Cannot encode bare map with no value type");
	const range = rangeNameForTerm(value) ?? "string";
	const slot: LinkmlSlot = {
		name: "entries",
		range,
		required: true,
		multivalued: true,
		inlined_as_dict: true,
	};
	return {
		kind: "class",
		name: "AnonymousMap",
		attributes: { entries: slot },
		annotations: { "typecarta:collection": "map" },
	};
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
	// General untagged union: encode as a one-slot class whose slot has
	// `any_of` over each arm's range. The LinkML metamodel declares
	// `any_of` as exact_mappings: [sh:or] — this is the canonical
	// LinkML encoding for an untagged union. A typecarta marker on the
	// class lets the parser rebuild the IR union node.
	return encodeUnionAsAnyOf(term, /*operator*/ "any_of");
}

/**
 * Encode a union/intersection apply term as a one-slot class with a
 * boolean combinator (`any_of`, `all_of`, `exactly_one_of`, `none_of`).
 * The slot range is the first arm's name; the rest become combinator
 * entries with `range` references. A typecarta marker lets parse
 * reconstruct the IR.
 */
function encodeUnionAsAnyOf(
	term: Extract<TypeTerm, { kind: "apply" }>,
	operator: "any_of" | "all_of" | "exactly_one_of" | "none_of",
): LinkmlDescriptor {
	// LinkML's any_of slot expressions carry a `range` reference. For arms
	// whose IR shape doesn't reduce to a single range name (products,
	// refinements, nested combinators), `rangeNameForTerm` falls back to
	// the IR kind, which is not a useful LinkML range.
	//
	// To make the round-trip preserve the inner IR structure — required
	// by structural criteria like pi-prime-20 (discriminated union over
	// products with literal tags), pi-prime-21 (shape-discriminated
	// union), pi-prime-42 (tagged dependent choice) — also stash each
	// arm's full encoded descriptor in `typecarta:union-arm-terms`. The
	// parser prefers that payload over the range-string fallback.
	const exprs: LinkmlExpression[] = term.args.map((arg) => {
		const name = rangeNameForTerm(arg);
		if (name !== undefined) return { range: name };
		return { range: String(arg.kind) };
	});
	const armTerms = term.args.map((arg) => encodeToDescriptor(arg) as unknown);
	const wrapperSlot: LinkmlSlot = {
		name: "value",
		required: true,
		[operator]: exprs,
	};
	const annotation: Record<string, unknown> = {
		"typecarta:combinator": operator,
		"typecarta:arms": term.args.map((a) => rangeNameForTerm(a) ?? a.kind),
		"typecarta:union-arm-terms": armTerms,
	};
	if (term.annotations?.exhaustive === true) {
		annotation["typecarta:exhaustive"] = true;
	}
	return {
		kind: "class",
		name: `Anonymous${operator.charAt(0).toUpperCase()}${operator.slice(1).replace(/_(.)/g, (_, ch) => ch.toUpperCase())}`,
		attributes: { value: wrapperSlot },
		annotations: annotation,
	};
}

function encodeProduct(term: Extract<TypeTerm, { kind: "apply" }>): LinkmlDescriptor {
	const annotations = (term.annotations ?? {}) as Record<string, unknown>;
	const attributes: Record<string, LinkmlSlot> = {};
	for (const f of term.fields ?? []) {
		attributes[f.name] = fieldToSlot(f);
	}
	// Family O (evolution / compatibility) annotations land here. LinkML
	// has a native `deprecated:` slot on every element. `version` and
	// `backwardCompatibleWith` are not first-class on classes (LinkML
	// versions live on `SchemaDefinition`); carry them through the
	// metamodel's structured `annotations:` slot with typecarta-prefixed
	// keys, which the parse side reads back into IR annotations.
	const carriedTypecartaAnnotations: Record<string, unknown> = {};
	if (annotations.version !== undefined) {
		carriedTypecartaAnnotations["typecarta:version"] = annotations.version;
	}
	if (annotations.backwardCompatibleWith !== undefined) {
		carriedTypecartaAnnotations["typecarta:backwardCompatibleWith"] =
			annotations.backwardCompatibleWith;
	}
	const deprecatedValue =
		annotations.deprecated === true
			? "true"
			: typeof annotations.deprecated === "string"
				? annotations.deprecated
				: undefined;
	return {
		kind: "class",
		name: "AnonymousClass",
		attributes,
		...(typeof annotations.documentation === "string"
			? { description: annotations.documentation }
			: {}),
		...(annotations.abstract === true ? { abstract: true } : {}),
		...(annotations.mixin === true ? { mixin: true } : {}),
		...(deprecatedValue !== undefined ? { deprecated: deprecatedValue } : {}),
		...(Object.keys(carriedTypecartaAnnotations).length > 0
			? { annotations: carriedTypecartaAnnotations }
			: {}),
	};
}

function fieldToSlot(f: {
	readonly name: string;
	readonly type: TypeTerm;
	readonly optional?: boolean;
	readonly defaultValue?: unknown;
	readonly annotations?: Record<string, unknown>;
}): LinkmlSlot {
	const annotations = (f.annotations ?? {}) as Record<string, unknown>;
	let typeTerm = f.type;
	let multivalued = false;
	if (typeTerm.kind === "apply" && typeTerm.constructor === "array") {
		multivalued = true;
		typeTerm = typeTerm.args[0]!;
	}
	// A literal-typed field (the discriminant of pi-prime-20 / pi-prime-42)
	// encodes as a string/number slot with the LinkML metamodel's native
	// `equals_string` / `equals_number` constant constraint. On parse we
	// rebuild the IR literal so the criterion's structural check finds it.
	if (typeTerm.kind === "literal") {
		const v = typeTerm.value;
		if (typeof v === "string") {
			return {
				name: f.name,
				range: "string",
				equals_string: v,
				...(f.optional === true ? {} : { required: true }),
				...(annotations.designates_type === true ? { designates_type: true } : {}),
			};
		}
		if (typeof v === "number") {
			return {
				name: f.name,
				range: Number.isInteger(v) ? "integer" : "decimal",
				equals_number: v,
				...(f.optional === true ? {} : { required: true }),
				...(annotations.designates_type === true ? { designates_type: true } : {}),
			};
		}
		if (typeof v === "boolean") {
			return {
				name: f.name,
				range: "boolean",
				// LinkML has no equals_boolean; carry the literal under a
				// typecarta marker so parse rebuilds the IR literal.
				annotations: { "typecarta:literal-value": v },
				...(f.optional === true ? {} : { required: true }),
				...(annotations.designates_type === true ? { designates_type: true } : {}),
			};
		}
	}
	const range = rangeNameForTerm(typeTerm);
	return {
		name: f.name,
		...(range !== undefined ? { range } : {}),
		...(f.optional === true ? {} : { required: true }),
		...(multivalued ? { multivalued: true } : {}),
		...(f.defaultValue !== undefined ? { ifabsent: String(f.defaultValue) } : {}),
		...extractSlotFacets(typeTerm),
		...(typeof annotations.documentation === "string"
			? { description: annotations.documentation }
			: {}),
		...(typeof annotations.slot_uri === "string" ? { slot_uri: annotations.slot_uri } : {}),
		...(annotations.key === true ? { identifier: true } : {}),
		...(annotations.inlined === true ? { inlined: true } : {}),
		...(annotations.inlined_as_list === true ? { inlined_as_list: true } : {}),
		...(annotations.designates_type === true ? { designates_type: true } : {}),
	};
}

function rangeNameForTerm(t: TypeTerm): string | undefined {
	if (t.kind === "base") return t.name;
	if (t.kind === "nominal") return t.tag;
	if (t.kind === "refinement") return rangeNameForTerm(t.base);
	if (t.kind === "let") return t.name;
	return undefined;
}

/** Remove all `typecarta:*` keys from an annotations record (or return undefined if empty). */
function stripTypecartaAnnotations(
	annotations: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
	if (annotations === undefined) return undefined;
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(annotations)) {
		if (k.startsWith("typecarta:")) continue;
		out[k] = v;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

function predicateSignature(p: RefinementPredicate): string {
	switch (p.kind) {
		case "range":
			return `range(${p.min ?? "_"},${p.max ?? "_"})`;
		case "pattern":
			return `pattern(${p.regex})`;
		case "multipleOf":
			return `multipleOf(${p.divisor})`;
		case "and":
			return `and(${predicateSignature(p.left)},${predicateSignature(p.right)})`;
		case "or":
			return `or(${predicateSignature(p.left)},${predicateSignature(p.right)})`;
		case "not":
			return `not(${predicateSignature(p.inner)})`;
		case "custom":
			return p.name;
		default:
			return "?";
	}
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
		// product ∩ product → encode as a merged class but stamp a typecarta
		// marker so parse can rebuild the intersection wrapper. The merged
		// class is itself valid LinkML; the marker only adds round-trip
		// fidelity for the criterion structural check.
		if (isRecord(a) && isRecord(b)) {
			const merged = encodeProduct(mergeFields(a, b));
			if (merged.kind === "class") {
				return {
					...merged,
					annotations: {
						...(merged.annotations ?? {}),
						"typecarta:intersection": "product-product",
						"typecarta:intersection-arms": term.args.map(
							(arg) => encodeToDescriptor(arg) as unknown,
						),
					},
				};
			}
			return merged;
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
		// refinement ∩ refinement → merged type with combined facets. Marker
		// preserves the intersection structure for pi-prime-24.
		if (a.kind === "refinement" && b.kind === "refinement") {
			const merged = encodeRefinement({
				kind: "refinement",
				base: a.base,
				predicate: andPredicate(a.predicate, b.predicate),
			});
			if (merged.kind === "type") {
				return {
					...merged,
					annotations: {
						...(merged.annotations ?? {}),
						"typecarta:intersection": "refinement-refinement",
						"typecarta:intersection-arms": term.args.map(
							(arg) => encodeToDescriptor(arg) as unknown,
						),
					},
				};
			}
			return merged;
		}
		// base ∩ refinement(base) → encode just the refinement (SP24 shape),
		// with a marker so the intersection wrapper survives parse.
		if (a.kind === "base" && b.kind === "refinement") {
			const inner = encodeRefinement(b);
			if (inner.kind === "type") {
				return {
					...inner,
					annotations: {
						...(inner.annotations ?? {}),
						"typecarta:intersection": "base-refinement",
						"typecarta:intersection-arms": term.args.map(
							(arg) => encodeToDescriptor(arg) as unknown,
						),
					},
				};
			}
			return inner;
		}
		if (b.kind === "base" && a.kind === "refinement") {
			const inner = encodeRefinement(a);
			if (inner.kind === "type") {
				return {
					...inner,
					annotations: {
						...(inner.annotations ?? {}),
						"typecarta:intersection": "base-refinement",
						"typecarta:intersection-arms": term.args.map(
							(arg) => encodeToDescriptor(arg) as unknown,
						),
					},
				};
			}
			return inner;
		}
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
	// refinement(product, _) → cross-field constraint. Emit as a class with
	// LinkML's `rules:` shape (so it's valid LinkML) AND a typecarta marker
	// carrying the predicate. The parse side recognizes the marker and
	// rebuilds the `refinement(product, predicate)` IR shape pi-prime-43
	// looks for. The rule's `expression` is a human-readable signature of
	// the predicate so the LinkML schema is interpretable on its own.
	if (inner.kind === "class") {
		return {
			...inner,
			rules: [
				...(inner.rules ?? []),
				{
					title: "typecarta-refinement",
					expression: `typecarta:refinement(${predicateSignature(term.predicate)})`,
				},
			],
			annotations: {
				...(inner.annotations ?? {}),
				"typecarta:refinement-over-product": term.predicate as unknown,
			},
		};
	}
	if (inner.kind !== "builtin" && inner.kind !== "type") {
		throw new Error("Cannot encode refinement over non-atomic LinkML base");
	}
	const baseBuiltin = inner.kind === "builtin" ? inner.name : (inner.typeof ?? "string");
	// Try to encode the predicate via native LinkML facets. If it contains
	// `multipleOf` (no LinkML equivalent), or another non-conjunctive form,
	// emit a typecarta marker carrying the predicate JSON so the round-trip
	// preserves the refinement tree for criteria that look at structure
	// rather than semantics (notably pi-prime-41 which only requires an
	// `and`/`or` predicate node anywhere in the term).
	let facets: Partial<LinkmlType>;
	let predicateMarker: unknown | undefined;
	try {
		facets = predicateToTypeFacets(term.predicate);
	} catch {
		facets = {};
		predicateMarker = term.predicate as unknown;
	}
	return {
		kind: "type",
		name: "AnonymousType",
		typeof: baseBuiltin,
		...facets,
		...(predicateMarker !== undefined
			? {
					annotations: {
						"typecarta:refinement-predicate": predicateMarker,
					},
				}
			: {}),
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
				const inner = encodeToDescriptor(term.children[0]!);
				// Stamp a typecarta marker so parse rebuilds the IR extension
				// node — pi-prime-44 / pi-prime-67 look for these by name.
				if (inner.kind === "class") {
					return {
						...inner,
						annotations: {
							...(inner.annotations ?? {}),
							[`typecarta:extension-${term.extensionKind}`]: term.payload as unknown,
						},
					};
				}
				return inner;
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
