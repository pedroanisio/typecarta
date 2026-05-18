// Shared XSD adapter engine.
//
// Provides parse / encode / inhabits / supportsKind implementations that can
// be configured for either the XSD 1.0 or 1.1 surface. Version-specific
// behavior plugs in via the `XsdEngineConfig` knobs.

import type { RefinementPredicate, TypeTerm } from "@typecarta/core";
import {
	andPredicate,
	array,
	base,
	bottom,
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
import { BASE_SUPPORTED_KINDS } from "./catalog.js";
import type {
	XsdAlternative,
	XsdAnnotation,
	XsdAttributeDescriptor,
	XsdBuiltinName,
	XsdDerivationToken,
	XsdDescriptor,
	XsdElementDescriptor,
	XsdFacets,
	XsdIdentityConstraint,
} from "./types.js";

/** Hook signature for intercepting one of the recursive helpers. */
export type XsdEncodeHook = (
	term: TypeTerm,
	ctx: XsdEngine,
) => XsdDescriptor | undefined;

/** Hook signature for the parse side. */
export type XsdParseHook = (
	desc: XsdDescriptor,
	ctx: XsdEngine,
) => TypeTerm | undefined;

/** Per-version engine configuration. */
export interface XsdEngineConfig {
	/** Allowed built-in names; rejects everything else from base("…"). */
	readonly builtinNames: ReadonlySet<string>;
	/** Allowed facet keys; rejects everything else when encoding refinements. */
	readonly allowedFacets: ReadonlySet<string>;
	/**
	 * `TypeTerm["kind"]` values this engine handles. Defaults to
	 * {@link BASE_SUPPORTED_KINDS}.
	 */
	readonly supportedKinds?: ReadonlySet<TypeTerm["kind"]>;
	/**
	 * Pre-hook called from `encode` before the core dispatch runs. Return a
	 * descriptor to short-circuit; return undefined to let the core handle it.
	 */
	readonly encodeHook?: XsdEncodeHook;
	/**
	 * Pre-hook called from `parse` before the core dispatch runs. Same
	 * short-circuit convention as {@link encodeHook}.
	 */
	readonly parseHook?: XsdParseHook;
}

/** The engine API consumed by adapter wrappers (and by recursive helpers). */
export interface XsdEngine {
	readonly config: XsdEngineConfig;
	parse(desc: XsdDescriptor): TypeTerm;
	encode(term: TypeTerm): XsdDescriptor;
	inhabits(value: unknown, term: TypeTerm): boolean;
	supportsKind(kind: TypeTerm["kind"]): boolean;
}

export function createEngine(config: XsdEngineConfig): XsdEngine {
	const supportedKinds = config.supportedKinds ?? BASE_SUPPORTED_KINDS;

	const engine: XsdEngine = {
		config,
		parse(desc) {
			const hooked = config.parseHook?.(desc, engine);
			if (hooked !== undefined) return hooked;
			return parseXsd(desc, engine);
		},
		encode(term) {
			const hooked = config.encodeHook?.(term, engine);
			if (hooked !== undefined) return hooked;
			return encodeTerm(term, engine);
		},
		inhabits(value, term) {
			return checkInhabitation(value, term, engine);
		},
		supportsKind(kind) {
			return supportedKinds.has(kind);
		},
	};
	return engine;
}

// ─── Parse ───────────────────────────────────────────────────────────

function parseXsd(desc: XsdDescriptor, ctx: XsdEngine): TypeTerm {
	switch (desc.kind) {
		case "primitive":
			return base(desc.name);
		case "anyType":
			return top();
		case "empty":
			return bottom();
		case "ref":
			return nominal(desc.name, top());
		case "simpleType":
			return parseSimpleType(desc, ctx);
		case "complexType":
			return parseComplexType(desc, ctx);
		case "sequence":
		case "all":
			return product(desc.elements.map((e) => parseElement(e, ctx)));
		case "choice":
			return union(desc.options.map((option) => ctx.parse(option.type)));
		case "list":
			return array(ctx.parse(desc.itemType));
		case "set":
			return set(ctx.parse(desc.itemType));
		case "union":
			return union(desc.members.map((m) => ctx.parse(m)));
		case "group":
			return letBinding(desc.name, ctx.parse(desc.body), base(desc.name));
		case "attributeGroup": {
			const fields = desc.attributes.map((a) => parseAttribute(a, ctx));
			return letBinding(desc.name, product(fields), base(desc.name));
		}
		case "schema":
			return parseSchema(desc, ctx);
	}
}

function parseSimpleType(
	desc: Extract<XsdDescriptor, { kind: "simpleType" }>,
	ctx: XsdEngine,
): TypeTerm {
	const facets = desc.facets;
	const baseTerm = ctx.parse(desc.base);
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

function parseComplexType(
	desc: Extract<XsdDescriptor, { kind: "complexType" }>,
	ctx: XsdEngine,
): TypeTerm {
	const fields = [
		...desc.elements.map((e) => parseElement(e, ctx)),
		...(desc.attributes ?? []).map((a) => parseAttribute(a, ctx)),
	];
	const annotations: Record<string, unknown> = {};
	if (desc.wildcard !== undefined) annotations.open = true;
	if (desc.annotation?.documentation !== undefined) {
		annotations.documentation = desc.annotation.documentation;
	}
	if (desc.annotation?.appinfo !== undefined) annotations.appinfo = desc.annotation.appinfo;
	if (desc.final !== undefined) annotations.final = desc.final;
	if (desc.block !== undefined) annotations.block = desc.block;
	// 1.1: lift xs:assert and xs:openContent into IR annotations so the
	// 1.1 encoder can round-trip them. 1.0 just ignores these on encode.
	if (desc.assertions !== undefined && desc.assertions.length > 0) {
		annotations.xsdAssertions = desc.assertions;
		annotations.crossField = true;
	}
	if (desc.openContent !== undefined) annotations.xsdOpenContent = desc.openContent;
	if (desc.defaultAttributesApply !== undefined) {
		annotations.xsdDefaultAttributesApply = desc.defaultAttributesApply;
	}

	const productTerm =
		Object.keys(annotations).length > 0 ? product(fields, annotations) : product(fields);

	let body: TypeTerm = productTerm;
	for (const c of desc.identityConstraints ?? []) {
		body = parseIdentityConstraint(c, body);
	}
	if (desc.extends !== undefined) {
		body = extension("xsd-extends", { base: desc.extends }, [body]);
	}
	return desc.name ? letBinding(desc.name, body, base(desc.name)) : body;
}

function parseIdentityConstraint(c: XsdIdentityConstraint, body: TypeTerm): TypeTerm {
	if (c.kind === "keyref") {
		return extension(
			"foreign-key",
			{ name: c.name, selector: c.selector, fields: c.fields, refer: c.refer },
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

function parseSchema(
	desc: Extract<XsdDescriptor, { kind: "schema" }>,
	ctx: XsdEngine,
): TypeTerm {
	const inner = desc.types.length === 1 ? ctx.parse(desc.types[0]!) : top();
	const payload: Record<string, unknown> = {};
	if (desc.targetNamespace !== undefined) payload.targetNamespace = desc.targetNamespace;
	if (desc.includes !== undefined) payload.includes = desc.includes;
	if (desc.imports !== undefined) payload.imports = desc.imports;
	if (desc.redefines !== undefined) payload.redefines = desc.redefines;
	if (desc.overrides !== undefined) payload.overrides = desc.overrides;
	if (desc.defaultAttributes !== undefined) payload.defaultAttributes = desc.defaultAttributes;
	if (desc.annotation?.documentation !== undefined) {
		payload.documentation = desc.annotation.documentation;
	}
	return extension("module", payload, [inner]);
}

function facetsToPredicate(facets: XsdFacets | undefined): RefinementPredicate | undefined {
	if (facets === undefined) return undefined;
	const predicates: RefinementPredicate[] = [];

	if (facets.minInclusive !== undefined || facets.maxInclusive !== undefined) {
		predicates.push(rangeConstraint(facets.minInclusive, facets.maxInclusive));
	}
	if (facets.minExclusive !== undefined || facets.maxExclusive !== undefined) {
		const range: RefinementPredicate = {
			kind: "range",
			...(facets.minExclusive !== undefined ? { min: facets.minExclusive } : {}),
			...(facets.maxExclusive !== undefined ? { max: facets.maxExclusive } : {}),
			exclusive: true,
		};
		predicates.push(range);
	}
	if (facets.pattern !== undefined) predicates.push(patternConstraint(facets.pattern));
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
	if (facets.assertions !== undefined && facets.assertions.length > 0) {
		predicates.push({
			kind: "custom",
			name: "xsd:assertions",
			params: { assertions: facets.assertions },
		});
	}
	if (facets.explicitTimezone !== undefined) {
		predicates.push({
			kind: "custom",
			name: "xsd:explicitTimezone",
			params: { explicitTimezone: facets.explicitTimezone },
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

function parseElement(
	element: XsdElementDescriptor,
	ctx: XsdEngine,
): ReturnType<typeof field> {
	const parsedType = ctx.parse(element.type);
	const arrayWrapped =
		element.maxOccurs === "unbounded" ||
		(typeof element.maxOccurs === "number" && element.maxOccurs > 1)
			? array(parsedType)
			: parsedType;
	const typed = element.nillable ? union([arrayWrapped, base("null")]) : arrayWrapped;
	const annotations: Record<string, unknown> = {};
	if (element.annotation?.documentation !== undefined) {
		annotations.documentation = element.annotation.documentation;
	}
	if (element.annotation?.appinfo !== undefined) annotations.appinfo = element.annotation.appinfo;
	if (element.alternatives !== undefined && element.alternatives.length > 0) {
		// 1.1 xs:alternative chain — round-trip as an extension so the 1.1
		// encoder can reconstruct the descriptor. 1.0 will not encounter this
		// because 1.0 schemas never carry alternatives.
		annotations.xsdAlternatives = element.alternatives;
	}
	return field(element.name, typed, {
		...(element.minOccurs === 0 ? { optional: true } : {}),
		...(Object.keys(annotations).length > 0 ? { annotations } : {}),
	});
}

function parseAttribute(
	attribute: XsdAttributeDescriptor,
	ctx: XsdEngine,
): ReturnType<typeof field> {
	const annotations: Record<string, unknown> = {};
	if (attribute.annotation?.documentation !== undefined) {
		annotations.documentation = attribute.annotation.documentation;
	}
	if (attribute.annotation?.appinfo !== undefined) {
		annotations.appinfo = attribute.annotation.appinfo;
	}
	return field(`@${attribute.name}`, ctx.parse(attribute.type), {
		...(attribute.use !== "required" ? { optional: true } : {}),
		...(attribute.default !== undefined ? { defaultValue: attribute.default } : {}),
		...(Object.keys(annotations).length > 0 ? { annotations } : {}),
	});
}

// ─── Encode ──────────────────────────────────────────────────────────

function encodeTerm(term: TypeTerm, ctx: XsdEngine): XsdDescriptor {
	switch (term.kind) {
		case "bottom":
			return { kind: "empty" };
		case "top":
			return { kind: "anyType" };
		case "literal":
			return encodeLiteral(term);
		case "base":
			return encodeBase(term.name, ctx);
		case "apply":
			return encodeApply(term, ctx);
		case "refinement":
			return encodeRefinement(term, ctx);
		case "nominal":
			return encodeNominal(term, ctx);
		case "let":
			return encodeLet(term, ctx);
		case "extension":
			return encodeExtension(term, ctx);
		default:
			throw new Error(`Cannot encode ${term.kind} to XSD`);
	}
}

function encodeLiteral(term: Extract<TypeTerm, { kind: "literal" }>): XsdDescriptor {
	if (term.value === null) {
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

function encodeBase(name: string, ctx: XsdEngine): XsdDescriptor {
	if (name === "number") return { kind: "primitive", name: "decimal" };
	if (name === "null") {
		throw new Error('Cannot encode base("null") to XSD — null is not an XSD type');
	}
	if (ctx.config.builtinNames.has(name)) {
		return { kind: "primitive", name: name as XsdBuiltinName };
	}
	throw new Error(`Cannot encode base type "${name}" to XSD`);
}

function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>, ctx: XsdEngine): XsdDescriptor {
	switch (term.constructor) {
		case "product":
			return encodeProduct(term, ctx);
		case "array":
			return encodeArrayOrSet(term, "list", ctx);
		case "set":
			return encodeArrayOrSet(term, "set", ctx);
		case "union":
			return { kind: "union", members: term.args.map((a) => ctx.encode(a)) };
		case "intersection":
			return encodeIntersection(term, ctx);
		case "map":
			throw new Error(
				"Cannot encode map to XSD — XSD has no map/dictionary primitive. " +
					"Model as a complexType with a repeating named element via product([field(...)]).",
			);
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to XSD`);
	}
}

function encodeProduct(
	term: Extract<TypeTerm, { kind: "apply" }>,
	ctx: XsdEngine,
): XsdDescriptor {
	const annotations = (term.annotations ?? {}) as Record<string, unknown>;
	const wildcard = annotations.open === true ? {} : undefined;
	const annotation = collectAnnotation(annotations);
	const final = annotations.final as XsdDerivationToken | undefined;
	const block = annotations.block as XsdDerivationToken | undefined;
	const assertions =
		Array.isArray(annotations.xsdAssertions) && ctx.config.supportedKinds?.has("conditional")
			? (annotations.xsdAssertions as XsdDescriptor extends { assertions?: infer R } ? R : never)
			: undefined;
	const openContent =
		ctx.config.supportedKinds?.has("conditional") &&
		typeof annotations.xsdOpenContent === "object" &&
		annotations.xsdOpenContent !== null
			? (annotations.xsdOpenContent as XsdDescriptor extends { openContent?: infer R } ? R : never)
			: undefined;
	const defaultAttributesApply =
		typeof annotations.xsdDefaultAttributesApply === "boolean"
			? (annotations.xsdDefaultAttributesApply as boolean)
			: undefined;

	return {
		kind: "complexType",
		elements: (term.fields ?? []).map((f) => encodeField(f, ctx)),
		...(wildcard !== undefined ? { wildcard } : {}),
		...(annotation !== undefined ? { annotation } : {}),
		...(final !== undefined ? { final } : {}),
		...(block !== undefined ? { block } : {}),
		...(assertions !== undefined ? { assertions } : {}),
		...(openContent !== undefined ? { openContent } : {}),
		...(defaultAttributesApply !== undefined ? { defaultAttributesApply } : {}),
	};
}

function encodeArrayOrSet(
	term: Extract<TypeTerm, { kind: "apply" }>,
	kind: "list" | "set",
	ctx: XsdEngine,
): XsdDescriptor {
	const itemType = term.args[0];
	if (itemType === undefined) throw new Error(`XSD ${kind} requires an item type`);
	const itemDesc = ctx.encode(itemType);
	if (isAtomicDescriptor(itemDesc)) return { kind, itemType: itemDesc };
	return {
		kind: "complexType",
		elements: [{ name: "item", type: itemDesc, maxOccurs: "unbounded" }],
	};
}

function isAtomicDescriptor(desc: XsdDescriptor): boolean {
	switch (desc.kind) {
		case "primitive":
		case "simpleType":
		case "ref":
			return true;
		case "union":
			return desc.members.every(isAtomicDescriptor);
		default:
			return false;
	}
}

function encodeIntersection(
	term: Extract<TypeTerm, { kind: "apply" }>,
	ctx: XsdEngine,
): XsdDescriptor {
	const args = term.args;
	if (args.length === 2) {
		const [a, b] = args;
		if (a === undefined || b === undefined) {
			throw new Error("Cannot encode intersection with missing arguments to XSD");
		}
		if (isRecordTerm(a) && isRecordTerm(b)) {
			return encodeProduct(mergeProducts(a, b), ctx);
		}
		if (a.kind === "refinement" && b.kind === "refinement") {
			return encodeRefinement(
				{
					kind: "refinement",
					base: a.base,
					predicate: andPredicate(a.predicate, b.predicate),
				},
				ctx,
			);
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

function encodeRefinement(
	term: Extract<TypeTerm, { kind: "refinement" }>,
	ctx: XsdEngine,
): XsdDescriptor {
	return {
		kind: "simpleType",
		base: ctx.encode(term.base),
		facets: predicateToFacets(term.predicate, ctx),
	};
}

function predicateToFacets(predicate: RefinementPredicate, ctx: XsdEngine): XsdFacets {
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
			throw new Error(
				"Cannot encode multipleOfConstraint to XSD — XSD has no multipleOf facet (JSON Schema invention)",
			);
		case "custom":
			return customPredicateToFacets(predicate, ctx);
		case "and":
			return {
				...predicateToFacets(predicate.left, ctx),
				...predicateToFacets(predicate.right, ctx),
			};
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
	ctx: XsdEngine,
): XsdFacets {
	const params = predicate.params ?? {};
	const facets: Record<string, unknown> = {};
	switch (predicate.name) {
		case "xsd:length":
			facets.length = params.length;
			break;
		case "xsd:minLength":
			facets.minLength = params.minLength;
			break;
		case "xsd:maxLength":
			facets.maxLength = params.maxLength;
			break;
		case "xsd:whiteSpace": {
			const ws = params.whiteSpace as "preserve" | "replace" | "collapse" | undefined;
			if (ws !== undefined) facets.whiteSpace = ws;
			break;
		}
		case "xsd:totalDigits":
			facets.totalDigits = params.totalDigits;
			break;
		case "xsd:fractionDigits":
			facets.fractionDigits = params.fractionDigits;
			break;
		case "xsd:assertions":
			facets.assertions = params.assertions;
			break;
		case "xsd:explicitTimezone":
			facets.explicitTimezone = params.explicitTimezone;
			break;
		default:
			throw new Error(`Cannot encode custom predicate "${predicate.name}" to XSD`);
	}
	// Verify the engine's facet allow-list permits each facet we just emitted.
	for (const key of Object.keys(facets)) {
		if (!ctx.config.allowedFacets.has(key)) {
			throw new Error(`Cannot encode facet "${key}" — not in this XSD version's facet set`);
		}
	}
	return facets as XsdFacets;
}

function encodeNominal(
	term: Extract<TypeTerm, { kind: "nominal" }>,
	ctx: XsdEngine,
): XsdDescriptor {
	const inner = ctx.encode(term.inner);
	if (inner.kind === "simpleType" || inner.kind === "primitive") {
		return {
			kind: "simpleType",
			name: term.tag,
			base: inner.kind === "simpleType" ? inner.base : inner,
			...(inner.kind === "simpleType" && inner.facets ? { facets: inner.facets } : {}),
		};
	}
	if (inner.kind === "complexType") return { ...inner, name: term.tag };
	return {
		kind: "complexType",
		name: term.tag,
		elements: [{ name: "value", type: inner }],
	};
}

function encodeLet(term: Extract<TypeTerm, { kind: "let" }>, ctx: XsdEngine): XsdDescriptor {
	const inner = ctx.encode(term.binding);
	if (inner.kind === "simpleType") return { ...inner, name: term.name };
	if (inner.kind === "complexType") return { ...inner, name: term.name };
	if (inner.kind === "primitive") return { kind: "simpleType", name: term.name, base: inner };
	return {
		kind: "complexType",
		name: term.name,
		elements: [{ name: "value", type: inner }],
	};
}

function encodeExtension(
	term: Extract<TypeTerm, { kind: "extension" }>,
	ctx: XsdEngine,
): XsdDescriptor {
	switch (term.extensionKind) {
		case "module":
			return encodeModule(term, ctx);
		case "visibility":
			return encodeVisibility(term, ctx);
		case "foreign-key":
			return encodeForeignKey(term, ctx);
		case "path-constraint":
			return encodePathConstraint(term, ctx);
		case "xsd-extends":
			return encodeXsdExtends(term, ctx);
		default:
			throw new Error(`Cannot encode extension "${term.extensionKind}" to XSD`);
	}
}

function encodeModule(
	term: Extract<TypeTerm, { kind: "extension" }>,
	ctx: XsdEngine,
): XsdDescriptor {
	const payload = (term.payload ?? {}) as {
		readonly targetNamespace?: string;
		readonly includes?: readonly string[];
		readonly imports?: readonly { readonly namespace: string; readonly schemaLocation?: string }[];
		readonly redefines?: readonly string[];
		readonly overrides?: readonly {
			readonly schemaLocation: string;
			readonly types: readonly XsdDescriptor[];
		}[];
		readonly defaultAttributes?: string;
		readonly name?: string;
		readonly documentation?: string;
	};
	const types = (term.children ?? []).map((c) => ctx.encode(c));
	const targetNamespace =
		payload.targetNamespace ??
		(payload.name !== undefined ? `urn:typecarta:${payload.name}` : undefined);
	return {
		kind: "schema",
		...(targetNamespace !== undefined ? { targetNamespace } : {}),
		...(payload.includes !== undefined ? { includes: payload.includes } : {}),
		...(payload.imports !== undefined ? { imports: payload.imports } : {}),
		...(payload.redefines !== undefined ? { redefines: payload.redefines } : {}),
		...(payload.overrides !== undefined ? { overrides: payload.overrides } : {}),
		...(payload.defaultAttributes !== undefined
			? { defaultAttributes: payload.defaultAttributes }
			: {}),
		types,
		...(payload.documentation !== undefined
			? { annotation: { documentation: payload.documentation } }
			: {}),
	};
}

function encodeVisibility(
	term: Extract<TypeTerm, { kind: "extension" }>,
	ctx: XsdEngine,
): XsdDescriptor {
	const payload = (term.payload ?? {}) as { readonly level?: string };
	const child = term.children?.[0];
	if (child === undefined) {
		throw new Error("visibility extension requires a child term");
	}
	const inner = ctx.encode(child);
	if (inner.kind !== "complexType" && inner.kind !== "simpleType") return inner;
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

function encodeForeignKey(
	term: Extract<TypeTerm, { kind: "extension" }>,
	ctx: XsdEngine,
): XsdDescriptor {
	const payload = (term.payload ?? {}) as {
		readonly name?: string;
		readonly selector?: string;
		readonly fields?: readonly string[];
		readonly refer?: string;
		readonly sourceField?: string;
		readonly targetCollection?: string;
		readonly targetField?: string;
	};
	const child = term.children?.[0];
	if (child === undefined) throw new Error("foreign-key extension requires a child term");
	const inner = ctx.encode(child);
	if (inner.kind !== "complexType") {
		throw new Error("foreign-key extension must wrap a product to attach xs:keyref");
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

function encodePathConstraint(
	term: Extract<TypeTerm, { kind: "extension" }>,
	ctx: XsdEngine,
): XsdDescriptor {
	const payload = (term.payload ?? {}) as {
		readonly name?: string;
		readonly selector?: string;
		readonly fields?: readonly string[];
		readonly kind?: "key" | "unique";
		readonly path?: string;
	};
	const child = term.children?.[0];
	if (child === undefined) throw new Error("path-constraint extension requires a child term");
	const inner = ctx.encode(child);
	if (inner.kind !== "complexType") {
		throw new Error(
			"path-constraint extension must wrap a product to attach xs:unique/xs:key",
		);
	}
	const constraint: XsdIdentityConstraint = {
		kind: payload.kind ?? "unique",
		name: payload.name ?? "uq",
		selector: payload.selector ?? payload.path ?? ".",
		fields: payload.fields ?? ["."],
	};
	return {
		...inner,
		identityConstraints: [...(inner.identityConstraints ?? []), constraint],
	};
}

function encodeXsdExtends(
	term: Extract<TypeTerm, { kind: "extension" }>,
	ctx: XsdEngine,
): XsdDescriptor {
	const payload = (term.payload ?? {}) as { readonly base?: string };
	const child = term.children?.[0];
	if (child === undefined) throw new Error("xsd-extends extension requires a child term");
	const inner = ctx.encode(child);
	if (inner.kind !== "complexType") throw new Error("xsd-extends must wrap a complexType");
	return payload.base !== undefined ? { ...inner, extends: payload.base } : inner;
}

function encodeField(
	f: {
		readonly name: string;
		readonly type: TypeTerm;
		readonly optional?: boolean;
		readonly annotations?: Record<string, unknown>;
	},
	ctx: XsdEngine,
): XsdElementDescriptor {
	const annotation = collectAnnotation((f.annotations ?? {}) as Record<string, unknown>);
	const supportsConditional = ctx.config.supportedKinds?.has("conditional") ?? false;
	const alternativesFromAnn = supportsConditional
		? extractAlternatives(f.annotations as Record<string, unknown> | undefined)
		: undefined;
	// If the field's type is itself a conditional (xs:alternative chain),
	// promote it to a chain of XsdAlternative on the element.
	const alternativesFromType =
		supportsConditional && f.type.kind === "conditional"
			? collectAlternativesFromConditional(f.type, ctx)
			: undefined;
	const alternatives = alternativesFromType ?? alternativesFromAnn;

	const nullableInner = extractNullableInner(f.type);
	if (nullableInner !== undefined) {
		return {
			name: f.name,
			type: ctx.encode(nullableInner),
			nillable: true,
			...(f.optional ? { minOccurs: 0 } : {}),
			...(annotation !== undefined ? { annotation } : {}),
			...(alternatives !== undefined ? { alternatives } : {}),
		};
	}
	if (f.type.kind === "apply" && f.type.constructor === "array") {
		const elementType = f.type.args[0];
		if (elementType === undefined) {
			throw new Error(`Array field "${f.name}" has no element type`);
		}
		return {
			name: f.name,
			type: ctx.encode(elementType),
			...(f.optional ? { minOccurs: 0 } : {}),
			maxOccurs: "unbounded",
			...(annotation !== undefined ? { annotation } : {}),
			...(alternatives !== undefined ? { alternatives } : {}),
		};
	}
	// A conditional-typed field gets an anyType placeholder element with the
	// alternative chain attached. (1.1-only path.)
	if (alternativesFromType !== undefined) {
		return {
			name: f.name,
			type: { kind: "anyType" },
			...(f.optional ? { minOccurs: 0 } : {}),
			...(annotation !== undefined ? { annotation } : {}),
			alternatives: alternativesFromType,
		};
	}
	return {
		name: f.name,
		type: ctx.encode(f.type),
		...(f.optional ? { minOccurs: 0 } : {}),
		...(annotation !== undefined ? { annotation } : {}),
		...(alternatives !== undefined ? { alternatives } : {}),
	};
}

/**
 * Walk a `conditional` chain and emit one `XsdAlternative` per arm. The
 * `test` attribute records the IR slot kinds the conditional dispatches on
 * — it is explicitly a typecarta-emitted marker, not a hand-written XPath.
 * The terminal branch is the test-less default alternative (Part 1 §3.3.2.4).
 */
function collectAlternativesFromConditional(
	term: Extract<TypeTerm, { kind: "conditional" }>,
	ctx: XsdEngine,
): readonly XsdAlternative[] {
	const out: XsdAlternative[] = [];
	let cursor: TypeTerm = term;
	while (cursor.kind === "conditional") {
		out.push({
			test: `xsd:conditional(check=${cursor.check.kind}, extends=${cursor.extends.kind})`,
			type: ctx.encode(cursor.then),
		});
		cursor = cursor.else;
	}
	out.push({ type: ctx.encode(cursor) });
	return out;
}

function extractAlternatives(
	annotations: Record<string, unknown> | undefined,
): readonly XsdAlternative[] | undefined {
	if (annotations === undefined) return undefined;
	const value = annotations.xsdAlternatives;
	if (!Array.isArray(value)) return undefined;
	return value as readonly XsdAlternative[];
}

function collectAnnotation(
	annotations: Record<string, unknown>,
): XsdAnnotation | undefined {
	const out: XsdAnnotation = {};
	if (typeof annotations.documentation === "string") {
		(out as { documentation?: string }).documentation = annotations.documentation;
	}
	if (annotations.appinfo !== undefined) {
		(out as { appinfo?: unknown }).appinfo = annotations.appinfo;
	}
	return Object.keys(out).length === 0 ? undefined : out;
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

// ─── Inhabitation ───────────────────────────────────────────────────

function checkInhabitation(value: unknown, term: TypeTerm, ctx: XsdEngine): boolean {
	switch (term.kind) {
		case "bottom":
			return false;
		case "top":
			return true;
		case "literal":
			return value === term.value;
		case "base":
			return checkBaseInhabitation(value, term.name, ctx);
		case "apply":
			return checkApplyInhabitation(value, term, ctx);
		case "refinement":
			return (
				checkInhabitation(value, term.base, ctx) &&
				checkPredicateInhabitation(value, term.predicate)
			);
		case "nominal":
			return checkInhabitation(value, term.inner, ctx);
		case "let":
			return checkInhabitation(value, term.body, ctx);
		case "extension": {
			const inner = term.children?.[0];
			return inner !== undefined ? checkInhabitation(value, inner, ctx) : true;
		}
		case "conditional":
			// Without an XPath evaluator we accept values that satisfy either
			// branch; the actual `check`/`extends` semantics are opaque here.
			return (
				checkInhabitation(value, term.then, ctx) || checkInhabitation(value, term.else, ctx)
			);
		default:
			return false;
	}
}

function checkBaseInhabitation(value: unknown, name: string, ctx: XsdEngine): boolean {
	if (!ctx.config.builtinNames.has(name) && name !== "number" && name !== "null") return false;
	switch (name) {
		case "string":
		case "date":
		case "dateTime":
		case "dateTimeStamp":
		case "time":
		case "duration":
		case "dayTimeDuration":
		case "yearMonthDuration":
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
		case "anyAtomicType":
			return (
				typeof value === "string" || typeof value === "number" || typeof value === "boolean"
			);
		default:
			return false;
	}
}

function checkApplyInhabitation(
	value: unknown,
	term: Extract<TypeTerm, { kind: "apply" }>,
	ctx: XsdEngine,
): boolean {
	switch (term.constructor) {
		case "product": {
			if (typeof value !== "object" || value === null) return false;
			const obj = value as Record<string, unknown>;
			for (const f of term.fields ?? []) {
				if (!f.optional && !(f.name in obj)) return false;
				if (f.name in obj && !checkInhabitation(obj[f.name], f.type, ctx)) return false;
			}
			return true;
		}
		case "array": {
			const elementType = term.args[0];
			return (
				Array.isArray(value) &&
				elementType !== undefined &&
				value.every((item) => checkInhabitation(item, elementType, ctx))
			);
		}
		case "set": {
			const elementType = term.args[0];
			if (!Array.isArray(value) || elementType === undefined) return false;
			if (new Set(value).size !== value.length) return false;
			return value.every((item) => checkInhabitation(item, elementType, ctx));
		}
		case "union":
			return term.args.some((arg) => checkInhabitation(value, arg, ctx));
		case "intersection":
			return term.args.every((arg) => checkInhabitation(value, arg, ctx));
		case "map": {
			const valueType = term.args[1];
			if (typeof value !== "object" || value === null || valueType === undefined) return false;
			return Object.values(value as Record<string, unknown>).every((entry) =>
				checkInhabitation(entry, valueType, ctx),
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
			return true;
		case "xsd:totalDigits":
		case "xsd:fractionDigits":
			return typeof value === "number";
		case "xsd:assertions":
		case "xsd:explicitTimezone":
			// XPath / timezone validation is out of scope for inhabits.
			return true;
		default:
			return true;
	}
}
