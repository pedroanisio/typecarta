// TypeScript type adapter.
//
// Implement IRAdapter<Signature, TSTypeDescriptor> using descriptor objects
// that represent TypeScript types, not the actual TypeScript compiler API.

import type {
	IRAdapter,
	RefinementPredicate,
	Signature,
	TypeTerm,
	Variance,
} from "@typecarta/core";
import {
	andPredicate,
	array,
	arrow,
	base,
	bottom,
	complement,
	conditional,
	createSignature,
	extension,
	field,
	forall,
	intersection,
	keyOf,
	letBinding,
	literal,
	map,
	mapped,
	mu,
	multipleOfConstraint,
	nominal,
	patternConstraint,
	product,
	rangeConstraint,
	refinement,
	top,
	tuple,
	typeVar,
	union,
} from "@typecarta/core";

// ─── Descriptor types — discriminated union of TS type descriptors ──

/**
 * A refinement check on a TypeScript value, mirroring the kinds of
 * narrowing TS supports via template-literal types, branded primitives,
 * and structural intersection guards. Refinement is *not* directly
 * expressible in TS's type system as a value-range predicate (TS has no
 * `number where 0 ≤ n ≤ 100`); these checks are carried in the
 * descriptor so the IR round-trip survives and a downstream emitter can
 * generate the closest TS approximation (template literal, branded
 * type, runtime guard).
 */
export type TSRefinementCheck =
	| { kind: "min"; value: number; exclusive?: boolean }
	| { kind: "max"; value: number; exclusive?: boolean }
	| { kind: "pattern"; value: string }
	| { kind: "multipleOf"; value: number }
	| { kind: "minLength"; value: number }
	| { kind: "maxLength"; value: number }
	| { kind: "refine"; name: string; params?: Record<string, unknown> };

/** Represent a TypeScript type as a plain descriptor object. */
export type TSTypeDescriptor =
	| { type: "string" }
	| { type: "number" }
	| { type: "boolean" }
	| { type: "null" }
	| { type: "undefined" }
	| { type: "void" }
	| { type: "never" }
	| { type: "unknown" }
	| { type: "any" }
	| { type: "symbol" }
	| { type: "bigint" }
	| { type: "literal"; value: string | number | boolean | null }
	| {
			type: "object";
			properties: Record<
				string,
				{ type: TSTypeDescriptor; optional?: boolean; readonly?: boolean }
			>;
	  }
	| { type: "array"; element: TSTypeDescriptor }
	| { type: "tuple"; elements: TSTypeDescriptor[] }
	| { type: "union"; members: TSTypeDescriptor[] }
	| { type: "intersection"; members: TSTypeDescriptor[] }
	| { type: "record"; key: TSTypeDescriptor; value: TSTypeDescriptor }
	| { type: "enum"; members: Record<string, string | number> }
	/** Type variable reference, e.g. `T` in `<T>(x: T) => T`. */
	| { type: "typeVar"; name: string }
	/** Generic type binding, e.g. `<T extends U = D>{body}`. */
	| {
			type: "generic";
			param: string;
			constraint?: TSTypeDescriptor;
			default?: TSTypeDescriptor;
			variance?: "in" | "out" | "in out";
			body: TSTypeDescriptor;
	  }
	/** Recursive type binding, e.g. `type List<T> = { head: T; tail: List<T> | null }`. */
	| { type: "recursive"; name: string; body: TSTypeDescriptor }
	/** Branded type — `T & { readonly __brand: "Tag" }`. */
	| { type: "brand"; tag: string; inner: TSTypeDescriptor; sealed?: boolean }
	/** Type alias / let binding — `type N = T; body referencing N`. */
	| { type: "alias"; name: string; binding: TSTypeDescriptor; body: TSTypeDescriptor }
	/** `Exclude<T, U>` — IR's complement. */
	| { type: "exclude"; base: TSTypeDescriptor; excluded: TSTypeDescriptor }
	/** Refinement carrier — a base TS type with one or more refinement checks. */
	| { type: "refined"; base: TSTypeDescriptor; checks: TSRefinementCheck[] }
	/** `keyof T`. */
	| { type: "keyof"; inner: TSTypeDescriptor }
	/** `{ [K in S]: F<K, S[K]> }` — mapped type. */
	| { type: "mapped"; keySource: TSTypeDescriptor; valueTransform: TSTypeDescriptor }
	/** `T extends U ? X : Y` — conditional type. */
	| {
			type: "conditional";
			check: TSTypeDescriptor;
			extends: TSTypeDescriptor;
			then: TSTypeDescriptor;
			else: TSTypeDescriptor;
	  }
	/** Opaque extension envelope for IR `extension` nodes that have no TS analogue. */
	| { type: "opaque"; extensionKind: string; payload: unknown }
	/** Function / arrow type, e.g. `(s: string) => number`. */
	| { type: "function"; params: TSTypeDescriptor[]; returns: TSTypeDescriptor };

// ─── Signature — base sorts and type constructors for the TS adapter ──

const TS_SIGNATURE: Signature = createSignature(
	[
		"string",
		"number",
		"boolean",
		"null",
		"undefined",
		"void",
		"never",
		"unknown",
		"symbol",
		"bigint",
	],
	[
		{ name: "product", arity: 1 },
		{ name: "array", arity: 1 },
		{ name: "union", arity: 2 },
		{ name: "intersection", arity: 2 },
		{ name: "tuple", arity: 1 },
		{ name: "map", arity: 2 },
		// `arrow` has variadic arity at the IR layer (params… + return).
		// Pick 2 (one param + return) as the canonical advertised arity;
		// witnesses with more parameters still encode correctly because
		// the adapter never re-checks arity against the signature.
		{ name: "arrow", arity: 2 },
	],
);

const TS_SUPPORTED_KINDS: ReadonlySet<TypeTerm["kind"]> = new Set([
	"bottom",
	"top",
	"literal",
	"base",
	"apply",
	// Tier 2 expansion (2026-05-18): TypeScript natively supports these.
	"var", // typeVar — generic parameters and bound variables
	"forall", // generics: <T>, <T extends U>, <T = D>, in/out variance
	"mu", // recursive types
	"nominal", // branded primitives
	"refinement", // template literals, branded primitives carrying predicates
	"keyof", // keyof T
	"mapped", // { [K in S]: F<K, S[K]> }
	"conditional", // T extends U ? X : Y
	"let", // type aliases
	"complement", // Exclude<T, U>
	"extension", // opaque envelope for IR nodes outside TS's vocabulary
]);

// ─── Adapter class — IRAdapter implementation for TypeScript descriptors ──

/** Adapt TypeScript type descriptors to and from the typecarta IR. */
export class TypeScriptAdapter implements IRAdapter<Signature, TSTypeDescriptor> {
	readonly name = "TypeScript";
	readonly specVersion = "5.7";
	readonly signature = TS_SIGNATURE;

	/**
	 * Parse a TS type descriptor into an IR type term.
	 *
	 * @param source - TS type descriptor to parse.
	 * @returns The corresponding IR {@link TypeTerm}.
	 */
	parse(source: TSTypeDescriptor): TypeTerm {
		return parseTSDescriptor(source);
	}

	/**
	 * Encode an IR type term back into a TS type descriptor.
	 *
	 * @param term - IR type term to encode.
	 * @returns The corresponding {@link TSTypeDescriptor}.
	 * @throws Error if the term contains constructs not representable in TypeScript.
	 */
	encode(term: TypeTerm): TSTypeDescriptor {
		return encodeToTSDescriptor(term);
	}

	/**
	 * Check whether an IR type term can be encoded as a TS descriptor.
	 *
	 * @param term - IR type term to test.
	 * @returns `true` if encoding would succeed, `false` otherwise.
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
		return TS_SUPPORTED_KINDS.has(kind);
	}

	/**
	 * Check whether a runtime value inhabits an IR type term.
	 *
	 * @param value - Runtime value to test.
	 * @param term - IR type term describing the expected type.
	 * @returns `true` if the value satisfies the type.
	 */
	inhabits(value: unknown, term: TypeTerm): boolean {
		return checkInhabitation(value, term);
	}

	/**
	 * Check structural assignability between two IR type terms (a <: b).
	 *
	 * @param a - Candidate subtype.
	 * @param b - Candidate supertype.
	 * @returns `true` if `a` is structurally assignable to `b`.
	 */
	operationalSubtype(a: TypeTerm, b: TypeTerm): boolean {
		return checkStructuralAssignability(a, b);
	}
}

// ─── Parse — convert TS descriptors to IR terms ──

function parseTSDescriptor(desc: TSTypeDescriptor): TypeTerm {
	switch (desc.type) {
		case "string":
			return base("string");
		case "number":
			return base("number");
		case "boolean":
			return base("boolean");
		case "null":
			return base("null");
		case "undefined":
			return base("undefined");
		case "void":
			return base("void");
		case "never":
			return bottom();
		case "unknown":
		case "any":
			return top();
		case "symbol":
			return base("symbol");
		case "bigint":
			return base("bigint");
		case "literal":
			return literal(desc.value);
		case "object": {
			const fields = Object.entries(desc.properties).map(([name, prop]) =>
				field(name, parseTSDescriptor(prop.type), {
					...(prop.optional !== undefined ? { optional: prop.optional } : {}),
					...(prop.readonly !== undefined ? { readonly: prop.readonly } : {}),
				}),
			);
			return product(fields);
		}
		case "array":
			return array(parseTSDescriptor(desc.element));
		case "tuple":
			return tuple(desc.elements.map(parseTSDescriptor));
		case "union":
			return union(desc.members.map(parseTSDescriptor));
		case "intersection":
			return intersection(desc.members.map(parseTSDescriptor));
		case "record":
			return map(parseTSDescriptor(desc.key), parseTSDescriptor(desc.value));
		case "enum":
			return union(Object.values(desc.members).map((v) => literal(v)));
		case "typeVar":
			return typeVar(desc.name);
		case "generic":
			return forall(desc.param, parseTSDescriptor(desc.body), {
				...(desc.constraint !== undefined ? { bound: parseTSDescriptor(desc.constraint) } : {}),
				...(desc.default !== undefined ? { default: parseTSDescriptor(desc.default) } : {}),
				...(desc.variance !== undefined
					? { variance: parseTSVariance(desc.variance) }
					: {}),
			});
		case "recursive":
			return mu(desc.name, parseTSDescriptor(desc.body));
		case "brand":
			return nominal(desc.tag, parseTSDescriptor(desc.inner), desc.sealed ?? false);
		case "alias":
			return letBinding(desc.name, parseTSDescriptor(desc.binding), parseTSDescriptor(desc.body));
		case "exclude": {
			// `Exclude<T, U>` ≈ T ∧ ¬U. We model it as a complement at the IR
			// layer when the base is `top` (i.e. plain `Exclude<unknown, U>`)
			// and as an intersection of base + complement otherwise.
			const inner = parseTSDescriptor(desc.excluded);
			const baseTerm = parseTSDescriptor(desc.base);
			if (baseTerm.kind === "top") return complement(inner);
			return intersection([baseTerm, complement(inner)]);
		}
		case "refined": {
			const baseTerm = parseTSDescriptor(desc.base);
			const predicate = checksToPredicate(desc.checks);
			return predicate !== undefined ? refinement(baseTerm, predicate) : baseTerm;
		}
		case "keyof":
			return keyOf(parseTSDescriptor(desc.inner));
		case "mapped":
			return mapped(parseTSDescriptor(desc.keySource), parseTSDescriptor(desc.valueTransform));
		case "conditional":
			return conditional(
				parseTSDescriptor(desc.check),
				parseTSDescriptor(desc.extends),
				parseTSDescriptor(desc.then),
				parseTSDescriptor(desc.else),
			);
		case "opaque":
			return extension(desc.extensionKind, desc.payload);
		case "function":
			return arrow(desc.params.map(parseTSDescriptor), parseTSDescriptor(desc.returns));
		default:
			return top();
	}
}

function parseTSVariance(v: "in" | "out" | "in out"): Variance {
	switch (v) {
		case "in":
			return "contravariant";
		case "out":
			return "covariant";
		case "in out":
			return "invariant";
	}
}

/**
 * Compose an array of TS refinement checks into a single IR predicate.
 * Multiple checks become a left-associated `andPredicate` tree. Adjacent
 * min/max collapse to a single `range` predicate.
 */
function checksToPredicate(checks: readonly TSRefinementCheck[]): RefinementPredicate | undefined {
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
			case "pattern":
				predicates.push(patternConstraint(check.value));
				break;
			case "multipleOf":
				predicates.push(multipleOfConstraint(check.value));
				break;
			case "minLength":
			case "maxLength":
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

	if (rangeMin !== undefined || rangeMax !== undefined) {
		const exclusive = (rangeMin?.exclusive ?? false) || (rangeMax?.exclusive ?? false);
		predicates.unshift(rangeConstraint(rangeMin?.value, rangeMax?.value, exclusive));
	}

	return predicates.reduce<RefinementPredicate | undefined>(
		(acc, p) => (acc === undefined ? p : andPredicate(acc, p)),
		undefined,
	);
}

// ─── Encode — convert IR terms back to TS descriptors ──

function encodeToTSDescriptor(term: TypeTerm): TSTypeDescriptor {
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
				case "null":
					return { type: "null" };
				case "undefined":
					return { type: "undefined" };
				case "void":
					return { type: "void" };
				case "symbol":
					return { type: "symbol" };
				case "bigint":
					return { type: "bigint" };
				default:
					throw new Error(`Cannot encode base type "${term.name}" to TypeScript`);
			}
		case "apply":
			return encodeApply(term);
		case "var":
			return { type: "typeVar", name: term.name };
		case "forall":
			return {
				type: "generic",
				param: term.var,
				...(term.bound !== undefined ? { constraint: encodeToTSDescriptor(term.bound) } : {}),
				...(term.default !== undefined ? { default: encodeToTSDescriptor(term.default) } : {}),
				...(term.variance !== undefined ? { variance: encodeTSVariance(term.variance) } : {}),
				body: encodeToTSDescriptor(term.body),
			};
		case "mu":
			return {
				type: "recursive",
				name: term.var,
				body: encodeToTSDescriptor(term.body),
			};
		case "nominal":
			return {
				type: "brand",
				tag: term.tag,
				inner: encodeToTSDescriptor(term.inner),
				...(term.sealed ? { sealed: true } : {}),
			};
		case "let":
			return {
				type: "alias",
				name: term.name,
				binding: encodeToTSDescriptor(term.binding),
				body: encodeToTSDescriptor(term.body),
			};
		case "complement":
			return {
				type: "exclude",
				base: { type: "unknown" },
				excluded: encodeToTSDescriptor(term.inner),
			};
		case "refinement": {
			const baseDesc = encodeToTSDescriptor(term.base);
			const checks = predicateToChecks(term.predicate);
			return checks.length === 0 ? baseDesc : { type: "refined", base: baseDesc, checks };
		}
		case "keyof":
			return { type: "keyof", inner: encodeToTSDescriptor(term.inner) };
		case "mapped":
			return {
				type: "mapped",
				keySource: encodeToTSDescriptor(term.keySource),
				valueTransform: encodeToTSDescriptor(term.valueTransform),
			};
		case "conditional":
			return {
				type: "conditional",
				check: encodeToTSDescriptor(term.check),
				extends: encodeToTSDescriptor(term.extends),
				then: encodeToTSDescriptor(term.then),
				else: encodeToTSDescriptor(term.else),
			};
		case "extension":
			return { type: "opaque", extensionKind: term.extensionKind, payload: term.payload };
		default:
			throw new Error(`Cannot encode ${(term as { kind: string }).kind} to TypeScript`);
	}
}

function encodeTSVariance(v: Variance): "in" | "out" | "in out" {
	switch (v) {
		case "covariant":
			return "out";
		case "contravariant":
			return "in";
		case "invariant":
		case "bivariant":
			return "in out";
	}
}

/**
 * Flatten an IR refinement predicate into a list of TS-style checks.
 * `andPredicate(a, b)` concatenates both sub-lists; `or` / `not` lack
 * a clean TS analogue and fall through to opaque `refine` placeholders
 * so bytes survive round-trip even when semantics don't.
 */
function predicateToChecks(p: RefinementPredicate): TSRefinementCheck[] {
	switch (p.kind) {
		case "range": {
			const out: TSRefinementCheck[] = [];
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
			return [{ kind: "pattern", value: p.regex }];
		case "multipleOf":
			return [{ kind: "multipleOf", value: p.divisor }];
		case "and":
			return [...predicateToChecks(p.left), ...predicateToChecks(p.right)];
		case "custom":
			if (p.name === "stringLength" && p.params) {
				const params = p.params as { min?: number; max?: number };
				const out: TSRefinementCheck[] = [];
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
			return [{ kind: "refine", name: p.kind }];
		default:
			return [];
	}
}

function encodeApply(term: Extract<TypeTerm, { kind: "apply" }>): TSTypeDescriptor {
	switch (term.constructor) {
		case "product": {
			const properties: Record<
				string,
				{ type: TSTypeDescriptor; optional?: boolean; readonly?: boolean }
			> = {};
			for (const f of term.fields ?? []) {
				properties[f.name] = {
					type: encodeToTSDescriptor(f.type),
					...(f.optional ? { optional: true } : {}),
					...(f.readonly ? { readonly: true } : {}),
				};
			}
			return { type: "object", properties };
		}
		case "array": {
			const el = term.args[0];
			if (!el) throw new Error("array constructor requires one argument");
			return { type: "array", element: encodeToTSDescriptor(el) };
		}
		case "tuple":
			return { type: "tuple", elements: term.args.map(encodeToTSDescriptor) };
		case "union":
			return { type: "union", members: term.args.map(encodeToTSDescriptor) };
		case "intersection":
			return { type: "intersection", members: term.args.map(encodeToTSDescriptor) };
		case "map": {
			const keyArg = term.args[0];
			const valArg = term.args[1];
			if (!keyArg || !valArg) throw new Error("map constructor requires two arguments");
			return {
				type: "record",
				key: encodeToTSDescriptor(keyArg),
				value: encodeToTSDescriptor(valArg),
			};
		}
		case "arrow": {
			// IR convention: arrow params come first, return type last.
			// SP48 builds `arrow([string], number)` → args = [string, number].
			// Tolerate a zero-arg `arrow([], ret)` for thunks (args = [ret]).
			if (term.args.length === 0) {
				throw new Error("arrow constructor requires at least a return type");
			}
			const params = term.args.slice(0, -1);
			const returnTerm = term.args[term.args.length - 1]!;
			return {
				type: "function",
				params: params.map(encodeToTSDescriptor),
				returns: encodeToTSDescriptor(returnTerm),
			};
		}
		default:
			throw new Error(`Cannot encode constructor "${term.constructor}" to TypeScript`);
	}
}

// ─── Inhabitation — runtime value-in-type checks ──

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
				case "null":
					return value === null;
				case "undefined":
					return value === undefined;
				case "void":
					return value === undefined;
				case "symbol":
					return typeof value === "symbol";
				case "bigint":
					return typeof value === "bigint";
				default:
					return false;
			}
		case "apply":
			return checkApplyInhabitation(value, term);
		case "refinement":
			return (
				checkInhabitation(value, term.base) && checkPredicateInhabitation(value, term.predicate)
			);
		case "nominal":
			// Branded types are structurally compatible at runtime — the brand
			// is a compile-time-only ghost field, so any value of the inner
			// type inhabits the nominal one.
			return checkInhabitation(value, term.inner);
		case "complement":
			return !checkInhabitation(value, term.inner);
		case "mu":
			// Approximate: check the body once with `term` substituted as itself
			// via a one-step unfold. Sufficient for shallow values; deep
			// recursive values would need a fixpoint check.
			return checkInhabitation(value, term.body);
		case "var":
		case "forall":
		case "keyof":
		case "mapped":
		case "conditional":
		case "extension":
			// Type-level constructs have no first-class runtime inhabitation
			// in TypeScript. Accept conservatively — these terms are emitted
			// at compile time, not validated at runtime.
			return true;
		case "let":
			return checkInhabitation(value, term.body);
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
			const elType = term.args[0];
			return Array.isArray(value) && !!elType && value.every((v) => checkInhabitation(v, elType));
		}
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
		case "map": {
			if (typeof value !== "object" || value === null) return false;
			const keyType = term.args[0];
			const valType = term.args[1];
			if (!keyType || !valType) return false;
			const obj = value as Record<string, unknown>;
			return Object.entries(obj).every(
				([k, v]) => checkInhabitation(k, keyType) && checkInhabitation(v, valType),
			);
		}
		case "arrow":
			// Function inhabitation is opaque at runtime: TS itself only knows
			// the call-signature shape, not whether `f(x)` will actually
			// return a value of the declared type. Accept any function value
			// and reject non-functions. Arity-checking would be unsound (TS
			// permits passing fewer arguments than declared parameters).
			return typeof value === "function";
		default:
			return false;
	}
}

// ─── Structural assignability — simplified a <: b mirroring TS rules ──

// Check structural assignability (a <: b) using TypeScript's structural rules.
function checkStructuralAssignability(a: TypeTerm, b: TypeTerm): boolean {
	// bottom is subtype of everything
	if (a.kind === "bottom") return true;
	// everything is subtype of top
	if (b.kind === "top") return true;
	// top is not subtype of anything except top
	if (a.kind === "top") return false;
	// bottom is supertype of nothing except bottom
	if (b.kind === "bottom") return false;

	// same literal
	if (a.kind === "literal" && b.kind === "literal") return a.value === b.value;

	// literal assignable to its base type
	if (a.kind === "literal" && b.kind === "base") {
		if (b.name === "string" && typeof a.value === "string") return true;
		if (b.name === "number" && typeof a.value === "number") return true;
		if (b.name === "boolean" && typeof a.value === "boolean") return true;
		if (b.name === "null" && a.value === null) return true;
		return false;
	}

	// same base type
	if (a.kind === "base" && b.kind === "base") return a.name === b.name;

	// union: a union is subtype of b if every branch of a is subtype of b
	if (a.kind === "apply" && a.constructor === "union") {
		return a.args.every((branch) => checkStructuralAssignability(branch, b));
	}
	// b is a union: a is subtype if a is subtype of some branch
	if (b.kind === "apply" && b.constructor === "union") {
		return b.args.some((branch) => checkStructuralAssignability(a, branch));
	}

	// intersection: a is subtype of an intersection if a is subtype of every member
	if (b.kind === "apply" && b.constructor === "intersection") {
		return b.args.every((member) => checkStructuralAssignability(a, member));
	}
	// a is an intersection: a is subtype of b if some member of a is subtype of b
	if (a.kind === "apply" && a.constructor === "intersection") {
		return a.args.some((member) => checkStructuralAssignability(member, b));
	}

	// product (structural): a product is subtype if it has all required fields of b
	if (
		a.kind === "apply" &&
		a.constructor === "product" &&
		b.kind === "apply" &&
		b.constructor === "product"
	) {
		const aFields = new Map((a.fields ?? []).map((f) => [f.name, f]));
		for (const bf of b.fields ?? []) {
			const af = aFields.get(bf.name);
			if (!af) {
				if (!bf.optional) return false;
				continue;
			}
			if (!checkStructuralAssignability(af.type, bf.type)) return false;
			// optional in a but required in b is not assignable
			if (af.optional && !bf.optional) return false;
		}
		return true;
	}

	// array covariance
	if (
		a.kind === "apply" &&
		a.constructor === "array" &&
		b.kind === "apply" &&
		b.constructor === "array"
	) {
		const aEl = a.args[0];
		const bEl = b.args[0];
		if (!aEl || !bEl) return false;
		return checkStructuralAssignability(aEl, bEl);
	}

	// tuple: same length, element-wise subtype
	if (
		a.kind === "apply" &&
		a.constructor === "tuple" &&
		b.kind === "apply" &&
		b.constructor === "tuple"
	) {
		if (a.args.length !== b.args.length) return false;
		return a.args.every((at, i) => {
			const bt = b.args[i];
			return bt !== undefined && checkStructuralAssignability(at, bt);
		});
	}

	// map covariance on value
	if (
		a.kind === "apply" &&
		a.constructor === "map" &&
		b.kind === "apply" &&
		b.constructor === "map"
	) {
		const aKey = a.args[0];
		const aVal = a.args[1];
		const bKey = b.args[0];
		const bVal = b.args[1];
		if (!aKey || !aVal || !bKey || !bVal) return false;
		return checkStructuralAssignability(aKey, bKey) && checkStructuralAssignability(aVal, bVal);
	}

	return false;
}
