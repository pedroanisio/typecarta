// XML Schema Definition adapter.
//
// Implements IRAdapter<Signature, XsdDescriptor> against W3C XML Schema 1.0
// (Parts 1 & 2, 2nd Edition, 2004; vendored at vendor/specs/xsd/).
//
// Coverage:
//   - All 19 built-in primitive datatypes (Part 2 §3.2)
//   - 18 commonly used built-in derived datatypes (Part 2 §3.3)
//   - All 12 constraining facets (Part 2 §4.3)
//   - xs:simpleType, xs:complexType, xs:sequence, xs:all, xs:choice
//   - xs:list (atomic items only — spec requirement), xs:union
//   - xs:any wildcard (open records)
//   - xs:nillable + xsi:nil
//   - xs:annotation (xs:documentation + xs:appinfo)
//   - xs:key, xs:keyref, xs:unique (with xs:selector + xs:field XPath)
//   - xs:schema with targetNamespace, xs:include, xs:import, xs:redefine
//   - final / block on type definitions
//   - xs:group, xs:attributeGroup (named groups)
//
// Out of scope (XSD 1.1 only): xs:assert, xs:override, conditional type
// assignment, type alternatives. Split into "xsd-1.1" adapter before claiming
// any 1.1-only verdict.

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
	set,
	top,
	union,
} from "@typecarta/core";

// ─── Datatype names (Part 2 §3.2 + §3.3) ────────────────────────────

/** Built-in primitive datatypes (Part 2 §3.2 — 19 types). */
export type XsdPrimitiveName =
	| "string"
	| "boolean"
	| "decimal"
	| "float"
	| "double"
	| "duration"
	| "dateTime"
	| "time"
	| "date"
	| "gYearMonth"
	| "gYear"
	| "gMonthDay"
	| "gDay"
	| "gMonth"
	| "hexBinary"
	| "base64Binary"
	| "anyURI"
	| "QName"
	| "NOTATION";

/**
 * Commonly used built-in derived datatypes (Part 2 §3.3).
 *
 * These are derivable from primitives by `xs:restriction`; modeling them as
 * a known list keeps round-trip fidelity for the names XSD documents use
 * directly. The spec lists more (e.g. `language`, `Name`, `NCName`, the
 * IDREFS / ENTITIES lists). The set below covers the most common ones for
 * scorecard purposes.
 */
export type XsdBuiltinDerivedName =
	| "normalizedString"
	| "token"
	| "language"
	| "Name"
	| "NCName"
	| "NMTOKEN"
	| "NMTOKENS"
	| "ID"
	| "IDREF"
	| "IDREFS"
	| "ENTITY"
	| "ENTITIES"
	| "integer"
	| "nonPositiveInteger"
	| "negativeInteger"
	| "long"
	| "int"
	| "short"
	| "byte"
	| "nonNegativeInteger"
	| "unsignedLong"
	| "unsignedInt"
	| "unsignedShort"
	| "unsignedByte"
	| "positiveInteger";

/** Either a primitive or a known built-in derived type name. */
export type XsdBuiltinName = XsdPrimitiveName | XsdBuiltinDerivedName;

// ─── Facets (Part 2 §4.3) ───────────────────────────────────────────

/**
 * The 12 XSD 1.0 constraining facets (Part 2 §4.3).
 *
 * `multipleOf` is NOT an XSD facet (JSON Schema invention) and is
 * deliberately absent — the encoder refuses to encode IR
 * `multipleOfConstraint` rather than fabricating a fake facet.
 */
export interface XsdFacets {
	readonly enumeration?: readonly (string | number | boolean)[];
	readonly pattern?: string;
	readonly length?: number;
	readonly minLength?: number;
	readonly maxLength?: number;
	readonly minInclusive?: number;
	readonly maxInclusive?: number;
	readonly minExclusive?: number;
	readonly maxExclusive?: number;
	readonly whiteSpace?: "preserve" | "replace" | "collapse";
	readonly totalDigits?: number;
	readonly fractionDigits?: number;
}

// ─── xs:annotation (Part 1 §3.13) ───────────────────────────────────

/** xs:annotation contents: xs:documentation + xs:appinfo. */
export interface XsdAnnotation {
	readonly documentation?: string;
	readonly appinfo?: unknown;
}

// ─── Identity constraints (Part 1 §3.11) ────────────────────────────

/** xs:key / xs:keyref / xs:unique definition. */
export interface XsdIdentityConstraint {
	readonly kind: "key" | "keyref" | "unique";
	readonly name: string;
	/** Required xs:selector XPath subset. */
	readonly selector: string;
	/** One or more xs:field XPath subsets. */
	readonly fields: readonly string[];
	/** Required iff `kind === "keyref"`: name of the xs:key/xs:unique being referenced. */
	readonly refer?: string;
}

// ─── Wildcard (Part 1 §3.10) ────────────────────────────────────────

/** xs:any wildcard for open records. */
export interface XsdWildcard {
	readonly namespace?: string;
	readonly processContents?: "lax" | "strict" | "skip";
}

// ─── Derivation control (Part 1 §3.4.1, §3.14) ──────────────────────

export type XsdDerivationToken = "restriction" | "extension" | "#all";

// ─── Elements + attributes ──────────────────────────────────────────

/** Describe an xs:element within complex types, sequences, choices, and all groups. */
export interface XsdElementDescriptor {
	readonly name: string;
	readonly type: XsdDescriptor;
	readonly minOccurs?: number;
	readonly maxOccurs?: number | "unbounded";
	/** Maps to XSD `nillable="true"` (element may carry `xsi:nil` instead of a value). */
	readonly nillable?: boolean;
	readonly annotation?: XsdAnnotation;
}

/** Describe an xs:attribute within a complex type or attributeGroup. */
export interface XsdAttributeDescriptor {
	readonly name: string;
	readonly type: XsdDescriptor;
	readonly use?: "optional" | "required";
	readonly default?: string;
	readonly fixed?: string;
	readonly annotation?: XsdAnnotation;
}

// ─── The descriptor union ───────────────────────────────────────────

/**
 * Reference to a named simple/complex type by `targetNamespace`-qualified
 * name. Lets self- and mutual-recursive schemas survive round-trip.
 */
export interface XsdTypeRef {
	readonly kind: "ref";
	readonly name: string;
}

/** A descriptor object representing the XSD 1.0 subset supported by this adapter. */
export type XsdDescriptor =
	| { readonly kind: "primitive"; readonly name: XsdBuiltinName }
	| { readonly kind: "anyType" }
	| { readonly kind: "empty" }
	| XsdTypeRef
	| {
			readonly kind: "simpleType";
			readonly name?: string;
			readonly base: XsdDescriptor;
			readonly facets?: XsdFacets;
			readonly annotation?: XsdAnnotation;
			readonly final?: XsdDerivationToken;
	  }
	| {
			readonly kind: "complexType";
			readonly name?: string;
			readonly elements: readonly XsdElementDescriptor[];
			readonly attributes?: readonly XsdAttributeDescriptor[];
			/** xs:any wildcard for open records. */
			readonly wildcard?: XsdWildcard;
			/** xs:key/xs:keyref/xs:unique identity constraints (§3.11). */
			readonly identityConstraints?: readonly XsdIdentityConstraint[];
			readonly annotation?: XsdAnnotation;
			readonly final?: XsdDerivationToken;
			readonly block?: XsdDerivationToken;
			/**
			 * If set, this complexType is xs:extension of the named base type.
			 * Used for record-merge intersection encoding.
			 */
			readonly extends?: string;
	  }
	| { readonly kind: "sequence"; readonly elements: readonly XsdElementDescriptor[] }
	| { readonly kind: "all"; readonly elements: readonly XsdElementDescriptor[] }
	| { readonly kind: "choice"; readonly options: readonly XsdElementDescriptor[] }
	| { readonly kind: "list"; readonly itemType: XsdDescriptor }
	/** xs:list constrained by xs:unique — set-uniqueness over an atomic item type. */
	| { readonly kind: "set"; readonly itemType: XsdDescriptor }
	| { readonly kind: "union"; readonly members: readonly XsdDescriptor[] }
	/**
	 * xs:group — named content-model reuse. The body must be one of
	 * sequence/all/choice (Part 1 §3.7).
	 */
	| {
			readonly kind: "group";
			readonly name: string;
			readonly body: XsdDescriptor;
	  }
	/** xs:attributeGroup — named attribute-set reuse (Part 1 §3.6). */
	| {
			readonly kind: "attributeGroup";
			readonly name: string;
			readonly attributes: readonly XsdAttributeDescriptor[];
	  }
	/**
	 * xs:schema — module root. Carries targetNamespace + dependencies + the
	 * type definitions contained in this schema document.
	 */
	| {
			readonly kind: "schema";
			readonly targetNamespace?: string;
			readonly includes?: readonly string[];
			readonly imports?: readonly {
				readonly namespace: string;
				readonly schemaLocation?: string;
			}[];
			readonly redefines?: readonly string[];
			readonly types: readonly XsdDescriptor[];
			readonly annotation?: XsdAnnotation;
	  };

// ─── Atomic-type test (used by xs:list legality check) ──────────────

/** True iff `desc` is an atomic / union-of-atomic type (legal xs:list itemType). */
function isAtomicDescriptor(desc: XsdDescriptor): boolean {
	switch (desc.kind) {
		case "primitive":
			return true;
		case "simpleType":
			return true;
		case "union":
			return desc.members.every(isAtomicDescriptor);
		case "ref":
			// A `ref` to a named simpleType is atomic in practice; we cannot
			// resolve to confirm, so optimistic-assume atomic.
			return true;
		default:
			return false;
	}
}

// ─── Supported IR kinds ─────────────────────────────────────────────

const XSD_SUPPORTED_KINDS: ReadonlySet<TypeTerm["kind"]> = new Set([
	"bottom",
	"top",
	"literal",
	"base",
	"apply",
	"refinement",
	// Gaps closed in this audit:
	"nominal", // → named simpleType wrapper
	"let", // → named type alias
	"extension", // → key/keyref/unique/module/visibility/path-constraint
] satisfies readonly TypeTerm["kind"][]);

// ─── Signature ──────────────────────────────────────────────────────

const XSD_PRIMITIVE_NAMES: readonly XsdPrimitiveName[] = [
	"string",
	"boolean",
	"decimal",
	"float",
	"double",
	"duration",
	"dateTime",
	"time",
	"date",
	"gYearMonth",
	"gYear",
	"gMonthDay",
	"gDay",
	"gMonth",
	"hexBinary",
	"base64Binary",
	"anyURI",
	"QName",
	"NOTATION",
];

const XSD_BUILTIN_DERIVED_NAMES: readonly XsdBuiltinDerivedName[] = [
	"normalizedString",
	"token",
	"language",
	"Name",
	"NCName",
	"NMTOKEN",
	"NMTOKENS",
	"ID",
	"IDREF",
	"IDREFS",
	"ENTITY",
	"ENTITIES",
	"integer",
	"nonPositiveInteger",
	"negativeInteger",
	"long",
	"int",
	"short",
	"byte",
	"nonNegativeInteger",
	"unsignedLong",
	"unsignedInt",
	"unsignedShort",
	"unsignedByte",
	"positiveInteger",
];

const XSD_ALL_BUILTIN_NAMES: readonly XsdBuiltinName[] = [
	...XSD_PRIMITIVE_NAMES,
	...XSD_BUILTIN_DERIVED_NAMES,
];

const XSD_BUILTIN_NAME_SET: ReadonlySet<string> = new Set(XSD_ALL_BUILTIN_NAMES);

const XSD_SIGNATURE: Signature = createSignature(XSD_PRIMITIVE_NAMES as readonly string[], [
	// Constructors XSD natively supports.
	{ name: "product", arity: 1 },
	{ name: "array", arity: 1 },
	{ name: "set", arity: 1 },
	{ name: "union", arity: 2 },
]);

// ─── Adapter class ──────────────────────────────────────────────────

/** Adapt XSD 1.0 schema-component descriptors to and from the typecarta IR. */
export class XsdAdapter implements IRAdapter<Signature, XsdDescriptor> {
	readonly name = "xsd";
	// XSD 1.0 only — no `xs:assert`, `xs:override`, or conditional type
	// assignment is implemented. Split into "xsd-1.0" / "xsd-1.1" adapters
	// before claiming any 1.1-only verdict.
	readonly specVersion = "1.0";
	readonly signature = XSD_SIGNATURE;

	/**
	 * Parse an XSD descriptor into a TypeTerm.
	 *
	 * @param source - XSD descriptor to parse.
	 * @returns Equivalent TypeTerm representation.
	 */
	parse(source: XsdDescriptor): TypeTerm {
		return parseXsdDescriptor(source);
	}

	/**
	 * Encode a TypeTerm into an XSD descriptor.
	 *
	 * @param term - TypeTerm to encode.
	 * @returns Equivalent XSD descriptor.
	 */
	encode(term: TypeTerm): XsdDescriptor {
		return encodeToXsdDescriptor(term);
	}

	/**
	 * Check whether a TypeTerm can be encoded as an XSD descriptor.
	 *
	 * @param term - TypeTerm to test.
	 * @returns `true` when encoding succeeds.
	 */
	isEncodable(term: TypeTerm): boolean {
		try {
			this.encode(term);
			return true;
		} catch {
			return false;
		}
	}

	supportsKind(kind: TypeTerm["kind"]): boolean {
		return XSD_SUPPORTED_KINDS.has(kind);
	}

	/**
	 * Test whether a value inhabits the given type term under this XSD subset.
	 *
	 * @param value - Runtime value to check.
	 * @param term - TypeTerm describing the expected type.
	 * @returns `true` if the value inhabits the term.
	 */
	inhabits(value: unknown, term: TypeTerm): boolean {
		return checkInhabitation(value, term);
	}
}

// ─── Parse (XSD descriptor → TypeTerm) ──────────────────────────────

function parseXsdDescriptor(desc: XsdDescriptor): TypeTerm {
	switch (desc.kind) {
		case "primitive":
			return base(desc.name);
		case "anyType":
			return top();
		case "empty":
			return bottom();
		case "ref":
			// A ref to a named type that we don't have in scope; surface it as a
			// nominal wrapper over top so the name survives round-trip.
			return nominal(desc.name, top());
		case "simpleType":
			return parseSimpleType(desc);
		case "complexType":
			return parseComplexType(desc);
		case "sequence":
		case "all":
			return product(desc.elements.map(parseElement));
		case "choice":
			return union(desc.options.map((option) => parseXsdDescriptor(option.type)));
		case "list":
			return array(parseXsdDescriptor(desc.itemType));
		case "set":
			return set(parseXsdDescriptor(desc.itemType));
		case "union":
			return union(desc.members.map(parseXsdDescriptor));
		case "group":
			return letBinding(desc.name, parseXsdDescriptor(desc.body), base(desc.name));
		case "attributeGroup": {
			const fields = desc.attributes.map(parseAttribute);
			return letBinding(desc.name, product(fields), base(desc.name));
		}
		case "schema":
			return parseSchema(desc);
	}
}

function parseSimpleType(desc: Extract<XsdDescriptor, { kind: "simpleType" }>): TypeTerm {
	const facets = desc.facets;
	const baseTerm = parseXsdDescriptor(desc.base);
	let body: TypeTerm;
	if (facets?.enumeration && facets.enumeration.length > 0) {
		const literals = facets.enumeration.map((value) => literal(value));
		body = literals.length === 1 ? literals[0]! : union(literals);
	} else {
		const predicate = facetsToPredicate(facets);
		body = predicate ? refinement(baseTerm, predicate) : baseTerm;
	}
	const annotated = withAnnotation(body, desc.annotation);
	return desc.name ? letBinding(desc.name, annotated, base(desc.name)) : annotated;
}

function parseComplexType(desc: Extract<XsdDescriptor, { kind: "complexType" }>): TypeTerm {
	const fields = [
		...desc.elements.map(parseElement),
		...(desc.attributes ?? []).map(parseAttribute),
	];
	const annotations: Record<string, unknown> = {};
	if (desc.wildcard !== undefined) annotations.open = true;
	if (desc.annotation?.documentation !== undefined) {
		annotations.documentation = desc.annotation.documentation;
	}
	if (desc.annotation?.appinfo !== undefined) {
		annotations.appinfo = desc.annotation.appinfo;
	}
	if (desc.final !== undefined) annotations.final = desc.final;
	if (desc.block !== undefined) annotations.block = desc.block;

	const productTerm =
		Object.keys(annotations).length > 0 ? product(fields, annotations) : product(fields);

	let body: TypeTerm = productTerm;
	for (const c of desc.identityConstraints ?? []) {
		body = parseIdentityConstraint(c, body);
	}
	if (desc.extends !== undefined) {
		// xs:extension of a named base: model as intersection of the base
		// reference and the local additions.
		body = extension("xsd-extends", { base: desc.extends }, [body]);
	}
	return desc.name ? letBinding(desc.name, body, base(desc.name)) : body;
}

function parseIdentityConstraint(c: XsdIdentityConstraint, body: TypeTerm): TypeTerm {
	if (c.kind === "keyref") {
		return extension(
			"foreign-key",
			{
				name: c.name,
				selector: c.selector,
				fields: c.fields,
				refer: c.refer,
			},
			[body],
		);
	}
	if (c.kind === "unique") {
		return extension(
			"path-constraint",
			{ name: c.name, selector: c.selector, fields: c.fields, kind: "unique" },
			[body],
		);
	}
	return extension(
		"path-constraint",
		{ name: c.name, selector: c.selector, fields: c.fields, kind: "key" },
		[body],
	);
}

function parseSchema(desc: Extract<XsdDescriptor, { kind: "schema" }>): TypeTerm {
	const inner = desc.types.length === 1 ? parseXsdDescriptor(desc.types[0]!) : top();
	const payload: Record<string, unknown> = {};
	if (desc.targetNamespace !== undefined) payload.targetNamespace = desc.targetNamespace;
	if (desc.includes !== undefined) payload.includes = desc.includes;
	if (desc.imports !== undefined) payload.imports = desc.imports;
	if (desc.redefines !== undefined) payload.redefines = desc.redefines;
	if (desc.annotation?.documentation !== undefined) {
		payload.documentation = desc.annotation.documentation;
	}
	return extension("module", payload, [inner]);
}

function facetsToPredicate(facets: XsdFacets | undefined): RefinementPredicate | undefined {
	if (facets === undefined) return undefined;
	const predicates: RefinementPredicate[] = [];

	// Inclusive bounds.
	if (facets.minInclusive !== undefined || facets.maxInclusive !== undefined) {
		predicates.push(rangeConstraint(facets.minInclusive, facets.maxInclusive));
	}
	// Exclusive bounds — IR's range predicate has an `exclusive` flag.
	if (facets.minExclusive !== undefined || facets.maxExclusive !== undefined) {
		const range: RefinementPredicate = {
			kind: "range",
			...(facets.minExclusive !== undefined ? { min: facets.minExclusive } : {}),
			...(facets.maxExclusive !== undefined ? { max: facets.maxExclusive } : {}),
			exclusive: true,
		};
		predicates.push(range);
	}
	if (facets.pattern !== undefined) {
		predicates.push(patternConstraint(facets.pattern));
	}
	// Length facets — modeled as custom predicates so values round-trip.
	if (facets.length !== undefined) {
		predicates.push({ kind: "custom", name: "xsd:length", params: { length: facets.length } });
	}
	if (facets.minLength !== undefined) {
		predicates.push({
			kind: "custom",
			name: "xsd:minLength",
			params: { minLength: facets.minLength },
		});
	}
	if (facets.maxLength !== undefined) {
		predicates.push({
			kind: "custom",
			name: "xsd:maxLength",
			params: { maxLength: facets.maxLength },
		});
	}
	if (facets.whiteSpace !== undefined) {
		predicates.push({
			kind: "custom",
			name: "xsd:whiteSpace",
			params: { whiteSpace: facets.whiteSpace },
		});
	}
	if (facets.totalDigits !== undefined) {
		predicates.push({
			kind: "custom",
			name: "xsd:totalDigits",
			params: { totalDigits: facets.totalDigits },
		});
	}
	if (facets.fractionDigits !== undefined) {
		predicates.push({
			kind: "custom",
			name: "xsd:fractionDigits",
			params: { fractionDigits: facets.fractionDigits },
		});
	}

	return predicates.reduce<RefinementPredicate | undefined>(
		(acc, predicate) => (acc ? andPredicate(acc, predicate) : predicate),
		undefined,
	);
}

function withAnnotation(term: TypeTerm, annotation: XsdAnnotation | undefined): TypeTerm {
	if (annotation === undefined) return term;
	const annotations: Record<string, unknown> = {};
	if (annotation.documentation !== undefined) annotations.documentation = annotation.documentation;
	if (annotation.appinfo !== undefined) annotations.appinfo = annotation.appinfo;
	if (Object.keys(annotations).length === 0) return term;
	return { ...term, annotations: { ...(term.annotations ?? {}), ...annotations } };
}

function parseElement(element: XsdElementDescriptor): ReturnType<typeof field> {
	const parsedType = parseXsdDescriptor(element.type);
	const arrayWrapped =
		element.maxOccurs === "unbounded" ||
		(typeof element.maxOccurs === "number" && element.maxOccurs > 1)
			? array(parsedType)
			: parsedType;
	const type = element.nillable ? union([arrayWrapped, base("null")]) : arrayWrapped;
	const annotations: Record<string, unknown> = {};
	if (element.annotation?.documentation !== undefined) {
		annotations.documentation = element.annotation.documentation;
	}
	if (element.annotation?.appinfo !== undefined) {
		annotations.appinfo = element.annotation.appinfo;
	}
	return field(element.name, type, {
		...(element.minOccurs === 0 ? { optional: true } : {}),
		...(Object.keys(annotations).length > 0 ? { annotations } : {}),
	});
}

function parseAttribute(attribute: XsdAttributeDescriptor): ReturnType<typeof field> {
	const annotations: Record<string, unknown> = {};
	if (attribute.annotation?.documentation !== undefined) {
		annotations.documentation = attribute.annotation.documentation;
	}
	if (attribute.annotation?.appinfo !== undefined) {
		annotations.appinfo = attribute.annotation.appinfo;
	}
	return field(`@${attribute.name}`, parseXsdDescriptor(attribute.type), {
		...(attribute.use !== "required" ? { optional: true } : {}),
		...(attribute.default !== undefined ? { defaultValue: attribute.default } : {}),
		...(Object.keys(annotations).length > 0 ? { annotations } : {}),
	});
}

// ─── Encode (TypeTerm → XSD descriptor) ─────────────────────────────

function encodeToXsdDescriptor(term: TypeTerm): XsdDescriptor {
	switch (term.kind) {
		case "bottom":
			return { kind: "empty" };
		case "top":
			return { kind: "anyType" };
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
			throw new Error(`Cannot encode ${term.kind} to XSD`);
	}
}

function encodeLiteral(term: Extract<TypeTerm, { kind: "literal" }>): XsdDescriptor {
	if (term.value === null) {
		// XSD has no `null` literal; reject rather than fabricate.
		throw new Error("Cannot encode literal(null) to XSD — null is not an XSD type");
	}
	return {
		kind: "simpleType",
		base: primitiveForLiteral(term.value),
		facets: { enumeration: [term.value] },
	};
}

function primitiveForLiteral(value: string | number | boolean): XsdDescriptor {
	switch (typeof value) {
		case "string":
			return { kind: "primitive", name: "string" };
		case "number":
			return { kind: "primitive", name: Number.isInteger(value) ? "integer" : "decimal" };
		case "boolean":
			return { kind: "primitive", name: "boolean" };
	}
}

function encodeBase(name: string): XsdDescriptor {
	if (name === "number") return { kind: "primitive", name: "decimal" };
	if (name === "null") {
		// Bare base("null") has no XSD representation. The `nillable` lift in
		// encodeField handles `union([T, null])` before this code is reached.
		throw new Error('Cannot encode base("null") to XSD — null is not an XSD type');
	}
	if (XSD_BUILTIN_NAME_SET.has(name)) {
		return { kind: "primitive", name: name as XsdBuiltinName };
	}
	throw new Error(`Cannot encode base type "${name}" to XSD`);
}

function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): XsdDescriptor {
	switch (term.constructor) {
		case "product":
			return encodeProduct(term);
		case "array":
			return encodeArrayOrSet(term, "list");
		case "set":
			return encodeArrayOrSet(term, "set");
		case "union":
			return { kind: "union", members: term.args.map(encodeToXsdDescriptor) };
		case "intersection":
			return encodeIntersection(term);
		case "map":
			throw new Error(
				"Cannot encode map to XSD — XSD has no map/dictionary primitive. " +
					"Model as a complexType with a repeating named element via product([field(...)] ).",
			);
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to XSD`);
	}
}

function encodeProduct(term: Extract<TypeTerm, { kind: "apply" }>): XsdDescriptor {
	const annotations = (term.annotations ?? {}) as Record<string, unknown>;
	const wildcard = annotations.open === true ? {} : undefined;
	const annotation = collectAnnotation(annotations);
	const final = annotations.final as XsdDerivationToken | undefined;
	const block = annotations.block as XsdDerivationToken | undefined;
	return {
		kind: "complexType",
		elements: (term.fields ?? []).map(encodeField),
		...(wildcard !== undefined ? { wildcard } : {}),
		...(annotation !== undefined ? { annotation } : {}),
		...(final !== undefined ? { final } : {}),
		...(block !== undefined ? { block } : {}),
	};
}

function encodeArrayOrSet(
	term: Extract<TypeTerm, { kind: "apply" }>,
	kind: "list" | "set",
): XsdDescriptor {
	const itemType = term.args[0];
	if (itemType === undefined) throw new Error(`XSD ${kind} requires an item type`);
	const itemDesc = encodeToXsdDescriptor(itemType);
	if (isAtomicDescriptor(itemDesc)) {
		return { kind, itemType: itemDesc };
	}
	// xs:list requires atomic itemType (Part 2 §4.2.1.1). For complex items
	// the legal XSD encoding is a complexType containing one repeating
	// element. Use a synthetic "item" element name.
	return {
		kind: "complexType",
		elements: [
			{
				name: "item",
				type: itemDesc,
				maxOccurs: "unbounded",
				...(kind === "set" ? {} : {}),
			},
		],
	};
}

function encodeIntersection(term: Extract<TypeTerm, { kind: "apply" }>): XsdDescriptor {
	// Record-merge intersection: A ∩ B where both sides are product types.
	// Model as xs:complexType with xs:extension when one side names a base.
	// Two-product case: merge fields, prefer left's metadata.
	const args = term.args;
	if (args.length === 2) {
		const [a, b] = args;
		if (a === undefined || b === undefined) {
			throw new Error("Cannot encode intersection with missing arguments to XSD");
		}
		if (isRecordTerm(a) && isRecordTerm(b)) {
			const merged = mergeProducts(a, b);
			return encodeProduct(merged);
		}
		// Mixed simple/complex: encode as xs:simpleType restriction of left
		// over right if both atomic, else fall through to refusing.
		if (a.kind === "refinement" && b.kind === "refinement") {
			return encodeRefinement({
				kind: "refinement",
				base: a.base,
				predicate: andPredicate(a.predicate, b.predicate),
			});
		}
	}
	throw new Error(
		"Cannot encode intersection to XSD — supported shapes: " +
			"product ∩ product (merged via xs:extension), refinement ∩ refinement (combined facets)",
	);
}

function isRecordTerm(t: TypeTerm): t is Extract<TypeTerm, { kind: "apply" }> {
	return t.kind === "apply" && t.constructor === "product";
}

function mergeProducts(
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

function encodeRefinement(term: Extract<TypeTerm, { kind: "refinement" }>): XsdDescriptor {
	return {
		kind: "simpleType",
		base: encodeToXsdDescriptor(term.base),
		facets: predicateToFacets(term.predicate),
	};
}

function predicateToFacets(predicate: RefinementPredicate): XsdFacets {
	switch (predicate.kind) {
		case "range":
			if (predicate.exclusive === true) {
				return {
					...(predicate.min !== undefined ? { minExclusive: predicate.min } : {}),
					...(predicate.max !== undefined ? { maxExclusive: predicate.max } : {}),
				};
			}
			return {
				...(predicate.min !== undefined ? { minInclusive: predicate.min } : {}),
				...(predicate.max !== undefined ? { maxInclusive: predicate.max } : {}),
			};
		case "pattern":
			return { pattern: predicate.regex };
		case "multipleOf":
			// XSD 1.0 has no multipleOf facet. Refuse rather than fabricate.
			throw new Error(
				"Cannot encode multipleOfConstraint to XSD — XSD 1.0 has no multipleOf facet (JSON Schema invention)",
			);
		case "custom":
			return customPredicateToFacets(predicate);
		case "and":
			return { ...predicateToFacets(predicate.left), ...predicateToFacets(predicate.right) };
		case "or":
		case "not":
			throw new Error(
				`Cannot encode predicate "${predicate.kind}" to XSD — facets are conjunctive only`,
			);
		default:
			return {};
	}
}

function customPredicateToFacets(
	predicate: Extract<RefinementPredicate, { kind: "custom" }>,
): XsdFacets {
	const params = predicate.params ?? {};
	switch (predicate.name) {
		case "xsd:length":
			return { length: params.length as number };
		case "xsd:minLength":
			return { minLength: params.minLength as number };
		case "xsd:maxLength":
			return { maxLength: params.maxLength as number };
		case "xsd:whiteSpace": {
			const ws = params.whiteSpace as "preserve" | "replace" | "collapse" | undefined;
			return ws !== undefined ? { whiteSpace: ws } : {};
		}
		case "xsd:totalDigits":
			return { totalDigits: params.totalDigits as number };
		case "xsd:fractionDigits":
			return { fractionDigits: params.fractionDigits as number };
		default:
			throw new Error(`Cannot encode custom predicate "${predicate.name}" to XSD`);
	}
}

function encodeNominal(term: Extract<TypeTerm, { kind: "nominal" }>): XsdDescriptor {
	const inner = encodeToXsdDescriptor(term.inner);
	// Named simpleType wrapper (if the inner is simple) or named complexType.
	if (inner.kind === "simpleType" || inner.kind === "primitive") {
		return {
			kind: "simpleType",
			name: term.tag,
			base: inner.kind === "simpleType" ? inner.base : inner,
			...(inner.kind === "simpleType" && inner.facets ? { facets: inner.facets } : {}),
		};
	}
	if (inner.kind === "complexType") {
		return { ...inner, name: term.tag };
	}
	// Fall back: wrap any other shape in a named complexType containing it as
	// a single element. Best-effort fidelity for unusual nominals.
	return {
		kind: "complexType",
		name: term.tag,
		elements: [{ name: "value", type: inner }],
	};
}

function encodeLet(term: Extract<TypeTerm, { kind: "let" }>): XsdDescriptor {
	// Encode the bound type as a named simple/complex type. The `body` field
	// is dropped on the assumption that it's a reference to the binding —
	// the canonical IR shape produced by parse.
	const inner = encodeToXsdDescriptor(term.binding);
	if (inner.kind === "simpleType") return { ...inner, name: term.name };
	if (inner.kind === "complexType") return { ...inner, name: term.name };
	if (inner.kind === "primitive") {
		return { kind: "simpleType", name: term.name, base: inner };
	}
	// Fall through: wrap in a single-element complexType, named.
	return {
		kind: "complexType",
		name: term.name,
		elements: [{ name: "value", type: inner }],
	};
}

function encodeExtension(term: Extract<TypeTerm, { kind: "extension" }>): XsdDescriptor {
	switch (term.extensionKind) {
		case "module":
			return encodeModule(term);
		case "visibility":
			return encodeVisibility(term);
		case "foreign-key":
			return encodeForeignKey(term);
		case "path-constraint":
			return encodePathConstraint(term);
		case "xsd-extends":
			return encodeXsdExtends(term);
		default:
			throw new Error(`Cannot encode extension "${term.extensionKind}" to XSD`);
	}
}

function encodeModule(term: Extract<TypeTerm, { kind: "extension" }>): XsdDescriptor {
	const payload = (term.payload ?? {}) as {
		readonly targetNamespace?: string;
		readonly includes?: readonly string[];
		readonly imports?: readonly { readonly namespace: string; readonly schemaLocation?: string }[];
		readonly redefines?: readonly string[];
		readonly name?: string;
		readonly documentation?: string;
	};
	const types = (term.children ?? []).map(encodeToXsdDescriptor);
	const targetNamespace =
		payload.targetNamespace ??
		(payload.name !== undefined ? `urn:typecarta:${payload.name}` : undefined);
	return {
		kind: "schema",
		...(targetNamespace !== undefined ? { targetNamespace } : {}),
		...(payload.includes !== undefined ? { includes: payload.includes } : {}),
		...(payload.imports !== undefined ? { imports: payload.imports } : {}),
		...(payload.redefines !== undefined ? { redefines: payload.redefines } : {}),
		types,
		...(payload.documentation !== undefined
			? { annotation: { documentation: payload.documentation } }
			: {}),
	};
}

function encodeVisibility(term: Extract<TypeTerm, { kind: "extension" }>): XsdDescriptor {
	const payload = (term.payload ?? {}) as { readonly level?: string };
	const child = term.children?.[0];
	if (child === undefined) {
		throw new Error("visibility extension requires a child term");
	}
	const inner = encodeToXsdDescriptor(child);
	if (inner.kind !== "complexType" && inner.kind !== "simpleType") {
		// Wrap so we can attach final/block.
		return inner;
	}
	// Map visibility levels to derivation control:
	//   "public" → no constraints (defaults)
	//   "sealed" / "final" → final="#all"
	//   "abstract" → block="#all"  (loose semantic match)
	const final =
		payload.level === "sealed" || payload.level === "final" ? ("#all" as const) : undefined;
	const block = payload.level === "abstract" ? ("#all" as const) : undefined;
	if (inner.kind === "complexType") {
		return {
			...inner,
			...(final !== undefined ? { final } : {}),
			...(block !== undefined ? { block } : {}),
		};
	}
	return {
		...inner,
		...(final !== undefined ? { final } : {}),
	};
}

function encodeForeignKey(term: Extract<TypeTerm, { kind: "extension" }>): XsdDescriptor {
	const payload = (term.payload ?? {}) as {
		readonly name?: string;
		readonly selector?: string;
		readonly fields?: readonly string[];
		readonly refer?: string;
		// Witness-style payload (sourceField / targetCollection / targetField):
		readonly sourceField?: string;
		readonly targetCollection?: string;
		readonly targetField?: string;
	};
	const child = term.children?.[0];
	if (child === undefined) {
		throw new Error("foreign-key extension requires a child term");
	}
	const inner = encodeToXsdDescriptor(child);
	if (inner.kind !== "complexType") {
		throw new Error("foreign-key extension must wrap a product (complexType) to attach xs:keyref");
	}
	const refer =
		payload.refer ?? (payload.targetCollection ? `${payload.targetCollection}_key` : undefined);
	const constraint: XsdIdentityConstraint = {
		kind: "keyref",
		name: payload.name ?? "fk",
		selector: payload.selector ?? ".",
		fields: payload.fields ?? (payload.sourceField ? [payload.sourceField] : []),
		...(refer !== undefined ? { refer } : {}),
	};
	return {
		...inner,
		identityConstraints: [...(inner.identityConstraints ?? []), constraint],
	};
}

function encodePathConstraint(term: Extract<TypeTerm, { kind: "extension" }>): XsdDescriptor {
	const payload = (term.payload ?? {}) as {
		readonly name?: string;
		readonly selector?: string;
		readonly fields?: readonly string[];
		readonly kind?: "key" | "unique";
		readonly path?: string;
	};
	const child = term.children?.[0];
	if (child === undefined) {
		throw new Error("path-constraint extension requires a child term");
	}
	const inner = encodeToXsdDescriptor(child);
	if (inner.kind !== "complexType") {
		throw new Error(
			"path-constraint extension must wrap a product (complexType) to attach xs:unique/xs:key",
		);
	}
	const selector = payload.selector ?? payload.path ?? ".";
	const constraint: XsdIdentityConstraint = {
		kind: payload.kind ?? "unique",
		name: payload.name ?? "uq",
		selector,
		fields: payload.fields ?? ["."],
	};
	return {
		...inner,
		identityConstraints: [...(inner.identityConstraints ?? []), constraint],
	};
}

function encodeXsdExtends(term: Extract<TypeTerm, { kind: "extension" }>): XsdDescriptor {
	const payload = (term.payload ?? {}) as { readonly base?: string };
	const child = term.children?.[0];
	if (child === undefined) {
		throw new Error("xsd-extends extension requires a child term");
	}
	const inner = encodeToXsdDescriptor(child);
	if (inner.kind !== "complexType") {
		throw new Error("xsd-extends must wrap a complexType");
	}
	return payload.base !== undefined ? { ...inner, extends: payload.base } : inner;
}

function encodeField(f: {
	readonly name: string;
	readonly type: TypeTerm;
	readonly optional?: boolean;
	readonly annotations?: Record<string, unknown>;
}): XsdElementDescriptor {
	const annotation = collectAnnotation((f.annotations ?? {}) as Record<string, unknown>);

	// Detect `union([T, base("null")])` — the spec's nullable-by-value
	// pattern — and lift it into `nillable: true` on the element with type T.
	const nullableInner = extractNullableInner(f.type);
	if (nullableInner !== undefined) {
		return {
			name: f.name,
			type: encodeToXsdDescriptor(nullableInner),
			nillable: true,
			...(f.optional ? { minOccurs: 0 } : {}),
			...(annotation !== undefined ? { annotation } : {}),
		};
	}
	if (f.type.kind === "apply" && f.type.constructor === "array") {
		const elementType = f.type.args[0];
		if (elementType === undefined) throw new Error(`Array field "${f.name}" has no element type`);
		return {
			name: f.name,
			type: encodeToXsdDescriptor(elementType),
			...(f.optional ? { minOccurs: 0 } : {}),
			maxOccurs: "unbounded",
			...(annotation !== undefined ? { annotation } : {}),
		};
	}
	return {
		name: f.name,
		type: encodeToXsdDescriptor(f.type),
		...(f.optional ? { minOccurs: 0 } : {}),
		...(annotation !== undefined ? { annotation } : {}),
	};
}

function collectAnnotation(annotations: Record<string, unknown>): XsdAnnotation | undefined {
	const out: XsdAnnotation = {};
	if (typeof annotations.documentation === "string") {
		(out as { documentation?: string }).documentation = annotations.documentation;
	}
	if (annotations.appinfo !== undefined) {
		(out as { appinfo?: unknown }).appinfo = annotations.appinfo;
	}
	return Object.keys(out).length === 0 ? undefined : out;
}

/**
 * If `term` is `union([T, base("null")])` (in either order), return `T`.
 * Otherwise return undefined. Recognizes binary unions only; nested unions
 * with null among >2 arms fall through to the normal union encoder.
 */
function extractNullableInner(term: TypeTerm): TypeTerm | undefined {
	if (term.kind !== "apply" || term.constructor !== "union") return undefined;
	if (term.args.length !== 2) return undefined;
	const [a, b] = term.args;
	if (a === undefined || b === undefined) return undefined;
	const isNull = (t: TypeTerm) => t.kind === "base" && t.name === "null";
	if (isNull(a)) return b;
	if (isNull(b)) return a;
	return undefined;
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
				checkInhabitation(value, term.base) && checkPredicateInhabitation(value, term.predicate)
			);
		case "nominal":
			return checkInhabitation(value, term.inner);
		case "let":
			return checkInhabitation(value, term.body);
		case "extension": {
			// Extensions wrap their children; pass through to the inner term.
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
		case "date":
		case "dateTime":
		case "time":
		case "duration":
		case "gYearMonth":
		case "gYear":
		case "gMonthDay":
		case "gDay":
		case "gMonth":
		case "anyURI":
		case "QName":
		case "NOTATION":
		case "hexBinary":
		case "base64Binary":
		case "normalizedString":
		case "token":
		case "language":
		case "Name":
		case "NCName":
		case "NMTOKEN":
		case "ID":
		case "IDREF":
		case "ENTITY":
			return typeof value === "string";
		case "NMTOKENS":
		case "IDREFS":
		case "ENTITIES":
			return Array.isArray(value) && value.every((v) => typeof v === "string");
		case "boolean":
			return typeof value === "boolean";
		case "decimal":
		case "float":
		case "double":
		case "number":
			return typeof value === "number";
		case "integer":
		case "long":
		case "int":
		case "short":
		case "byte":
		case "nonPositiveInteger":
		case "negativeInteger":
		case "nonNegativeInteger":
		case "positiveInteger":
		case "unsignedLong":
		case "unsignedInt":
		case "unsignedShort":
		case "unsignedByte":
			return typeof value === "number" && Number.isInteger(value);
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
		case "array": {
			const elementType = term.args[0];
			return (
				Array.isArray(value) &&
				elementType !== undefined &&
				value.every((item) => checkInhabitation(item, elementType))
			);
		}
		case "set": {
			const elementType = term.args[0];
			if (!Array.isArray(value) || elementType === undefined) return false;
			if (new Set(value).size !== value.length) return false;
			return value.every((item) => checkInhabitation(item, elementType));
		}
		case "union":
			return term.args.some((arg) => checkInhabitation(value, arg));
		case "intersection":
			return term.args.every((arg) => checkInhabitation(value, arg));
		case "map": {
			const valueType = term.args[1];
			if (typeof value !== "object" || value === null || valueType === undefined) return false;
			return Object.values(value as Record<string, unknown>).every((entry) =>
				checkInhabitation(entry, valueType),
			);
		}
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
		case "custom":
			return checkCustomPredicate(value, predicate);
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
		default:
			return true;
	}
}

function checkCustomPredicate(
	value: unknown,
	predicate: Extract<RefinementPredicate, { kind: "custom" }>,
): boolean {
	const params = predicate.params ?? {};
	switch (predicate.name) {
		case "xsd:length":
			return typeof value === "string" && value.length === (params.length as number);
		case "xsd:minLength":
			return typeof value === "string" && value.length >= (params.minLength as number);
		case "xsd:maxLength":
			return typeof value === "string" && value.length <= (params.maxLength as number);
		case "xsd:whiteSpace":
			// whiteSpace is a normalization rule, not a value-level predicate.
			return true;
		case "xsd:totalDigits":
		case "xsd:fractionDigits":
			return typeof value === "number";
		default:
			return true;
	}
}
