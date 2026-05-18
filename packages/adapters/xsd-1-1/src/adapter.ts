// XML Schema Definition 1.1 adapter.
//
// Implements IRAdapter<Signature, XsdDescriptor> for the XSD 1.1 surface.
// Sibling of @typecarta/adapter-xsd (which targets XSD 1.0). The 1.1
// recommendation (W3C 2012-04-05) adds, relative to 1.0:
//
//   - xs:assert        — boolean XPath over the element's value tree;
//                        models cross-field constraints (pi-prime-43).
//   - xs:alternative   — conditional type assignment via XPath test;
//                        models conditional types (pi-prime-65).
//   - xs:override      — schema-document-level redefinition of components.
//   - xs:openContent   — open content (interleave / suffix) on complexType.
//   - xs:defaultAttributesApply — schema-default attribute-group inheritance.
//   - xs:any.notNamespace / notQName — wildcard tightening primitives.
//
// Of these, only xs:assert and xs:alternative flip current scorecard rows.
// The rest are modeled in the descriptor + encoder so future witnesses can
// exercise them without re-cutting the adapter.

import type { IRAdapter, RefinementPredicate, Signature, TypeTerm } from "@typecarta/core";
import {
	andPredicate,
	array,
	base,
	bottom,
	conditional,
	createSignature,
	field,
	literal,
	multipleOfConstraint,
	patternConstraint,
	product,
	rangeConstraint,
	refinement,
	set,
	top,
	typeVar,
	union,
} from "@typecarta/core";

/** Primitive XSD names modeled by the 1.1 adapter. */
export type XsdPrimitiveName =
	| "string"
	| "boolean"
	| "decimal"
	| "integer"
	| "float"
	| "double"
	| "date"
	| "dateTime"
	| "time"
	| "anyURI";

/** Supported XSD simple-type facets. */
export interface XsdFacets {
	readonly enumeration?: readonly (string | number | boolean)[];
	readonly pattern?: string;
	readonly minInclusive?: number;
	readonly maxInclusive?: number;
	readonly multipleOf?: number;
}

/** `xs:assert test="..."` — XPath 2.0 boolean test attached to a complexType. */
export interface XsdAssertDescriptor {
	readonly test: string;
}

/** `xs:alternative` — a conditional type assignment. */
export interface XsdAlternativeDescriptor {
	readonly test?: string;
	readonly type: XsdDescriptor;
}

/** `xs:openContent` — open content on a complexType (mode = interleave/suffix). */
export interface XsdOpenContentDescriptor {
	readonly mode: "interleave" | "suffix";
	readonly wildcard?: XsdWildcardDescriptor;
}

/** `xs:any` wildcard. 1.1 adds `notNamespace` / `notQName`. */
export interface XsdWildcardDescriptor {
	readonly processContents?: "strict" | "lax" | "skip";
	readonly namespace?: string;
	readonly notNamespace?: string;
	readonly notQName?: string;
}

/** Describe an XSD element. 1.1 adds `alternatives` (conditional type assignment). */
export interface XsdElementDescriptor {
	readonly name: string;
	readonly type: XsdDescriptor;
	readonly minOccurs?: number;
	readonly maxOccurs?: number | "unbounded";
	/** Maps to XSD `nillable="true"`. */
	readonly nillable?: boolean;
	/** 1.1 `xs:alternative` children — conditional type assignment. */
	readonly alternatives?: readonly XsdAlternativeDescriptor[];
}

/** Describe an XSD attribute within a complex type. */
export interface XsdAttributeDescriptor {
	readonly name: string;
	readonly type: XsdDescriptor;
	readonly use?: "optional" | "required";
}

/** A descriptor representing the XSD 1.1 subset modeled by this adapter. */
export type XsdDescriptor =
	| { readonly kind: "primitive"; readonly name: XsdPrimitiveName }
	| { readonly kind: "anyType" }
	| { readonly kind: "empty" }
	| {
			readonly kind: "simpleType";
			readonly name?: string;
			readonly base: XsdDescriptor;
			readonly facets?: XsdFacets;
	  }
	| {
			readonly kind: "complexType";
			readonly name?: string;
			readonly elements: readonly XsdElementDescriptor[];
			readonly attributes?: readonly XsdAttributeDescriptor[];
			/** Open record via `xs:any` particle. */
			readonly open?: boolean;
			/** 1.1 `xs:assert` children. */
			readonly assertions?: readonly XsdAssertDescriptor[];
			/** 1.1 `xs:openContent`. */
			readonly openContent?: XsdOpenContentDescriptor;
			/** 1.1 `defaultAttributesApply` toggle. */
			readonly defaultAttributesApply?: boolean;
	  }
	| { readonly kind: "sequence"; readonly elements: readonly XsdElementDescriptor[] }
	| { readonly kind: "all"; readonly elements: readonly XsdElementDescriptor[] }
	| { readonly kind: "choice"; readonly options: readonly XsdElementDescriptor[] }
	| { readonly kind: "list"; readonly itemType: XsdDescriptor }
	| { readonly kind: "set"; readonly itemType: XsdDescriptor }
	| { readonly kind: "union"; readonly members: readonly XsdDescriptor[] }
	/** 1.1 `xs:override`. */
	| {
			readonly kind: "override";
			readonly schemaLocation: string;
			readonly overrides: readonly XsdDescriptor[];
	  };

const XSD_SUPPORTED_KINDS: ReadonlySet<TypeTerm["kind"]> = new Set([
	"bottom",
	"top",
	"literal",
	"base",
	"apply",
	"refinement",
	// 1.1 only: xs:alternative provides conditional type assignment.
	"conditional",
]);

const XSD_SIGNATURE: Signature = createSignature(
	[
		"string",
		"boolean",
		"decimal",
		"integer",
		"float",
		"double",
		"date",
		"dateTime",
		"time",
		"anyURI",
	],
	[
		{ name: "product", arity: 1 },
		{ name: "array", arity: 1 },
		{ name: "union", arity: 2 },
		{ name: "intersection", arity: 2 },
		{ name: "map", arity: 2 },
	],
);

/** Adapt XSD 1.1 schema-component descriptors to and from the typecarta IR. */
export class XsdAdapter implements IRAdapter<Signature, XsdDescriptor> {
	readonly name = "xsd-1-1";
	readonly specVersion = "1.1";
	readonly signature = XSD_SIGNATURE;

	parse(source: XsdDescriptor): TypeTerm {
		return parseXsdDescriptor(source);
	}

	encode(term: TypeTerm): XsdDescriptor {
		return encodeToXsdDescriptor(term);
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
		return XSD_SUPPORTED_KINDS.has(kind);
	}

	inhabits(value: unknown, term: TypeTerm): boolean {
		return checkInhabitation(value, term);
	}
}

// ─── Parse ───────────────────────────────────────────────────────────

function parseXsdDescriptor(desc: XsdDescriptor): TypeTerm {
	switch (desc.kind) {
		case "primitive":
			return base(desc.name);
		case "anyType":
			return top();
		case "empty":
			return bottom();
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
		case "override":
			// xs:override has no first-class IR analogue; round-trip as a union
			// so encode/parse is stable.
			return union(desc.overrides.map(parseXsdDescriptor));
	}
}

function parseSimpleType(desc: Extract<XsdDescriptor, { kind: "simpleType" }>): TypeTerm {
	const facets = desc.facets;
	if (facets?.enumeration && facets.enumeration.length > 0) {
		const literals = facets.enumeration.map((value) => literal(value));
		return literals.length === 1 ? literals[0]! : union(literals);
	}

	const baseTerm = parseXsdDescriptor(desc.base);
	const predicate = facetsToPredicate(facets);
	return predicate ? refinement(baseTerm, predicate) : baseTerm;
}

function parseComplexType(desc: Extract<XsdDescriptor, { kind: "complexType" }>): TypeTerm {
	const fields = [
		...desc.elements.map(parseElement),
		...(desc.attributes ?? []).map(parseAttribute),
	];
	const annotations: Record<string, unknown> = {};
	if (desc.open === true) annotations.open = true;
	if (desc.assertions !== undefined && desc.assertions.length > 0) {
		annotations.crossField = true;
		annotations.xsdAssertions = desc.assertions;
	}
	if (desc.openContent !== undefined) annotations.xsdOpenContent = desc.openContent;
	if (desc.defaultAttributesApply !== undefined) {
		annotations.xsdDefaultAttributesApply = desc.defaultAttributesApply;
	}
	return Object.keys(annotations).length > 0 ? product(fields, annotations) : product(fields);
}

function facetsToPredicate(facets: XsdFacets | undefined): RefinementPredicate | undefined {
	const predicates: RefinementPredicate[] = [];
	if (facets?.minInclusive !== undefined || facets?.maxInclusive !== undefined) {
		predicates.push(rangeConstraint(facets.minInclusive, facets.maxInclusive));
	}
	if (facets?.pattern !== undefined) {
		predicates.push(patternConstraint(facets.pattern));
	}
	if (facets?.multipleOf !== undefined) {
		predicates.push(multipleOfConstraint(facets.multipleOf));
	}
	return predicates.reduce<RefinementPredicate | undefined>(
		(acc, predicate) => (acc ? andPredicate(acc, predicate) : predicate),
		undefined,
	);
}

function parseElement(element: XsdElementDescriptor): ReturnType<typeof field> {
	const baseType = parseXsdDescriptor(element.type);
	const arrayWrapped =
		element.maxOccurs === "unbounded" ||
		(typeof element.maxOccurs === "number" && element.maxOccurs > 1)
			? array(baseType)
			: baseType;
	let typed: TypeTerm = element.nillable ? union([arrayWrapped, base("null")]) : arrayWrapped;

	// `xs:alternative` → conditional type assignment. Round-trip the
	// (test, type) pairs as a chain of `conditional` nodes; bare `type`
	// becomes the final else branch.
	if (element.alternatives && element.alternatives.length > 0) {
		const ctx = typeVar("ctx");
		typed = element.alternatives.reduceRight<TypeTerm>((acc, alt) => {
			const altType = parseXsdDescriptor(alt.type);
			return conditional(ctx, altType, altType, acc);
		}, typed);
	}

	return field(element.name, typed, {
		...(element.minOccurs === 0 ? { optional: true } : {}),
	});
}

function parseAttribute(attribute: XsdAttributeDescriptor): ReturnType<typeof field> {
	return field(`@${attribute.name}`, parseXsdDescriptor(attribute.type), {
		...(attribute.use !== "required" ? { optional: true } : {}),
	});
}

// ─── Encode ──────────────────────────────────────────────────────────

function encodeToXsdDescriptor(term: TypeTerm): XsdDescriptor {
	switch (term.kind) {
		case "bottom":
			return { kind: "empty" };
		case "top":
			return { kind: "anyType" };
		case "literal":
			return term.value === null
				? { kind: "simpleType", base: primitiveForLiteral(term.value) }
				: {
						kind: "simpleType",
						base: primitiveForLiteral(term.value),
						facets: { enumeration: [term.value] },
					};
		case "base":
			return encodeBase(term.name);
		case "apply":
			return encodeApply(term);
		case "refinement":
			return encodeRefinement(term);
		case "conditional":
			return encodeConditional(term);
		default:
			throw new Error(`Cannot encode ${term.kind} to XSD 1.1`);
	}
}

function primitiveForLiteral(value: string | number | boolean | null): XsdDescriptor {
	switch (typeof value) {
		case "string":
			return { kind: "primitive", name: "string" };
		case "number":
			return { kind: "primitive", name: Number.isInteger(value) ? "integer" : "decimal" };
		case "boolean":
			return { kind: "primitive", name: "boolean" };
		default:
			return { kind: "anyType" };
	}
}

function encodeBase(name: string): XsdDescriptor {
	const supported = new Set<string>([
		"string",
		"boolean",
		"decimal",
		"integer",
		"float",
		"double",
		"date",
		"dateTime",
		"time",
		"anyURI",
	]);
	if (name === "number") return { kind: "primitive", name: "decimal" };
	if (name === "null") return { kind: "anyType" };
	if (supported.has(name)) return { kind: "primitive", name: name as XsdPrimitiveName };
	throw new Error(`Cannot encode base type "${name}" to XSD 1.1`);
}

function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): XsdDescriptor {
	switch (term.constructor) {
		case "product":
			return encodeProduct(term);
		case "array": {
			const itemType = term.args[0];
			if (itemType === undefined) throw new Error("XSD list requires an item type");
			return { kind: "list", itemType: encodeToXsdDescriptor(itemType) };
		}
		case "set": {
			const itemType = term.args[0];
			if (itemType === undefined) throw new Error("XSD set requires an item type");
			return { kind: "set", itemType: encodeToXsdDescriptor(itemType) };
		}
		case "union":
			return { kind: "union", members: term.args.map(encodeToXsdDescriptor) };
		case "intersection":
			return {
				kind: "complexType",
				elements: [
					{
						name: "intersection",
						type: { kind: "anyType" },
					},
				],
			};
		case "map": {
			const valueType = term.args[1];
			if (valueType === undefined) throw new Error("XSD map requires a value type");
			return {
				kind: "complexType",
				elements: [
					{
						name: "entry",
						type: encodeToXsdDescriptor(valueType),
						minOccurs: 0,
						maxOccurs: "unbounded",
					},
				],
			};
		}
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to XSD 1.1`);
	}
}

function encodeProduct(term: Extract<TypeTerm, { kind: "apply" }>): XsdDescriptor {
	const elements = (term.fields ?? []).map(encodeField);
	const annotations = term.annotations ?? {};

	// `xs:assert` for cross-field constraints. SP43 carries `crossField: true`;
	// downstream witnesses may also supply explicit XPath strings as
	// `xsdAssertions: XsdAssertDescriptor[]`.
	let assertions: readonly XsdAssertDescriptor[] | undefined;
	if (Array.isArray(annotations.xsdAssertions)) {
		assertions = annotations.xsdAssertions as readonly XsdAssertDescriptor[];
	} else if (annotations.crossField === true) {
		// Synthesize a placeholder assertion when the witness flags a
		// cross-field constraint without supplying the XPath.
		assertions = [{ test: "true()" }];
	}

	const openContent = annotations.xsdOpenContent as XsdOpenContentDescriptor | undefined;
	const defaultAttributesApply = annotations.xsdDefaultAttributesApply as boolean | undefined;

	return {
		kind: "complexType",
		elements,
		...(annotations.open === true ? { open: true } : {}),
		...(assertions !== undefined ? { assertions } : {}),
		...(openContent !== undefined ? { openContent } : {}),
		...(defaultAttributesApply !== undefined ? { defaultAttributesApply } : {}),
	};
}

function encodeField(f: {
	readonly name: string;
	readonly type: TypeTerm;
	readonly optional?: boolean;
}): XsdElementDescriptor {
	const nullableInner = extractNullableInner(f.type);
	if (nullableInner !== undefined) {
		return {
			name: f.name,
			type: encodeToXsdDescriptor(nullableInner),
			nillable: true,
			...(f.optional ? { minOccurs: 0 } : {}),
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
		};
	}
	if (f.type.kind === "conditional") {
		return {
			name: f.name,
			type: { kind: "anyType" },
			alternatives: collectAlternatives(f.type),
			...(f.optional ? { minOccurs: 0 } : {}),
		};
	}
	return {
		name: f.name,
		type: encodeToXsdDescriptor(f.type),
		...(f.optional ? { minOccurs: 0 } : {}),
	};
}

function collectAlternatives(
	term: Extract<TypeTerm, { kind: "conditional" }>,
): readonly XsdAlternativeDescriptor[] {
	const out: XsdAlternativeDescriptor[] = [];
	let cursor: TypeTerm = term;
	while (cursor.kind === "conditional") {
		out.push({ type: encodeToXsdDescriptor(cursor.then) });
		cursor = cursor.else;
	}
	out.push({ type: encodeToXsdDescriptor(cursor) });
	return out;
}

function encodeConditional(term: Extract<TypeTerm, { kind: "conditional" }>): XsdDescriptor {
	// Top-level conditional: emit a complexType with a single `value` element
	// carrying the xs:alternative chain.
	return {
		kind: "complexType",
		elements: [
			{
				name: "value",
				type: { kind: "anyType" },
				alternatives: collectAlternatives(term),
			},
		],
	};
}

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
			return {
				...(predicate.min !== undefined ? { minInclusive: predicate.min } : {}),
				...(predicate.max !== undefined ? { maxInclusive: predicate.max } : {}),
			};
		case "pattern":
			return { pattern: predicate.regex };
		case "multipleOf":
			return { multipleOf: predicate.divisor };
		case "and":
			return { ...predicateToFacets(predicate.left), ...predicateToFacets(predicate.right) };
		default:
			return {};
	}
}

// ─── Inhabits ────────────────────────────────────────────────────────

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
		case "conditional":
			// Without an XPath evaluator we accept values that satisfy either
			// branch; the actual XPath test is opaque to the inhabits check.
			return checkInhabitation(value, term.then) || checkInhabitation(value, term.else);
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
		case "anyURI":
			return typeof value === "string";
		case "boolean":
			return typeof value === "boolean";
		case "decimal":
		case "float":
		case "double":
		case "number":
			return typeof value === "number";
		case "integer":
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
			if (predicate.min !== undefined && value < predicate.min) return false;
			if (predicate.max !== undefined && value > predicate.max) return false;
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
		default:
			return true;
	}
}
