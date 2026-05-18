// XML Schema Definition adapter.
//
// Implements IRAdapter<Signature, XsdDescriptor> using plain descriptor
// objects that represent XSD schema components, not an XML parser runtime.

import type {
	IRAdapter,
	RefinementPredicate,
	Signature,
	TypeTerm,
} from "@typecarta/core";
import {
	andPredicate,
	array,
	base,
	bottom,
	createSignature,
	field,
	literal,
	multipleOfConstraint,
	patternConstraint,
	product,
	rangeConstraint,
	refinement,
	top,
	union,
} from "@typecarta/core";

/** Primitive XSD names modeled by the default XSD adapter. */
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

/** Describe an XSD element within complex types, sequences, choices, and all groups. */
export interface XsdElementDescriptor {
	readonly name: string;
	readonly type: XsdDescriptor;
	readonly minOccurs?: number;
	readonly maxOccurs?: number | "unbounded";
}

/** Describe an XSD attribute within a complex type. */
export interface XsdAttributeDescriptor {
	readonly name: string;
	readonly type: XsdDescriptor;
	readonly use?: "optional" | "required";
}

/** A descriptor object representing the XSD subset supported by this adapter. */
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
	  }
	| { readonly kind: "sequence"; readonly elements: readonly XsdElementDescriptor[] }
	| { readonly kind: "all"; readonly elements: readonly XsdElementDescriptor[] }
	| { readonly kind: "choice"; readonly options: readonly XsdElementDescriptor[] }
	| { readonly kind: "list"; readonly itemType: XsdDescriptor }
	| { readonly kind: "union"; readonly members: readonly XsdDescriptor[] };

const XSD_SUPPORTED_KINDS: ReadonlySet<TypeTerm["kind"]> = new Set([
	"bottom",
	"top",
	"literal",
	"base",
	"apply",
	"refinement",
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

/** Adapt XSD schema-component descriptors to and from the typecarta IR. */
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
			return product([
				...desc.elements.map(parseElement),
				...(desc.attributes ?? []).map(parseAttribute),
			]);
		case "sequence":
		case "all":
			return product(desc.elements.map(parseElement));
		case "choice":
			return union(desc.options.map((option) => parseXsdDescriptor(option.type)));
		case "list":
			return array(parseXsdDescriptor(desc.itemType));
		case "union":
			return union(desc.members.map(parseXsdDescriptor));
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
	const parsedType = parseXsdDescriptor(element.type);
	const type =
		element.maxOccurs === "unbounded" ||
		(typeof element.maxOccurs === "number" && element.maxOccurs > 1)
			? array(parsedType)
			: parsedType;
	return field(element.name, type, {
		...(element.minOccurs === 0 ? { optional: true } : {}),
	});
}

function parseAttribute(attribute: XsdAttributeDescriptor): ReturnType<typeof field> {
	return field(`@${attribute.name}`, parseXsdDescriptor(attribute.type), {
		...(attribute.use !== "required" ? { optional: true } : {}),
	});
}

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
		default:
			throw new Error(`Cannot encode ${term.kind} to XSD`);
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
	if (supported.has(name)) return { kind: "primitive", name: name as XsdPrimitiveName };
	throw new Error(`Cannot encode base type "${name}" to XSD`);
}

function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): XsdDescriptor {
	switch (term.constructor) {
		case "product":
			return {
				kind: "complexType",
				elements: (term.fields ?? []).map(encodeField),
			};
		case "array": {
			const itemType = term.args[0];
			if (itemType === undefined) throw new Error("XSD list requires an item type");
			return { kind: "list", itemType: encodeToXsdDescriptor(itemType) };
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
			throw new Error(`Cannot encode constructor "${term.constructor}" to XSD`);
	}
}

function encodeField(f: {
	readonly name: string;
	readonly type: TypeTerm;
	readonly optional?: boolean;
}): XsdElementDescriptor {
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
	return {
		name: f.name,
		type: encodeToXsdDescriptor(f.type),
		...(f.optional ? { minOccurs: 0 } : {}),
	};
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
