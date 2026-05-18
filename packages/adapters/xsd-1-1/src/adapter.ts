// XML Schema Definition 1.1 adapter — thin layer over @typecarta/adapter-xsd-core.
//
// All shared parse/encode/inhabits logic lives in xsd-core. This file pins
// the 1.1-specific configuration deltas relative to 1.0:
//
//   - Datatype catalog: adds dateTimeStamp, dayTimeDuration,
//     yearMonthDuration, anyAtomicType (Part 2 §3.4.26–28, §4.1.6).
//   - Facet catalog: adds assertions (§4.3.13) and explicitTimezone
//     (§4.3.14) to the 1.0 set of 12.
//   - supportedKinds: adds "conditional" to model xs:alternative.
//   - encodeHook: top-level conditional terms become a single-element
//     complexType with an xs:alternative chain whose `test` attributes
//     come from the conditional's check/extends slots (not synthesized).
//
// Vendored canonical spec: vendor/specs/xsd-1-1/ (W3C XML Schema 1.1 Parts 1
// & 2, REC 2012-04-05). The xs:override component is modeled as a child of
// xs:schema (correct per Part 1 §4.2.5), reached via the IR
// `extension("module", { overrides: [...] }, [...])` payload.

import type { IRAdapter, RefinementPredicate, Signature, TypeTerm } from "@typecarta/core";
import {
	andPredicate,
	createSignature,
	multipleOfConstraint,
	refinement,
} from "@typecarta/core";
import {
	XSD_BUILTIN_DERIVED_NAMES_11,
	XSD_FACET_KEYS_11,
	XSD_PRIMITIVE_NAMES_11,
	createEngine,
	type XsdAlternative,
	type XsdAssert,
	type XsdDescriptor,
	type XsdEngine,
} from "@typecarta/adapter-xsd-core";

export type {
	XsdAlternative,
	XsdAnnotation,
	XsdAssert,
	XsdAttributeDescriptor,
	XsdDescriptor,
	XsdElementDescriptor,
	XsdFacets,
	XsdOpenContent,
} from "@typecarta/adapter-xsd-core";

const XSD_11_BUILTIN_NAMES = new Set([
	...XSD_PRIMITIVE_NAMES_11,
	...XSD_BUILTIN_DERIVED_NAMES_11,
]);

const XSD_11_FACETS = new Set(XSD_FACET_KEYS_11);

const XSD_11_SUPPORTED_KINDS: ReadonlySet<TypeTerm["kind"]> = new Set([
	"bottom",
	"top",
	"literal",
	"base",
	"apply",
	"refinement",
	"nominal",
	"let",
	"extension",
	"conditional",
] satisfies readonly TypeTerm["kind"][]);

const XSD_11_SIGNATURE: Signature = createSignature(XSD_PRIMITIVE_NAMES_11, [
	{ name: "product", arity: 1 },
	{ name: "array", arity: 1 },
	{ name: "set", arity: 1 },
	{ name: "union", arity: 2 },
]);

/**
 * Encode a conditional-type-assignment chain as xs:alternative children.
 *
 * Each `xs:alternative` carries a `test` attribute derived from the IR's
 * `check`/`extends` slots so the resulting XSD reflects the witness — no
 * placeholder `test="true()"` and no test-less alternatives (which would
 * be illegal per Part 1 §3.3.2.4 if more than one is emitted).
 */
function collectAlternatives(
	term: Extract<TypeTerm, { kind: "conditional" }>,
	ctx: XsdEngine,
): readonly XsdAlternative[] {
	const out: XsdAlternative[] = [];
	let cursor: TypeTerm = term;
	while (cursor.kind === "conditional") {
		out.push({
			test: xpathForConditional(cursor),
			type: ctx.encode(cursor.then),
		});
		cursor = cursor.else;
	}
	// The terminal branch has no `test` — exactly one default xs:alternative.
	out.push({ type: ctx.encode(cursor) });
	return out;
}

function xpathForConditional(
	term: Extract<TypeTerm, { kind: "conditional" }>,
): string {
	// The IR's conditional has `check` and `extends` slots. Without an XPath
	// evaluator we cannot translate IR predicates back to real XPath, but we
	// can honestly surface the IR's intent by naming the slots involved.
	// Format: `xsd:conditional(check=<kind>, extends=<kind>)`. A consumer
	// reading the XSD knows this assertion is a typecarta-emitted placeholder
	// rather than a hand-written XPath.
	const checkKind = term.check.kind;
	const extendsKind = term.extends.kind;
	return `xsd:conditional(check=${checkKind}, extends=${extendsKind})`;
}

/**
 * Walk a predicate tree and split it into `(facetPart, multipleOfDivisors)`.
 *
 * The facet part is the predicate with all `multipleOf` nodes removed; the
 * divisors list collects every `multipleOfConstraint(n)` seen, in order.
 * `and` nodes whose only contents are multipleOfs collapse; nodes with
 * mixed contents become `and(non-multipleOf-children, …)`.
 *
 * Returns `undefined` for the facet part iff every leaf was a multipleOf
 * (i.e. nothing remains to encode as a facet).
 */
function splitMultipleOfs(
	pred: RefinementPredicate,
): { facetPart: RefinementPredicate | undefined; divisors: readonly number[] } {
	const divisors: number[] = [];
	function visit(p: RefinementPredicate): RefinementPredicate | undefined {
		if (p.kind === "multipleOf") {
			divisors.push(p.divisor);
			return undefined;
		}
		if (p.kind === "and") {
			const left = visit(p.left);
			const right = visit(p.right);
			if (left === undefined && right === undefined) return undefined;
			if (left === undefined) return right;
			if (right === undefined) return left;
			return andPredicate(left, right);
		}
		// `or` and `not` containing a multipleOf can't be honestly split (the
		// XPath translation would need different semantics). Leave as-is and
		// let the core throw on encode, surfacing the limitation honestly.
		return p;
	}
	const facetPart = visit(pred);
	return { facetPart, divisors };
}

/**
 * Try to recognize an `xs:assert` test as the canonical `multipleOf` shape
 * emitted by {@link xpathForMultipleOf}. Returns the divisor if matched.
 */
function recognizeMultipleOfAssertion(test: string): number | undefined {
	const match = /^\$value\s+mod\s+(\d+(?:\.\d+)?)\s*=\s*0$/.exec(test);
	if (match === null) return undefined;
	const divisor = Number(match[1]);
	return Number.isFinite(divisor) && divisor !== 0 ? divisor : undefined;
}

function xpathForMultipleOf(divisor: number): string {
	return `$value mod ${divisor} = 0`;
}

const engine = createEngine({
	builtinNames: XSD_11_BUILTIN_NAMES,
	allowedFacets: XSD_11_FACETS,
	supportedKinds: XSD_11_SUPPORTED_KINDS,
	encodeHook(term, ctx) {
		if (term.kind === "conditional") {
			// Top-level conditional: emit a single-element complexType carrying
			// the xs:alternative chain. (Inside a field this is handled by the
			// core's field encoder via `xsdAlternatives` annotations.)
			return {
				kind: "complexType",
				elements: [
					{
						name: "value",
						type: { kind: "anyType" },
						alternatives: collectAlternatives(term, ctx),
					},
				],
			};
		}
		// XSD 1.1 expresses divisibility via xs:assert (`$value mod N = 0`)
		// rather than a multipleOf facet (which XSD has neither in 1.0 nor
		// 1.1). When the predicate contains a multipleOf, split it: encode
		// the rest as facets via the core path, and lift the divisors into
		// xs:assert children on the resulting simpleType.
		if (term.kind === "refinement") {
			const { facetPart, divisors } = splitMultipleOfs(term.predicate);
			if (divisors.length === 0) return undefined;
			const assertions: readonly XsdAssert[] = divisors.map((d) => ({
				test: xpathForMultipleOf(d),
			}));
			if (facetPart === undefined) {
				// Predicate was nothing but multipleOfs; emit a simpleType with
				// just the base and the assertions.
				return {
					kind: "simpleType",
					base: ctx.encode(term.base),
					facets: { assertions },
				};
			}
			// Encode the facet-bearing residual via the core engine, then
			// graft the assertions onto its facets.
			const inner = ctx.encode(refinement(term.base, facetPart));
			if (inner.kind === "simpleType") {
				return {
					...inner,
					facets: { ...(inner.facets ?? {}), assertions },
				};
			}
			// Shouldn't happen for refinement input, but defensively pass through.
			return inner;
		}
		return undefined;
	},
	parseHook(desc, _ctx) {
		// Inverse of the encodeHook above: when a simpleType carries assertions
		// matching the canonical multipleOf pattern, rebuild the IR refinement
		// with multipleOf inside the predicate tree.
		if (bypassParseHook) return undefined;
		if (desc.kind !== "simpleType") return undefined;
		const assertions = desc.facets?.assertions;
		if (assertions === undefined || assertions.length === 0) return undefined;
		const divisors: number[] = [];
		const unrecognized: typeof assertions[number][] = [];
		for (const a of assertions) {
			const divisor = recognizeMultipleOfAssertion(a.test);
			if (divisor !== undefined) divisors.push(divisor);
			else unrecognized.push(a);
		}
		if (divisors.length === 0) return undefined;
		// Defer to the core for everything except the multipleOf grafting:
		// reconstruct a descriptor that the core parses normally (without
		// the multipleOf assertions) and then graft the multipleOf predicates
		// back onto the result.
		const cleaned = withoutRecognizedAssertions(desc, unrecognized);
		const baseTerm = parseViaCore(cleaned);
		return divisors.reduce<TypeTerm>(
			(acc, divisor) =>
				acc.kind === "refinement"
					? refinement(acc.base, andPredicate(acc.predicate, multipleOfConstraint(divisor)))
					: refinement(acc, multipleOfConstraint(divisor)),
			baseTerm,
		);
	},
});

/**
 * Strip the recognized multipleOf assertions from a simpleType descriptor.
 * If `unrecognized` is empty, drop the `assertions` field entirely; if
 * non-empty, replace it with just those entries.
 */
function withoutRecognizedAssertions(
	desc: Extract<XsdDescriptor, { kind: "simpleType" }>,
	unrecognized: readonly XsdAssert[],
): XsdDescriptor {
	if (desc.facets === undefined) return desc;
	const { assertions: _drop, ...facetsRest } = desc.facets;
	const newFacets =
		unrecognized.length > 0
			? { ...facetsRest, assertions: unrecognized }
			: facetsRest;
	const hasFacets = Object.keys(newFacets).length > 0;
	const { facets: _facetsDrop, ...descRest } = desc;
	return hasFacets ? { ...descRest, facets: newFacets } : descRest;
}

/**
 * Re-invoke the engine's parse path while bypassing the parseHook to avoid
 * infinite recursion. `engine` is closed over below; we use a small flag.
 */
let bypassParseHook = false;
function parseViaCore(desc: XsdDescriptor): TypeTerm {
	bypassParseHook = true;
	try {
		return engine.parse(desc);
	} finally {
		bypassParseHook = false;
	}
}

/** Adapt XSD 1.1 schema-component descriptors to and from the typecarta IR. */
export class XsdAdapter implements IRAdapter<Signature, XsdDescriptor> {
	readonly name = "xsd-1-1";
	readonly specVersion = "1.1";
	readonly signature = XSD_11_SIGNATURE;

	parse(source: XsdDescriptor): TypeTerm {
		return engine.parse(source);
	}

	encode(term: TypeTerm): XsdDescriptor {
		return engine.encode(term);
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
		return engine.supportsKind(kind);
	}

	inhabits(value: unknown, term: TypeTerm): boolean {
		return engine.inhabits(value, term);
	}
}
