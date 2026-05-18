// SHACL (Shapes Constraint Language) adapter.
//
// Implements IRAdapter<Signature, ShaclDescriptor> for the SHACL Core +
// SHACL-SPARQL surface defined by the W3C 2017 Recommendation:
// https://www.w3.org/TR/2017/REC-shacl-20170720/
//
// SHACL describes constraints on RDF graphs. Two important caveats apply
// when projecting it onto typecarta's tree-shaped IR:
//
//   1. SHACL is graph-based. NodeShapes can reference one another via
//      `sh:node`, including cycles. We model cycles via `mu` when the
//      `supportsKind` set includes it; otherwise the recursive reference
//      collapses to `extension`.
//   2. SHACL uses SPARQL property paths. The IR has no path-expression
//      construct, so the encoder records the path as a descriptor field
//      but the parser collapses non-trivial paths to their first IRI
//      component and emits a `pathLoss: true` annotation.
//
// See docs/guides/shacl-scorecard-audit.md for the full per-feature
// projection table and what gets lost.

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
	complement,
	createSignature,
	extension,
	field,
	intersection,
	literal,
	nominal,
	patternConstraint,
	product,
	rangeConstraint,
	refinement,
	top,
	union,
} from "@typecarta/core";

// ─── Descriptor types ────────────────────────────────────────────────

/** XSD datatype IRIs reachable from `sh:datatype` and recognized for round-trip. */
export type ShaclDatatype =
	| "xsd:string"
	| "xsd:integer"
	| "xsd:decimal"
	| "xsd:boolean"
	| "xsd:double"
	| "xsd:float"
	| "xsd:date"
	| "xsd:dateTime"
	| "xsd:time"
	| "xsd:anyURI"
	| (string & {});

/** `sh:nodeKind` value. */
export type ShaclNodeKind =
	| "sh:IRI"
	| "sh:Literal"
	| "sh:BlankNode"
	| "sh:BlankNodeOrIRI"
	| "sh:BlankNodeOrLiteral"
	| "sh:IRIOrLiteral";

/** Severity attached to a violation. */
export type ShaclSeverity = "sh:Violation" | "sh:Warning" | "sh:Info";

/** A SPARQL property path expression. */
export type ShaclPath =
	| string
	| { readonly inverse: ShaclPath }
	| { readonly alternative: readonly ShaclPath[] }
	| { readonly sequence: readonly ShaclPath[] }
	| { readonly zeroOrMore: ShaclPath }
	| { readonly oneOrMore: ShaclPath }
	| { readonly zeroOrOne: ShaclPath };

/** Target declaration on a NodeShape. */
export interface ShaclTarget {
	readonly targetClass?: string;
	readonly targetNode?: readonly string[];
	readonly targetSubjectsOf?: readonly string[];
	readonly targetObjectsOf?: readonly string[];
}

/** SHACL-SPARQL: an opaque SPARQL constraint attached to a shape. */
export interface ShaclSparqlConstraint {
	/** `sh:ask` or `sh:select` query. */
	readonly query: string;
	/** Prefix declarations (`sh:prefixes`). */
	readonly prefixes?: ReadonlyMap<string, string>;
	/** `sh:message`. */
	readonly message?: string;
	/** `sh:severity` of the constraint. */
	readonly severity?: ShaclSeverity;
}

/** Cross-pair constraint components: `sh:equals`, `sh:disjoint`, `sh:lessThan`, `sh:lessThanOrEquals`. */
export interface ShaclPairConstraint {
	readonly kind: "equals" | "disjoint" | "lessThan" | "lessThanOrEquals";
	/** IRI of the property being compared. */
	readonly other: string;
}

/** Qualified value-shape cardinality: `sh:qualifiedValueShape` + qualified counts. */
export interface ShaclQualifiedConstraint {
	readonly shape: ShaclShape;
	readonly minCount?: number;
	readonly maxCount?: number;
	readonly disjoint?: boolean;
}

/** A PropertyShape — constraint set on values reached via `sh:path`. */
export interface ShaclPropertyShape {
	readonly kind: "PropertyShape";
	readonly path: ShaclPath;
	readonly name?: string;
	readonly description?: string;
	readonly datatype?: ShaclDatatype;
	readonly nodeKind?: ShaclNodeKind;
	readonly class?: readonly string[];
	readonly node?: ShaclShape;
	readonly hasValue?: readonly (string | number | boolean)[];
	readonly in?: readonly (string | number | boolean)[];
	readonly pattern?: { readonly regex: string; readonly flags?: string };
	readonly minCount?: number;
	readonly maxCount?: number;
	readonly minInclusive?: number;
	readonly maxInclusive?: number;
	readonly minExclusive?: number;
	readonly maxExclusive?: number;
	readonly minLength?: number;
	readonly maxLength?: number;
	readonly languageIn?: readonly string[];
	readonly uniqueLang?: boolean;
	readonly and?: readonly ShaclShape[];
	readonly or?: readonly ShaclShape[];
	readonly not?: ShaclShape;
	readonly xone?: readonly ShaclShape[];
	readonly pair?: readonly ShaclPairConstraint[];
	readonly qualified?: ShaclQualifiedConstraint;
	readonly sparql?: readonly ShaclSparqlConstraint[];
	readonly defaultValue?: string | number | boolean;
	readonly deactivated?: boolean;
	readonly severity?: ShaclSeverity;
	readonly message?: string;
}

/** A NodeShape — constraint set on a focus node. */
export interface ShaclNodeShape {
	readonly kind: "NodeShape";
	readonly id?: string;
	readonly target?: ShaclTarget;
	readonly properties?: readonly ShaclPropertyShape[];
	readonly closed?: boolean;
	readonly ignoredProperties?: readonly string[];
	readonly class?: readonly string[];
	readonly nodeKind?: ShaclNodeKind;
	readonly datatype?: ShaclDatatype;
	readonly hasValue?: readonly (string | number | boolean)[];
	readonly in?: readonly (string | number | boolean)[];
	readonly and?: readonly ShaclShape[];
	readonly or?: readonly ShaclShape[];
	readonly not?: ShaclShape;
	readonly xone?: readonly ShaclShape[];
	readonly sparql?: readonly ShaclSparqlConstraint[];
	readonly deactivated?: boolean;
	readonly severity?: ShaclSeverity;
	readonly message?: string;
}

/** A reference to a named shape elsewhere in the shapes graph. */
export interface ShaclShapeRef {
	readonly kind: "ShapeRef";
	readonly iri: string;
}

/** The top-level descriptor for any shape the adapter consumes/produces. */
export type ShaclShape = ShaclNodeShape | ShaclPropertyShape | ShaclShapeRef;

/** Alias used as the adapter's Native type. */
export type ShaclDescriptor = ShaclShape;

// ─── Adapter ─────────────────────────────────────────────────────────

const SHACL_SUPPORTED_KINDS: ReadonlySet<TypeTerm["kind"]> = new Set([
	"bottom",
	"top",
	"literal",
	"base",
	"apply",
	"refinement",
	"nominal",
	"complement",
	"mu",
	"let",
	"extension",
]);

const SHACL_SIGNATURE: Signature = createSignature(
	[
		"string",
		"integer",
		"decimal",
		"boolean",
		"double",
		"float",
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
	],
);

/** Adapt SHACL shape descriptors to and from the typecarta IR. */
export class ShaclAdapter implements IRAdapter<Signature, ShaclDescriptor> {
	readonly name = "shacl-1-0";
	readonly specVersion = "1.0";
	readonly signature = SHACL_SIGNATURE;

	parse(source: ShaclDescriptor): TypeTerm {
		return parseShacl(source);
	}

	encode(term: TypeTerm): ShaclDescriptor {
		return encodeToShacl(term);
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
		return SHACL_SUPPORTED_KINDS.has(kind);
	}

	inhabits(value: unknown, term: TypeTerm): boolean {
		return checkInhabitation(value, term);
	}
}

// ─── Parse: ShaclDescriptor → TypeTerm ───────────────────────────────

function parseShacl(desc: ShaclDescriptor): TypeTerm {
	switch (desc.kind) {
		case "NodeShape":
			return parseNodeShape(desc);
		case "PropertyShape":
			return parsePropertyShape(desc);
		case "ShapeRef":
			// `sh:node` reference to a named shape. Without resolution we model
			// it as an extension node carrying the IRI; downstream tooling can
			// substitute the resolved term.
			return extension("shacl-shape-ref", { iri: desc.iri });
	}
}

function parseNodeShape(desc: ShaclNodeShape): TypeTerm {
	const hasProperties = (desc.properties?.length ?? 0) > 0;
	const hasStructuralAnnotations =
		desc.closed !== undefined ||
		desc.target !== undefined ||
		desc.deactivated !== undefined ||
		desc.severity !== undefined;

	// If the NodeShape carries only a top-level datatype (no properties,
	// no logical combinators, no class), it's modeling "this focus is a
	// literal of this type" — collapse to a bare base.
	if (
		!hasProperties &&
		!hasStructuralAnnotations &&
		desc.datatype !== undefined &&
		desc.in === undefined &&
		desc.hasValue === undefined &&
		desc.class === undefined &&
		desc.and === undefined &&
		desc.or === undefined &&
		desc.not === undefined &&
		desc.xone === undefined &&
		desc.sparql === undefined
	) {
		return datatypeToBase(desc.datatype);
	}

	const fields = (desc.properties ?? []).map(parseProperty);
	let term: TypeTerm = product(fields, {
		...(desc.closed === false ? { open: true } : {}),
		...(desc.closed === true && (desc.ignoredProperties?.length ?? 0) > 0
			? { open: true, ignored: desc.ignoredProperties }
			: {}),
		...(desc.target !== undefined ? { shaclTarget: desc.target } : {}),
		...(desc.deactivated === true ? { deactivated: true } : {}),
		...(desc.severity !== undefined ? { severity: desc.severity } : {}),
	});

	if (desc.class !== undefined && desc.class.length > 0) {
		// `sh:class` on a NodeShape requires the focus to be an instance of
		// one of the listed classes. Wrap in a nominal node with the first
		// class as the tag (additional classes are preserved as annotation).
		const [primary, ...rest] = desc.class;
		if (primary !== undefined) {
			term = nominal(
				primary,
				term,
				false,
				rest.length > 0 ? { shaclAdditionalClasses: rest } : undefined,
			);
		}
	}

	term = applyLogicalCombinators(term, desc);

	if (desc.in !== undefined && desc.in.length > 0) {
		term = union(desc.in.map((v) => literal(v)));
	} else if (desc.hasValue !== undefined && desc.hasValue.length > 0) {
		term =
			desc.hasValue.length === 1
				? literal(desc.hasValue[0]!)
				: union(desc.hasValue.map((v) => literal(v)));
	}

	if (desc.sparql !== undefined && desc.sparql.length > 0) {
		// SHACL-SPARQL constraints are opaque to the IR; carry them as an
		// extension node alongside the structural term.
		term = intersection([term, extension("shacl-sparql", { constraints: desc.sparql })]);
	}

	return term;
}

function parseProperty(desc: ShaclPropertyShape): ReturnType<typeof field> {
	const name = pathToFieldName(desc.path);
	let inner = parsePropertyValueType(desc);

	const minCount = desc.minCount ?? 0;
	const maxCount = desc.maxCount;
	const isArray = maxCount === undefined || maxCount > 1;
	const optional = minCount === 0;
	if (isArray) inner = array(inner);

	const annotations: Record<string, unknown> = {};
	if (typeof desc.path !== "string") {
		annotations.pathLoss = true;
		annotations.shaclPath = desc.path;
	}
	if (desc.qualified !== undefined) annotations.shaclQualified = desc.qualified;
	if (desc.pair !== undefined) annotations.crossField = true;
	if (desc.pair !== undefined) annotations.shaclPair = desc.pair;
	if (desc.languageIn !== undefined) annotations.shaclLanguageIn = desc.languageIn;
	if (desc.uniqueLang) annotations.shaclUniqueLang = true;
	if (desc.nodeKind !== undefined) annotations.shaclNodeKind = desc.nodeKind;
	if (desc.deactivated) annotations.deactivated = true;

	return field(name, inner, {
		...(optional ? { optional: true } : {}),
		...(desc.defaultValue !== undefined ? { defaultValue: desc.defaultValue } : {}),
		...(Object.keys(annotations).length > 0 ? { annotations } : {}),
	});
}

function parsePropertyValueType(desc: ShaclPropertyShape): TypeTerm {
	let value: TypeTerm = desc.datatype ? datatypeToBase(desc.datatype) : top();

	if (desc.in !== undefined && desc.in.length > 0) {
		value = desc.in.length === 1 ? literal(desc.in[0]!) : union(desc.in.map((v) => literal(v)));
	} else if (desc.hasValue !== undefined && desc.hasValue.length === 1) {
		value = literal(desc.hasValue[0]!);
	}

	const predicate = predicateForProperty(desc);
	if (predicate !== undefined) {
		value = refinement(value, predicate);
	}

	if (desc.class !== undefined && desc.class.length > 0) {
		const [primary, ...rest] = desc.class;
		if (primary !== undefined) {
			value = nominal(
				primary,
				value,
				false,
				rest.length > 0 ? { shaclAdditionalClasses: rest } : undefined,
			);
		}
	}

	if (desc.node !== undefined) {
		// Combine the property's own constraints with the referenced shape.
		const nested = parseShacl(desc.node);
		value = intersection([value, nested]);
	}

	value = applyLogicalCombinators(value, desc);
	return value;
}

function applyLogicalCombinators<T extends ShaclNodeShape | ShaclPropertyShape>(
	term: TypeTerm,
	desc: T,
): TypeTerm {
	if (desc.and !== undefined && desc.and.length > 0) {
		term = intersection([term, ...desc.and.map(parseShacl)]);
	}
	if (desc.or !== undefined && desc.or.length > 0) {
		term = union([term, ...desc.or.map(parseShacl)]);
	}
	if (desc.not !== undefined) {
		term = intersection([term, complement(parseShacl(desc.not))]);
	}
	if (desc.xone !== undefined && desc.xone.length > 0) {
		// `sh:xone` (exclusive or) has no native IR construct. Fall back to a
		// union with an `xor: true` annotation so the parse layer is at least
		// honest about the projection.
		const u = union(desc.xone.map(parseShacl));
		term = intersection([term, extension("shacl-xone", { branches: u })]);
	}
	return term;
}

function predicateForProperty(desc: ShaclPropertyShape): RefinementPredicate | undefined {
	const predicates: RefinementPredicate[] = [];
	if (desc.minInclusive !== undefined || desc.maxInclusive !== undefined) {
		predicates.push(rangeConstraint(desc.minInclusive, desc.maxInclusive));
	}
	if (desc.minExclusive !== undefined || desc.maxExclusive !== undefined) {
		predicates.push(rangeConstraint(desc.minExclusive, desc.maxExclusive, true));
	}
	if (desc.pattern !== undefined) {
		predicates.push(patternConstraint(desc.pattern.regex));
	}
	// minLength / maxLength operate on string length; the IR's rangeConstraint
	// is value-based. Represented as a custom predicate so the bytes survive
	// round-trip even though semantics are best-effort.
	if (desc.minLength !== undefined || desc.maxLength !== undefined) {
		predicates.push({
			kind: "custom",
			name: "stringLength",
			params: {
				...(desc.minLength !== undefined ? { min: desc.minLength } : {}),
				...(desc.maxLength !== undefined ? { max: desc.maxLength } : {}),
			},
		});
	}
	return predicates.reduce<RefinementPredicate | undefined>(
		(acc, p) => (acc ? andPredicate(acc, p) : p),
		undefined,
	);
}

function parsePropertyShape(desc: ShaclPropertyShape): TypeTerm {
	// A top-level PropertyShape (rare; usually nested inside a NodeShape).
	// Surface as a single-field product so the constraint is visible.
	return product([parseProperty(desc)]);
}

function pathToFieldName(path: ShaclPath): string {
	if (typeof path === "string") return localName(path);
	if ("inverse" in path) return `~${pathToFieldName(path.inverse)}`;
	if ("alternative" in path) {
		return path.alternative.map(pathToFieldName).join("|");
	}
	if ("sequence" in path) {
		return path.sequence.map(pathToFieldName).join("/");
	}
	if ("zeroOrMore" in path) return `${pathToFieldName(path.zeroOrMore)}*`;
	if ("oneOrMore" in path) return `${pathToFieldName(path.oneOrMore)}+`;
	if ("zeroOrOne" in path) return `${pathToFieldName(path.zeroOrOne)}?`;
	return "?";
}

function localName(iri: string): string {
	const hash = iri.lastIndexOf("#");
	if (hash >= 0) return iri.slice(hash + 1);
	const slash = iri.lastIndexOf("/");
	if (slash >= 0) return iri.slice(slash + 1);
	const colon = iri.lastIndexOf(":");
	if (colon >= 0) return iri.slice(colon + 1);
	return iri;
}

function datatypeToBase(dt: ShaclDatatype): TypeTerm {
	switch (dt) {
		case "xsd:string":
			return base("string");
		case "xsd:integer":
			return base("integer");
		case "xsd:decimal":
			return base("decimal");
		case "xsd:boolean":
			return base("boolean");
		case "xsd:double":
			return base("double");
		case "xsd:float":
			return base("float");
		case "xsd:date":
			return base("date");
		case "xsd:dateTime":
			return base("dateTime");
		case "xsd:time":
			return base("time");
		case "xsd:anyURI":
			return base("anyURI");
		default:
			return base("string");
	}
}

// ─── Encode: TypeTerm → ShaclDescriptor ──────────────────────────────

function encodeToShacl(term: TypeTerm): ShaclDescriptor {
	switch (term.kind) {
		case "bottom":
			return { kind: "NodeShape", in: [] };
		case "top":
			return { kind: "NodeShape" };
		case "literal":
			return { kind: "NodeShape", hasValue: [literalValue(term.value)] };
		case "base":
			return { kind: "NodeShape", datatype: baseToDatatype(term.name) };
		case "apply":
			return encodeApply(term);
		case "refinement":
			return encodeRefinement(term);
		case "nominal":
			return encodeNominal(term);
		case "complement":
			return { kind: "NodeShape", not: encodeToShacl(term.inner) };
		case "mu":
			// SHACL has no first-class fixed-point; the standard idiom is to
			// give the shape an IRI and reference it via `sh:node`. Without
			// IRI minting we fall back to encoding the body once and tagging
			// the result with a `recursive: true` extension constraint.
			return {
				kind: "NodeShape",
				and: [
					encodeToShacl(term.body) as ShaclShape,
					{ kind: "ShapeRef", iri: `_:${term.var}` },
				],
			};
		case "let":
			// `let n = body in expr` — emit as a NodeShape whose `id` is the
			// alias name and inner constraints are those of the body.
			return {
				...(encodeToShacl(term.body) as ShaclNodeShape),
				id: term.name,
			};
		case "extension":
			// Round-trip the IR's extension envelope as a SHACL-SPARQL stub.
			return {
				kind: "NodeShape",
				sparql: [
					{
						query: `# extension: ${term.extensionKind}`,
					},
				],
			};
		default:
			throw new Error(`Cannot encode ${term.kind} to SHACL`);
	}
}

function literalValue(value: string | number | boolean | null): string | number | boolean {
	return value === null ? "" : value;
}

function baseToDatatype(name: string): ShaclDatatype {
	switch (name) {
		case "string":
			return "xsd:string";
		case "integer":
			return "xsd:integer";
		case "decimal":
		case "number":
			return "xsd:decimal";
		case "boolean":
			return "xsd:boolean";
		case "double":
			return "xsd:double";
		case "float":
			return "xsd:float";
		case "date":
			return "xsd:date";
		case "dateTime":
			return "xsd:dateTime";
		case "time":
			return "xsd:time";
		case "anyURI":
			return "xsd:anyURI";
		case "null":
			return "xsd:string"; // best-effort; SHACL has no native null
		default:
			return name as ShaclDatatype;
	}
}

function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): ShaclDescriptor {
	switch (term.constructor) {
		case "product":
			return encodeProduct(term);
		case "array": {
			const item = term.args[0];
			if (item === undefined) throw new Error("SHACL array requires an item type");
			// Top-level array of T → a NodeShape with a single property
			// `member` carrying T and unbounded count.
			return {
				kind: "NodeShape",
				properties: [
					{
						kind: "PropertyShape",
						path: "rdf:member",
						...propertyConstraintsFor(item),
						minCount: 0,
					},
				],
			};
		}
		case "union":
			return { kind: "NodeShape", or: term.args.map(encodeToShacl) as readonly ShaclShape[] };
		case "intersection":
			return { kind: "NodeShape", and: term.args.map(encodeToShacl) as readonly ShaclShape[] };
		case "set":
			// SHACL has no native set type; encode as array.
			return encodeApply({ ...term, constructor: "array" });
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to SHACL`);
	}
}

function encodeProduct(term: Extract<TypeTerm, { kind: "apply" }>): ShaclNodeShape {
	const properties = (term.fields ?? []).map(fieldToProperty);
	const annotations = term.annotations ?? {};
	const openAnn = annotations.open === true;
	const closed = !openAnn;
	const ignored = Array.isArray(annotations.ignored)
		? (annotations.ignored as readonly string[])
		: undefined;
	const sparql = Array.isArray(annotations.shaclSparql)
		? (annotations.shaclSparql as readonly ShaclSparqlConstraint[])
		: annotations.crossField === true
			? ([{ query: "ASK { FILTER(true) }" }] satisfies readonly ShaclSparqlConstraint[])
			: undefined;

	const shape: ShaclNodeShape = {
		kind: "NodeShape",
		properties,
		closed,
		...(ignored !== undefined ? { ignoredProperties: ignored } : {}),
		...(sparql !== undefined ? { sparql } : {}),
	};
	return shape;
}

function fieldToProperty(f: {
	readonly name: string;
	readonly type: TypeTerm;
	readonly optional?: boolean;
	readonly defaultValue?: unknown;
}): ShaclPropertyShape {
	let inner = f.type;
	let isArray = false;
	if (inner.kind === "apply" && (inner.constructor === "array" || inner.constructor === "set")) {
		const itemType = inner.args[0];
		if (itemType === undefined) throw new Error(`Array field "${f.name}" has no item type`);
		inner = itemType;
		isArray = true;
	}
	const constraints = propertyConstraintsFor(inner);
	const defaultValue = f.defaultValue;
	return {
		kind: "PropertyShape",
		path: f.name,
		...constraints,
		...(f.optional ? { minCount: 0 } : { minCount: 1 }),
		...(isArray ? {} : constraints.maxCount === undefined ? { maxCount: 1 } : {}),
		...(typeof defaultValue === "string" ||
		typeof defaultValue === "number" ||
		typeof defaultValue === "boolean"
			? { defaultValue }
			: {}),
	};
}

function propertyConstraintsFor(term: TypeTerm): Partial<ShaclPropertyShape> {
	switch (term.kind) {
		case "base":
			return { datatype: baseToDatatype(term.name) };
		case "literal":
			return { hasValue: [literalValue(term.value)] };
		case "refinement":
			return {
				...propertyConstraintsFor(term.base),
				...predicateToShaclConstraints(term.predicate),
			};
		case "apply":
			if (term.constructor === "union") {
				const literals = term.args.filter((t): t is Extract<TypeTerm, { kind: "literal" }> =>
					t.kind === "literal",
				);
				if (literals.length === term.args.length) {
					return { in: literals.map((l) => literalValue(l.value)) };
				}
				return { or: term.args.map(encodeToShacl) as readonly ShaclShape[] };
			}
			if (term.constructor === "intersection") {
				return { and: term.args.map(encodeToShacl) as readonly ShaclShape[] };
			}
			if (term.constructor === "product") {
				return { node: encodeToShacl(term) as ShaclShape };
			}
			return { node: encodeToShacl(term) as ShaclShape };
		case "nominal":
			return {
				class: [term.tag],
				...propertyConstraintsFor(term.inner),
			};
		case "complement":
			return { not: encodeToShacl(term.inner) as ShaclShape };
		case "top":
			return {};
		case "bottom":
			return { in: [] };
		default:
			return { node: encodeToShacl(term) as ShaclShape };
	}
}

function predicateToShaclConstraints(p: RefinementPredicate): Partial<ShaclPropertyShape> {
	switch (p.kind) {
		case "range":
			return {
				...(p.min !== undefined
					? p.exclusive
						? { minExclusive: p.min }
						: { minInclusive: p.min }
					: {}),
				...(p.max !== undefined
					? p.exclusive
						? { maxExclusive: p.max }
						: { maxInclusive: p.max }
					: {}),
			};
		case "pattern":
			return { pattern: { regex: p.regex } };
		case "multipleOf":
			// SHACL has no multipleOf facet. Best-effort: encode as a SPARQL
			// constraint so the bytes survive but semantics are external.
			return {
				sparql: [
					{
						query: `ASK { FILTER(?value mod ${p.divisor} = 0) }`,
					},
				],
			};
		case "custom":
			if (p.name === "stringLength" && p.params) {
				const params = p.params as { min?: number; max?: number };
				return {
					...(params.min !== undefined ? { minLength: params.min } : {}),
					...(params.max !== undefined ? { maxLength: params.max } : {}),
				};
			}
			return {};
		case "and":
			return {
				...predicateToShaclConstraints(p.left),
				...predicateToShaclConstraints(p.right),
			};
		case "or":
		case "not":
			return {};
		default:
			return {};
	}
}

function encodeRefinement(term: Extract<TypeTerm, { kind: "refinement" }>): ShaclDescriptor {
	const baseDesc = encodeToShacl(term.base) as ShaclNodeShape;
	const constraints = predicateToShaclConstraints(term.predicate);
	return {
		...baseDesc,
		properties: [
			...(baseDesc.properties ?? []),
			...(Object.keys(constraints).length > 0
				? [
						{
							kind: "PropertyShape" as const,
							path: "rdf:value",
							...constraints,
						},
					]
				: []),
		],
	};
}

function encodeNominal(term: Extract<TypeTerm, { kind: "nominal" }>): ShaclDescriptor {
	const inner = encodeToShacl(term.inner) as ShaclNodeShape;
	return {
		...inner,
		class: [term.tag, ...(inner.class ?? [])],
	};
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
		case "nominal":
			return checkInhabitation(value, term.inner);
		case "complement":
			return !checkInhabitation(value, term.inner);
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
		case "double":
		case "float":
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
		case "array":
		case "set": {
			const item = term.args[0];
			return (
				Array.isArray(value) &&
				item !== undefined &&
				value.every((v) => checkInhabitation(v, item))
			);
		}
		case "union":
			return term.args.some((a) => checkInhabitation(value, a));
		case "intersection":
			return term.args.every((a) => checkInhabitation(value, a));
		default:
			return false;
	}
}

function checkPredicateInhabitation(value: unknown, p: RefinementPredicate): boolean {
	switch (p.kind) {
		case "range":
			if (typeof value !== "number") return false;
			if (p.min !== undefined) {
				if (p.exclusive ? value <= p.min : value < p.min) return false;
			}
			if (p.max !== undefined) {
				if (p.exclusive ? value >= p.max : value > p.max) return false;
			}
			return true;
		case "pattern":
			return typeof value === "string" && new RegExp(p.regex).test(value);
		case "multipleOf":
			return typeof value === "number" && value % p.divisor === 0;
		case "and":
			return (
				checkPredicateInhabitation(value, p.left) && checkPredicateInhabitation(value, p.right)
			);
		case "or":
			return (
				checkPredicateInhabitation(value, p.left) || checkPredicateInhabitation(value, p.right)
			);
		case "not":
			return !checkPredicateInhabitation(value, p.inner);
		case "custom":
			if (p.name === "stringLength" && p.params && typeof value === "string") {
				const params = p.params as { min?: number; max?: number };
				if (params.min !== undefined && value.length < params.min) return false;
				if (params.max !== undefined && value.length > params.max) return false;
				return true;
			}
			return true;
		default:
			return true;
	}
}
