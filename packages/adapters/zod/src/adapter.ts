// Zod schema adapter for typecarta.
//
// Implement IRAdapter<Signature, ZodDescriptor> using descriptor
// objects that represent Zod schemas, not the actual Zod library
// at runtime.

import type { IRAdapter, RefinementPredicate, Signature, TypeTerm } from "@typecarta/core";
import {
	andPredicate,
	array,
	base,
	bottom,
	createSignature,
	field,
	intersection,
	literal,
	multipleOfConstraint,
	patternConstraint,
	product,
	rangeConstraint,
	refinement,
	top,
	tuple,
	union,
} from "@typecarta/core";

// ─── Descriptor types ──────────────────────────────────────────────

/**
 * A check that narrows a Zod schema's value set. Mirrors Zod 3's
 * chainable refinement methods (`.min`, `.max`, `.regex`, `.multipleOf`,
 * `.refine`). Compound predicates `andPredicate(a, b)` flatten to a
 * stack of checks; `orPredicate` / `notPredicate` have no direct Zod
 * analogue and are encoded as opaque `.refine(fn)` placeholders.
 */
export type ZodCheck =
	| { kind: "min"; value: number; exclusive?: boolean }
	| { kind: "max"; value: number; exclusive?: boolean }
	| { kind: "minLength"; value: number }
	| { kind: "maxLength"; value: number }
	| { kind: "regex"; value: string }
	| { kind: "multipleOf"; value: number }
	| { kind: "refine"; name: string; params?: Record<string, unknown> };

/** Describe a Zod schema as a plain discriminated-union object. */
export type ZodDescriptor =
	| { type: "string" }
	| { type: "number" }
	| { type: "boolean" }
	| { type: "date" }
	| { type: "null" }
	| { type: "undefined" }
	| { type: "literal"; value: string | number | boolean | null }
	| { type: "object"; shape: Record<string, ZodDescriptor>; optional?: string[] }
	| { type: "array"; element: ZodDescriptor }
	| { type: "tuple"; elements: ZodDescriptor[] }
	| { type: "union"; options: ZodDescriptor[] }
	| { type: "intersection"; left: ZodDescriptor; right: ZodDescriptor }
	| { type: "optional"; inner: ZodDescriptor }
	| { type: "nullable"; inner: ZodDescriptor }
	| { type: "enum"; values: string[] }
	| { type: "never" }
	| { type: "any" }
	| { type: "unknown" }
	/**
	 * `refined` — a base Zod schema with one or more chainable checks
	 * applied. Mirrors Zod's `.min(n).max(m).regex(re)…` chain.
	 */
	| { type: "refined"; base: ZodDescriptor; checks: ZodCheck[] };

// ─── Signature ─────────────────────────────────────────────────────

const ZOD_SIGNATURE: Signature = createSignature(
	["string", "number", "boolean", "date", "null", "undefined"],
	[
		{ name: "product", arity: 1 },
		{ name: "array", arity: 1 },
		{ name: "union", arity: 2 },
		{ name: "intersection", arity: 2 },
		{ name: "tuple", arity: 1 },
	],
);

const ZOD_SUPPORTED_KINDS: ReadonlySet<TypeTerm["kind"]> = new Set([
	"bottom",
	"top",
	"literal",
	"base",
	"apply",
	"refinement",
]);

// ─── Adapter class ─────────────────────────────────────────────────

/** Convert between Zod schema descriptors and typecarta IR type terms. */
export class ZodAdapter implements IRAdapter<Signature, ZodDescriptor> {
	readonly name = "Zod";
	readonly specVersion = "3.x";
	readonly signature = ZOD_SIGNATURE;

	/**
	 * Parse a Zod descriptor into an IR type term.
	 *
	 * @param source - Zod schema descriptor to parse.
	 * @returns The equivalent IR {@link TypeTerm}.
	 */
	parse(source: ZodDescriptor): TypeTerm {
		return parseZodDescriptor(source);
	}

	/**
	 * Encode an IR type term into a Zod descriptor.
	 *
	 * @param term - IR type term to encode.
	 * @returns The equivalent {@link ZodDescriptor}.
	 * @throws Error if the term contains constructs not representable in Zod.
	 */
	encode(term: TypeTerm): ZodDescriptor {
		return encodeToZodDescriptor(term);
	}

	/**
	 * Test whether a type term can be encoded as a Zod descriptor.
	 *
	 * @param term - IR type term to check.
	 * @returns `true` when {@link encode} would succeed for this term.
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
		return ZOD_SUPPORTED_KINDS.has(kind);
	}

	/**
	 * Check whether a runtime value inhabits the given type term.
	 *
	 * @param value - Runtime value to test.
	 * @param term - IR type term describing the expected type.
	 * @returns `true` when the value satisfies the type.
	 */
	inhabits(value: unknown, term: TypeTerm): boolean {
		return checkInhabitation(value, term);
	}
}

// ─── Parse ─────────────────────────────────────────────────────────

// Convert a ZodDescriptor into an IR TypeTerm via recursive pattern match.
function parseZodDescriptor(desc: ZodDescriptor): TypeTerm {
	switch (desc.type) {
		case "string":
			return base("string");
		case "number":
			return base("number");
		case "boolean":
			return base("boolean");
		case "date":
			return base("date");
		case "null":
			return base("null");
		case "undefined":
			return base("undefined");
		case "literal":
			return literal(desc.value);
		case "never":
			return bottom();
		case "any":
		case "unknown":
			return top();
		case "object": {
			const optionalSet = new Set(desc.optional ?? []);
			const fields = Object.entries(desc.shape).map(([name, schema]) =>
				field(name, parseZodDescriptor(schema), { optional: optionalSet.has(name) }),
			);
			return product(fields);
		}
		case "array":
			return array(parseZodDescriptor(desc.element));
		case "tuple":
			return tuple(desc.elements.map(parseZodDescriptor));
		case "union":
			return union(desc.options.map(parseZodDescriptor));
		case "intersection":
			return intersection([parseZodDescriptor(desc.left), parseZodDescriptor(desc.right)]);
		case "optional":
			return union([parseZodDescriptor(desc.inner), base("undefined")]);
		case "nullable":
			return union([parseZodDescriptor(desc.inner), base("null")]);
		case "enum":
			return union(desc.values.map((v) => literal(v)));
		case "refined": {
			const baseTerm = parseZodDescriptor(desc.base);
			const predicate = checksToPredicate(desc.checks);
			return predicate !== undefined ? refinement(baseTerm, predicate) : baseTerm;
		}
		default:
			return top();
	}
}

/**
 * Compose an array of Zod-style checks into a single refinement
 * predicate. Multiple checks become a left-associated `andPredicate`
 * tree, matching how `encodeRefinement` flattens compound predicates.
 */
function checksToPredicate(checks: readonly ZodCheck[]): RefinementPredicate | undefined {
	const predicates: RefinementPredicate[] = [];
	let rangeMin: { value: number; exclusive: boolean } | undefined;
	let rangeMax: { value: number; exclusive: boolean } | undefined;

	for (const check of checks) {
		switch (check.kind) {
			case "min":
				rangeMin = { value: check.value, exclusive: check.exclusive === true };
				break;
			case "max":
				rangeMax = { value: check.value, exclusive: check.exclusive === true };
				break;
			case "regex":
				predicates.push(patternConstraint(check.value));
				break;
			case "multipleOf":
				predicates.push(multipleOfConstraint(check.value));
				break;
			case "minLength":
			case "maxLength":
				// String-length isn't a first-class IR predicate; carry as a custom.
				predicates.push({
					kind: "custom",
					name: "stringLength",
					params: {
						...(check.kind === "minLength" ? { min: check.value } : {}),
						...(check.kind === "maxLength" ? { max: check.value } : {}),
					},
				});
				break;
			case "refine":
				predicates.push({
					kind: "custom",
					name: check.name,
					...(check.params !== undefined ? { params: check.params } : {}),
				});
				break;
		}
	}

	// Fold min/max into a single range predicate when at least one is present.
	if (rangeMin !== undefined || rangeMax !== undefined) {
		const exclusive = (rangeMin?.exclusive ?? false) || (rangeMax?.exclusive ?? false);
		predicates.unshift(rangeConstraint(rangeMin?.value, rangeMax?.value, exclusive));
	}

	return predicates.reduce<RefinementPredicate | undefined>(
		(acc, p) => (acc === undefined ? p : andPredicate(acc, p)),
		undefined,
	);
}

// ─── Encode ────────────────────────────────────────────────────────

// Convert an IR TypeTerm back into a ZodDescriptor.
function encodeToZodDescriptor(term: TypeTerm): ZodDescriptor {
	switch (term.kind) {
		case "bottom":
			return { type: "never" };
		case "top":
			return { type: "unknown" };
		case "literal":
			return { type: "literal", value: term.value };
		case "base":
			switch (term.name) {
				case "string":
					return { type: "string" };
				case "number":
					return { type: "number" };
				case "boolean":
					return { type: "boolean" };
				case "date":
					return { type: "date" };
				case "null":
					return { type: "null" };
				case "undefined":
					return { type: "undefined" };
				default:
					throw new Error(`Cannot encode base type "${term.name}" to Zod`);
			}
		case "apply":
			return encodeApply(term);
		case "refinement": {
			const baseDesc = encodeToZodDescriptor(term.base);
			const checks = predicateToChecks(term.predicate);
			return checks.length === 0 ? baseDesc : { type: "refined", base: baseDesc, checks };
		}
		default:
			throw new Error(`Cannot encode ${term.kind} to Zod`);
	}
}

/**
 * Flatten an IR refinement predicate into a list of Zod-style chainable
 * checks. `andPredicate(a, b)` concatenates both sub-lists, matching
 * Zod's `.min(0).max(100).multipleOf(5)` shape. `orPredicate` and
 * `notPredicate` have no native Zod analogue and are encoded as opaque
 * `refine` placeholders so the bytes survive round-trip.
 */
function predicateToChecks(p: RefinementPredicate): ZodCheck[] {
	switch (p.kind) {
		case "range": {
			const out: ZodCheck[] = [];
			if (p.min !== undefined) {
				out.push({
					kind: "min",
					value: p.min,
					...(p.exclusive ? { exclusive: true } : {}),
				});
			}
			if (p.max !== undefined) {
				out.push({
					kind: "max",
					value: p.max,
					...(p.exclusive ? { exclusive: true } : {}),
				});
			}
			return out;
		}
		case "pattern":
			return [{ kind: "regex", value: p.regex }];
		case "multipleOf":
			return [{ kind: "multipleOf", value: p.divisor }];
		case "and":
			return [...predicateToChecks(p.left), ...predicateToChecks(p.right)];
		case "custom":
			if (p.name === "stringLength" && p.params) {
				const params = p.params as { min?: number; max?: number };
				const out: ZodCheck[] = [];
				if (params.min !== undefined) out.push({ kind: "minLength", value: params.min });
				if (params.max !== undefined) out.push({ kind: "maxLength", value: params.max });
				return out;
			}
			return [
				{
					kind: "refine",
					name: p.name,
					...(p.params !== undefined ? { params: p.params } : {}),
				},
			];
		case "or":
		case "not":
			// No native Zod or/not for refinements; record as an opaque check
			// so the round-trip is byte-stable even if Zod semantics aren't.
			return [{ kind: "refine", name: p.kind }];
		default:
			return [];
	}
}

// Encode an "apply" term (product, array, tuple, union, intersection).
function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): ZodDescriptor {
	switch (term.constructor) {
		case "product": {
			const shape: Record<string, ZodDescriptor> = {};
			const optional: string[] = [];
			for (const f of term.fields ?? []) {
				shape[f.name] = encodeToZodDescriptor(f.type);
				if (f.optional) optional.push(f.name);
			}
			return { type: "object", shape, ...(optional.length > 0 ? { optional } : {}) };
		}
		case "array":
			return { type: "array", element: encodeToZodDescriptor(term.args[0]!) };
		case "tuple":
			return { type: "tuple", elements: term.args.map(encodeToZodDescriptor) };
		case "union":
			return { type: "union", options: term.args.map(encodeToZodDescriptor) };
		case "intersection":
			if (term.args.length !== 2) {
				throw new Error("Zod intersection requires exactly 2 members");
			}
			return {
				type: "intersection",
				left: encodeToZodDescriptor(term.args[0]!),
				right: encodeToZodDescriptor(term.args[1]!),
			};
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to Zod`);
	}
}

// ─── Inhabitation ──────────────────────────────────────────────────

// Test whether a runtime value inhabits a TypeTerm.
function checkInhabitation(value: unknown, term: TypeTerm): boolean {
	switch (term.kind) {
		case "bottom":
			return false;
		case "top":
			return true;
		case "literal":
			return value === term.value;
		case "base":
			switch (term.name) {
				case "string":
					return typeof value === "string";
				case "number":
					return typeof value === "number";
				case "boolean":
					return typeof value === "boolean";
				case "date":
					return value instanceof Date;
				case "null":
					return value === null;
				case "undefined":
					return value === undefined;
				default:
					return false;
			}
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
			// Opaque custom predicates accept by default — we can't run them.
			return true;
		default:
			return true;
	}
}

// Test inhabitation for "apply" terms (product, array, tuple, union, intersection).
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
			return Array.isArray(value) && value.every((v) => checkInhabitation(v, term.args[0]!));
		case "tuple":
			return (
				Array.isArray(value) &&
				value.length === term.args.length &&
				term.args.every((t, i) => checkInhabitation(value[i], t))
			);
		case "union":
			return term.args.some((a) => checkInhabitation(value, a));
		case "intersection":
			return term.args.every((a) => checkInhabitation(value, a));
		default:
			return false;
	}
}
