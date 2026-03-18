import {
	type CriterionPredicate,
	type IRAdapter,
	JSON_SIGNATURE,
	// Criteria
	PI_CRITERIA,
	type PiId,
	type ScorecardCell,
	type ScorecardResult,
	type Signature,
	// Types
	type TypeTerm,
	type TypeTermVisitor,
	andPredicate,
	apply,
	array,
	arrow,
	base,
	// Constructors
	bottom,
	// Traversal
	children,
	collect,
	// Scorecard
	compareScorecards,
	complement,
	conditional,
	// Signature
	createSignature,
	evaluateScorecard,
	extension,
	field,
	fold,
	forall,
	// Free vars
	freeVars,
	getArity,
	hasBaseType,
	hasConstructor,
	intersection,
	keyOf,
	letBinding,
	literal,
	map,
	mapChildren,
	mapped,
	mu,
	nominal,
	notPredicate,
	orPredicate,
	patternConstraint,
	// Print
	printTerm,
	product,
	rangeConstraint,
	refinement,
	renderComparisonMarkdown,
	resetFreshCounter,
	rowPoly,
	set,
	// Substitution
	substitute,
	templateLiteral,
	top,
	transform,
	tuple,
	typeVar,
	union,
	visitPartial,
} from "@typecarta/core";
/**
 * Coverage tests for AST module (traversal, substitution, constructors, print,
 * signature, free-vars) and criteria predicates.
 */
import { beforeEach, describe, expect, it } from "vitest";

// ────────────────────────────────────────────────────────────────────
// §1 Signature
// ────────────────────────────────────────────────────────────────────
describe("Signature", () => {
	it("createSignature rejects duplicate base types", () => {
		expect(() => createSignature(["string", "string"], [])).toThrow("Duplicate base type names");
	});

	it("createSignature rejects duplicate constructor names", () => {
		expect(() =>
			createSignature(
				[],
				[
					{ name: "array", arity: 1 },
					{ name: "array", arity: 2 },
				],
			),
		).toThrow("Duplicate constructor names");
	});

	it("createSignature rejects non-positive arity", () => {
		expect(() => createSignature([], [{ name: "bad", arity: 0 }])).toThrow("positive arity");
	});

	it("getArity returns correct arity", () => {
		const sig = createSignature([], [{ name: "list", arity: 1 }]);
		expect(getArity(sig, "list")).toBe(1);
	});

	it("getArity returns undefined for unknown constructor", () => {
		const sig = createSignature([], [{ name: "list", arity: 1 }]);
		expect(getArity(sig, "set")).toBeUndefined();
	});

	it("hasBaseType checks membership", () => {
		expect(hasBaseType(JSON_SIGNATURE, "string")).toBe(true);
		expect(hasBaseType(JSON_SIGNATURE, "bigint")).toBe(false);
	});

	it("hasConstructor checks membership", () => {
		expect(hasConstructor(JSON_SIGNATURE, "product")).toBe(true);
		expect(hasConstructor(JSON_SIGNATURE, "arrow")).toBe(false);
	});

	it("JSON_SIGNATURE has expected shape", () => {
		expect(JSON_SIGNATURE.baseTypes).toContain("string");
		expect(JSON_SIGNATURE.baseTypes).toContain("number");
		expect(JSON_SIGNATURE.constructors.length).toBeGreaterThan(0);
	});
});

// ────────────────────────────────────────────────────────────────────
// §2 Constructors
// ────────────────────────────────────────────────────────────────────
describe("Constructors", () => {
	it("set() creates Apply with constructor 'set'", () => {
		const s = set(base("string"));
		expect(s.kind).toBe("apply");
		expect(s.constructor).toBe("set");
		expect(s.args).toHaveLength(1);
	});

	it("map() creates Apply with key and value args", () => {
		const m = map(base("string"), base("number"));
		expect(m.constructor).toBe("map");
		expect(m.args).toHaveLength(2);
	});

	it("arrow() creates function type", () => {
		const a = arrow([base("string")], base("boolean"));
		expect(a.constructor).toBe("arrow");
		expect(a.args).toHaveLength(2);
	});

	it("tuple() creates positional tuple", () => {
		const t = tuple([base("string"), base("number")]);
		expect(t.constructor).toBe("tuple");
		expect(t.args).toHaveLength(2);
	});

	it("templateLiteral() creates concat Apply", () => {
		const tl = templateLiteral([literal("hello"), base("string")]);
		expect(tl.constructor).toBe("concat");
		expect(tl.args).toHaveLength(2);
	});

	it("rowPoly() creates rowpoly node", () => {
		const rp = rowPoly([field("x", base("number"))], "R");
		expect(rp.kind).toBe("rowpoly");
		expect(rp.rowVar).toBe("R");
		expect(rp.fields).toHaveLength(1);
	});

	it("keyOf() creates keyof node", () => {
		const k = keyOf(base("string"));
		expect(k.kind).toBe("keyof");
		expect(k.inner).toEqual(base("string"));
	});

	it("conditional() creates conditional node", () => {
		const c = conditional(typeVar("T"), base("string"), literal(true), literal(false));
		expect(c.kind).toBe("conditional");
		expect(c.check).toEqual(typeVar("T"));
	});

	it("mapped() creates mapped node", () => {
		const m = mapped(base("string"), base("number"));
		expect(m.kind).toBe("mapped");
	});

	it("extension() creates extension node", () => {
		const e = extension("custom", { data: 42 });
		expect(e.kind).toBe("extension");
		expect(e.extensionKind).toBe("custom");
		expect(e.payload).toEqual({ data: 42 });
	});

	it("letBinding() creates let node with annotations", () => {
		const lb = letBinding("x", base("string"), typeVar("x"), { doc: "alias" });
		expect(lb.kind).toBe("let");
		expect(lb.name).toBe("x");
		expect(lb.annotations).toEqual({ doc: "alias" });
	});

	it("field() with all options", () => {
		const f = field("age", base("number"), {
			optional: true,
			readonly: true,
			defaultValue: 0,
			annotations: { desc: "age" },
		});
		expect(f.optional).toBe(true);
		expect(f.readonly).toBe(true);
		expect(f.defaultValue).toBe(0);
		expect(f.annotations).toEqual({ desc: "age" });
	});

	it("orPredicate() creates or refinement", () => {
		const p = orPredicate(rangeConstraint(0, 10), patternConstraint("^\\d+$"));
		expect(p.kind).toBe("or");
	});

	it("notPredicate() creates not refinement", () => {
		const p = notPredicate(rangeConstraint(0, 10));
		expect(p.kind).toBe("not");
	});
});

// ────────────────────────────────────────────────────────────────────
// §3 Traversal
// ────────────────────────────────────────────────────────────────────
describe("Traversal", () => {
	describe("children", () => {
		it("forall with bound and default", () => {
			const node = forall("T", typeVar("T"), {
				bound: base("string"),
				default: base("number"),
			});
			const ch = children(node);
			expect(ch).toHaveLength(3); // body, bound, default
			expect(ch).toContainEqual(typeVar("T"));
			expect(ch).toContainEqual(base("string"));
			expect(ch).toContainEqual(base("number"));
		});

		it("mu returns body", () => {
			const node = mu("X", typeVar("X"));
			expect(children(node)).toEqual([typeVar("X")]);
		});

		it("refinement returns base", () => {
			const node = refinement(base("number"), rangeConstraint(0, 10));
			expect(children(node)).toEqual([base("number")]);
		});

		it("complement returns inner", () => {
			const node = complement(base("string"));
			expect(children(node)).toEqual([base("string")]);
		});

		it("keyof returns inner", () => {
			const node = keyOf(base("object"));
			expect(children(node)).toEqual([base("object")]);
		});

		it("conditional returns four children", () => {
			const node = conditional(typeVar("T"), base("string"), literal(true), literal(false));
			expect(children(node)).toHaveLength(4);
		});

		it("mapped returns keySource and valueTransform", () => {
			const node = mapped(base("string"), base("number"));
			expect(children(node)).toHaveLength(2);
		});

		it("rowpoly returns field types", () => {
			const node = rowPoly([field("x", base("number")), field("y", base("string"))], "R");
			expect(children(node)).toHaveLength(2);
		});

		it("nominal returns inner", () => {
			const node = nominal("UserId", base("string"));
			expect(children(node)).toEqual([base("string")]);
		});

		it("let returns binding and body", () => {
			const node = letBinding("x", base("string"), typeVar("x"));
			expect(children(node)).toHaveLength(2);
		});

		it("extension with children", () => {
			const node = extension("custom", {}, [base("string"), base("number")]);
			expect(children(node)).toHaveLength(2);
		});

		it("extension without children returns empty", () => {
			const node = extension("custom", {});
			expect(children(node)).toEqual([]);
		});
	});

	describe("mapChildren", () => {
		const upper = (t: TypeTerm): TypeTerm => (t.kind === "base" ? base(t.name.toUpperCase()) : t);

		it("maps forall with bound and default", () => {
			const node = forall("T", base("body"), {
				bound: base("bound"),
				default: base("def"),
			});
			const result = mapChildren(node, upper) as typeof node;
			expect(result.kind).toBe("forall");
			expect((result.body as { name: string }).name).toBe("BODY");
			expect((result.bound as { name: string }).name).toBe("BOUND");
			expect((result.default as { name: string }).name).toBe("DEF");
		});

		it("maps mu body", () => {
			const node = mu("X", base("inner"));
			const result = mapChildren(node, upper);
			expect(result.kind).toBe("mu");
			expect((result as { kind: "mu"; body: TypeTerm }).body).toEqual(base("INNER"));
		});

		it("maps refinement base", () => {
			const node = refinement(base("num"), rangeConstraint(0));
			const result = mapChildren(node, upper);
			expect((result as { kind: "refinement"; base: TypeTerm }).base).toEqual(base("NUM"));
		});

		it("maps complement inner", () => {
			const result = mapChildren(complement(base("x")), upper);
			expect((result as { kind: "complement"; inner: TypeTerm }).inner).toEqual(base("X"));
		});

		it("maps keyof inner", () => {
			const result = mapChildren(keyOf(base("obj")), upper);
			expect((result as { kind: "keyof"; inner: TypeTerm }).inner).toEqual(base("OBJ"));
		});

		it("maps conditional all four positions", () => {
			const node = conditional(base("a"), base("b"), base("c"), base("d"));
			const result = mapChildren(node, upper) as Extract<TypeTerm, { kind: "conditional" }>;
			expect((result.check as { name: string }).name).toBe("A");
			expect((result.extends as { name: string }).name).toBe("B");
			expect((result.then as { name: string }).name).toBe("C");
			expect((result.else as { name: string }).name).toBe("D");
		});

		it("maps mapped keySource and valueTransform", () => {
			const node = mapped(base("key"), base("val"));
			const result = mapChildren(node, upper) as Extract<TypeTerm, { kind: "mapped" }>;
			expect((result.keySource as { name: string }).name).toBe("KEY");
			expect((result.valueTransform as { name: string }).name).toBe("VAL");
		});

		it("maps rowpoly field types", () => {
			const node = rowPoly([field("x", base("num"))], "R");
			const result = mapChildren(node, upper) as Extract<TypeTerm, { kind: "rowpoly" }>;
			expect(result.fields[0]!.type).toEqual(base("NUM"));
		});

		it("maps nominal inner", () => {
			const result = mapChildren(nominal("Id", base("str")), upper);
			expect((result as { kind: "nominal"; inner: TypeTerm }).inner).toEqual(base("STR"));
		});

		it("maps let binding and body", () => {
			const node = letBinding("x", base("binding"), base("body"));
			const result = mapChildren(node, upper) as Extract<TypeTerm, { kind: "let" }>;
			expect((result.binding as { name: string }).name).toBe("BINDING");
			expect((result.body as { name: string }).name).toBe("BODY");
		});

		it("maps extension with children", () => {
			const node = extension("custom", {}, [base("a"), base("b")]);
			const result = mapChildren(node, upper) as Extract<TypeTerm, { kind: "extension" }>;
			expect(result.children).toEqual([base("A"), base("B")]);
		});

		it("returns extension unchanged without children", () => {
			const node = extension("custom", { x: 1 });
			const result = mapChildren(node, upper);
			expect(result).toBe(node);
		});
	});

	describe("visitPartial with fallback", () => {
		it("calls handler when kind matches", () => {
			const result = visitPartial(
				base("string"),
				{ base: (n) => `base:${n.name}` },
				() => "fallback",
			);
			expect(result).toBe("base:string");
		});

		it("calls fallback when kind not in visitor", () => {
			const result = visitPartial(
				typeVar("T"),
				{ base: (n) => `base:${n.name}` },
				(node) => `fallback:${node.kind}`,
			);
			expect(result).toBe("fallback:var");
		});
	});

	describe("fold over complex nodes", () => {
		it("folds conditional node bottom-up", () => {
			const node = conditional(base("A"), base("B"), base("C"), base("D"));
			const algebra: TypeTermVisitor<number> = {
				bottom: () => 0,
				top: () => 0,
				literal: () => 1,
				base: () => 1,
				var: () => 1,
				apply: () => 0,
				forall: () => 0,
				mu: () => 0,
				refinement: () => 0,
				complement: () => 0,
				keyof: () => 0,
				conditional: () => 99,
				mapped: () => 0,
				rowpoly: () => 0,
				nominal: () => 0,
				let: () => 0,
				extension: () => 0,
			};
			expect(fold(node, algebra)).toBe(99);
		});
	});

	describe("transform over complex nodes", () => {
		it("transforms nested conditional bottom-up", () => {
			const node = conditional(base("A"), base("B"), base("C"), base("D"));
			const result = transform(node, (n) => {
				if (n.kind === "base") return base(n.name.toLowerCase());
				return n;
			}) as Extract<TypeTerm, { kind: "conditional" }>;
			expect((result.check as { name: string }).name).toBe("a");
			expect((result.extends as { name: string }).name).toBe("b");
		});

		it("transforms mu bottom-up", () => {
			const node = mu("X", base("INNER"));
			const result = transform(node, (n) => {
				if (n.kind === "base") return base(n.name.toLowerCase());
				return n;
			}) as Extract<TypeTerm, { kind: "mu" }>;
			expect((result.body as { name: string }).name).toBe("inner");
		});
	});
});

// ────────────────────────────────────────────────────────────────────
// §4 Substitution
// ────────────────────────────────────────────────────────────────────
describe("Substitution", () => {
	beforeEach(() => resetFreshCounter());

	it("mu: shadowed variable is not substituted", () => {
		const node = mu("X", typeVar("X"));
		const result = substitute(node, "X", base("number"));
		expect(result).toEqual(mu("X", typeVar("X")));
	});

	it("mu: capture avoidance renames bound var", () => {
		// mu Y. (Y, X)  and replace X with Y  =>  should rename Y to Y$1
		const body = apply("pair", [typeVar("Y"), typeVar("X")]);
		const node = mu("Y", body);
		const result = substitute(node, "X", typeVar("Y"));
		expect(result.kind).toBe("mu");
		const muResult = result as Extract<TypeTerm, { kind: "mu" }>;
		expect(muResult.var).toBe("Y$1"); // freshened
	});

	it("mu: no capture needed when replacement is safe", () => {
		const body = apply("pair", [typeVar("Y"), typeVar("X")]);
		const node = mu("Y", body);
		const result = substitute(node, "X", base("string"));
		const muResult = result as Extract<TypeTerm, { kind: "mu" }>;
		expect(muResult.var).toBe("Y"); // unchanged
	});

	it("let: substitution in binding but shadowed in body", () => {
		const node = letBinding("X", typeVar("X"), typeVar("X"));
		const result = substitute(node, "X", base("number"));
		const letResult = result as Extract<TypeTerm, { kind: "let" }>;
		// binding is substituted, body is shadowed
		expect(letResult.binding).toEqual(base("number"));
		expect(letResult.body).toEqual(typeVar("X"));
	});

	it("let: capture avoidance when replacement has free var matching bound name", () => {
		// let Y = X in (Y, Z)  replace Z with Y  => capture avoidance needed
		const node = letBinding("Y", typeVar("X"), apply("pair", [typeVar("Y"), typeVar("Z")]));
		const result = substitute(node, "Z", typeVar("Y"));
		const letResult = result as Extract<TypeTerm, { kind: "let" }>;
		expect(letResult.name).toBe("Y$1"); // freshened
	});

	it("let: no capture needed when safe", () => {
		const node = letBinding("Y", typeVar("X"), apply("pair", [typeVar("Y"), typeVar("Z")]));
		const result = substitute(node, "Z", base("string"));
		const letResult = result as Extract<TypeTerm, { kind: "let" }>;
		expect(letResult.name).toBe("Y"); // unchanged
	});

	it("rowpoly: substitution in fields when rowVar shadows", () => {
		const node = rowPoly([field("x", typeVar("X"))], "X");
		const result = substitute(node, "X", base("number"));
		const rpResult = result as Extract<TypeTerm, { kind: "rowpoly" }>;
		// rowVar shadows, but fields are still substituted
		expect(rpResult.fields[0]!.type).toEqual(base("number"));
	});

	it("rowpoly: capture avoidance when replacement free var clashes with rowVar", () => {
		const node = rowPoly([field("x", typeVar("Z"))], "R");
		const result = substitute(node, "Z", typeVar("R"));
		const rpResult = result as Extract<TypeTerm, { kind: "rowpoly" }>;
		expect(rpResult.rowVar).toBe("R$1"); // freshened
	});

	it("rowpoly: normal substitution when safe", () => {
		const node = rowPoly([field("x", typeVar("Z"))], "R");
		const result = substitute(node, "Z", base("string"));
		const rpResult = result as Extract<TypeTerm, { kind: "rowpoly" }>;
		expect(rpResult.rowVar).toBe("R"); // unchanged
		expect(rpResult.fields[0]!.type).toEqual(base("string"));
	});

	it("conditional: substitutes all four positions", () => {
		const node = conditional(typeVar("X"), typeVar("X"), typeVar("X"), typeVar("X"));
		const result = substitute(node, "X", base("string")) as Extract<
			TypeTerm,
			{ kind: "conditional" }
		>;
		expect(result.check).toEqual(base("string"));
		expect(result.extends).toEqual(base("string"));
		expect(result.then).toEqual(base("string"));
		expect(result.else).toEqual(base("string"));
	});

	it("mapped: substitutes keySource and valueTransform", () => {
		const node = mapped(typeVar("X"), typeVar("X"));
		const result = substitute(node, "X", base("string")) as Extract<TypeTerm, { kind: "mapped" }>;
		expect(result.keySource).toEqual(base("string"));
		expect(result.valueTransform).toEqual(base("string"));
	});

	it("nominal: substitutes inner", () => {
		const node = nominal("UserId", typeVar("X"));
		const result = substitute(node, "X", base("string")) as Extract<TypeTerm, { kind: "nominal" }>;
		expect(result.inner).toEqual(base("string"));
	});

	it("extension: substitutes children if present", () => {
		const node = extension("custom", {}, [typeVar("X"), typeVar("Y")]);
		const result = substitute(node, "X", base("string")) as Extract<
			TypeTerm,
			{ kind: "extension" }
		>;
		expect(result.children![0]).toEqual(base("string"));
		expect(result.children![1]).toEqual(typeVar("Y"));
	});

	it("extension: returns unchanged when no children", () => {
		const node = extension("custom", { data: 42 });
		const result = substitute(node, "X", base("string"));
		expect(result).toBe(node);
	});

	it("refinement: substitutes base", () => {
		const node = refinement(typeVar("X"), rangeConstraint(0, 10));
		const result = substitute(node, "X", base("number")) as Extract<
			TypeTerm,
			{ kind: "refinement" }
		>;
		expect(result.base).toEqual(base("number"));
	});

	it("forall: capture avoidance when replacement contains bound var", () => {
		// forall T. (T, X) and replace X with T => rename T
		const node = forall("T", apply("pair", [typeVar("T"), typeVar("X")]));
		const result = substitute(node, "X", typeVar("T"));
		const fa = result as Extract<TypeTerm, { kind: "forall" }>;
		expect(fa.var).toBe("T$1"); // freshened
	});

	it("forall: shadowed variable not substituted in body", () => {
		const node = forall("X", typeVar("X"), { bound: typeVar("X") });
		const result = substitute(node, "X", base("number"));
		const fa = result as Extract<TypeTerm, { kind: "forall" }>;
		// body is shadowed, bound is substituted
		expect(fa.body).toEqual(typeVar("X"));
		expect(fa.bound).toEqual(base("number"));
	});

	it("complement: substitutes inner", () => {
		const node = complement(typeVar("X"));
		const result = substitute(node, "X", base("string"));
		expect((result as Extract<TypeTerm, { kind: "complement" }>).inner).toEqual(base("string"));
	});

	it("keyof: substitutes inner", () => {
		const node = keyOf(typeVar("X"));
		const result = substitute(node, "X", base("object"));
		expect((result as Extract<TypeTerm, { kind: "keyof" }>).inner).toEqual(base("object"));
	});
});

// ────────────────────────────────────────────────────────────────────
// §5 Print
// ────────────────────────────────────────────────────────────────────
describe("printTerm", () => {
	it("prints set", () => {
		expect(printTerm(set(base("string")))).toBe("Set<string>");
	});

	it("prints map", () => {
		expect(printTerm(map(base("string"), base("number")))).toBe("Map<string, number>");
	});

	it("prints arrow", () => {
		expect(printTerm(arrow([base("string")], base("boolean")))).toBe("(string) => boolean");
	});

	it("prints tuple", () => {
		expect(printTerm(tuple([base("string"), base("number")]))).toBe("[string, number]");
	});

	it("prints concat / templateLiteral", () => {
		expect(printTerm(templateLiteral([literal("hello"), base("string")]))).toBe('`"hello"string`');
	});

	it("prints rowpoly", () => {
		const rp = rowPoly([field("x", base("number"))], "R");
		expect(printTerm(rp)).toBe("{x: number | R}");
	});

	it("prints nominal (not sealed)", () => {
		const n = nominal("UserId", base("string"));
		expect(printTerm(n)).toBe("nominal(UserId, string)");
	});

	it("prints nominal (sealed)", () => {
		const n = nominal("UserId", base("string"), true);
		expect(printTerm(n)).toBe("opaque(UserId, string)");
	});

	it("prints let", () => {
		const lb = letBinding("X", base("string"), typeVar("X"));
		expect(printTerm(lb)).toBe("let X = string in X");
	});

	it("prints extension", () => {
		const ext = extension("custom", {});
		expect(printTerm(ext)).toBe("extension<custom>");
	});

	it("prints conditional", () => {
		const c = conditional(typeVar("T"), base("string"), literal(true), literal(false));
		expect(printTerm(c)).toBe("T extends string ? true : false");
	});

	it("prints mapped", () => {
		const m = mapped(base("string"), base("number"));
		expect(printTerm(m)).toBe("{[K in string]: number}");
	});

	it("prints keyof", () => {
		expect(printTerm(keyOf(base("object")))).toBe("keyof object");
	});

	it("prints complement", () => {
		expect(printTerm(complement(base("string")))).toContain("string");
	});

	it("prints mu", () => {
		expect(printTerm(mu("X", typeVar("X")))).toBe("\u03BCX. X");
	});

	it("prints forall with variance (covariant)", () => {
		const fa = forall("T", typeVar("T"), { variance: "covariant" });
		expect(printTerm(fa)).toContain("+T");
	});

	it("prints forall with variance (contravariant)", () => {
		const fa = forall("T", typeVar("T"), { variance: "contravariant" });
		expect(printTerm(fa)).toContain("-T");
	});

	it("prints forall with bound", () => {
		const fa = forall("T", typeVar("T"), { bound: base("string") });
		expect(printTerm(fa)).toContain("extends string");
	});

	it("prints forall with default", () => {
		const fa = forall("T", typeVar("T"), { default: base("number") });
		expect(printTerm(fa)).toContain("= number");
	});

	it("prints forall with bound and default and variance", () => {
		const fa = forall("T", typeVar("T"), {
			variance: "covariant",
			bound: base("string"),
			default: base("number"),
		});
		const printed = printTerm(fa);
		expect(printed).toContain("+T");
		expect(printed).toContain("extends string");
		expect(printed).toContain("= number");
	});
});

// ────────────────────────────────────────────────────────────────────
// §6 FreeVars
// ────────────────────────────────────────────────────────────────────
describe("freeVars", () => {
	it("rowpoly binding shadows rowVar in fields", () => {
		// rowpoly binds R; field types with R should not be free
		const node = rowPoly([field("x", typeVar("R"))], "R");
		const fv = freeVars(node);
		expect(fv.has("R")).toBe(false);
	});

	it("rowpoly does not shadow other vars in fields", () => {
		const node = rowPoly([field("x", typeVar("X"))], "R");
		const fv = freeVars(node);
		expect(fv.has("X")).toBe(true);
		expect(fv.has("R")).toBe(false);
	});
});

// ────────────────────────────────────────────────────────────────────
// §7 Criteria: pi-13 (Open Shape) and pi-14 (Dependent)
// ────────────────────────────────────────────────────────────────────
describe("Criteria predicates", () => {
	const pi13 = PI_CRITERIA.find((c) => c.id === "pi-13")!;
	const pi14 = PI_CRITERIA.find((c) => c.id === "pi-14")!;

	describe("pi-13: Open Shape", () => {
		it("detects open record via annotation", () => {
			const openProduct = product([field("x", base("number"))], { open: true });
			const result = pi13.evaluate(openProduct);
			expect(result.status).toBe("satisfied");
		});

		it("detects open record via rowpoly at top level", () => {
			const rp = rowPoly([field("x", base("number"))], "R");
			const result = pi13.evaluate(rp);
			expect(result.status).toBe("satisfied");
		});

		it("detects nested rowpoly", () => {
			const rp = rowPoly([field("x", base("number"))], "R");
			const wrapper = union([rp, base("string")]);
			const result = pi13.evaluate(wrapper);
			expect(result.status).toBe("satisfied");
		});

		it("reports not-satisfied for closed product", () => {
			const closed = product([field("x", base("number"))]);
			const result = pi13.evaluate(closed);
			expect(result.status).toBe("not-satisfied");
		});
	});

	describe("pi-14: Dependent Constraint", () => {
		it("detects discriminated union", () => {
			const branch1 = product([field("kind", literal("circle")), field("radius", base("number"))]);
			const branch2 = product([field("kind", literal("square")), field("side", base("number"))]);
			const du = union([branch1, branch2]);
			const result = pi14.evaluate(du);
			expect(result.status).toBe("satisfied");
		});

		it("detects conditional type as dependent", () => {
			const c = conditional(typeVar("T"), base("string"), literal(true), literal(false));
			const result = pi14.evaluate(c);
			expect(result.status).toBe("satisfied");
		});

		it("detects nested conditional", () => {
			const c = conditional(typeVar("T"), base("string"), literal(true), literal(false));
			const wrapper = array(c);
			const result = pi14.evaluate(wrapper);
			expect(result.status).toBe("satisfied");
		});

		it("detects nested discriminated union", () => {
			const branch1 = product([field("kind", literal("a")), field("data", base("string"))]);
			const branch2 = product([field("kind", literal("b")), field("data", base("number"))]);
			const du = union([branch1, branch2]);
			const wrapper = array(du);
			const result = pi14.evaluate(wrapper);
			expect(result.status).toBe("satisfied");
		});

		it("reports not-satisfied for plain product", () => {
			const p = product([field("x", base("number"))]);
			const result = pi14.evaluate(p);
			expect(result.status).toBe("not-satisfied");
		});
	});
});

// ────────────────────────────────────────────────────────────────────
// §8 Scorecard: comparison, render, evaluate
// ────────────────────────────────────────────────────────────────────
describe("Scorecard", () => {
	function makeScorecardResult(
		name: string,
		overrides: Partial<Record<PiId, ScorecardCell>>,
	): ScorecardResult {
		const cells = new Map<PiId, ScorecardCell>();
		const allIds: PiId[] = [
			"pi-01",
			"pi-02",
			"pi-03",
			"pi-04",
			"pi-05",
			"pi-06",
			"pi-07",
			"pi-08",
			"pi-09",
			"pi-10",
			"pi-11",
			"pi-12",
			"pi-13",
			"pi-14",
			"pi-15",
		];
		let satisfied = 0;
		let partial = 0;
		let notSatisfied = 0;

		for (const id of allIds) {
			const cell: ScorecardCell = overrides[id] ?? {
				criterionId: id,
				value: "\u2717", // X mark
			};
			cells.set(id, cell);
			if (cell.value === "\u2713") satisfied++;
			else if (cell.value === "partial") partial++;
			else notSatisfied++;
		}
		return { adapterName: name, cells, totals: { satisfied, partial, notSatisfied } };
	}

	describe("compareScorecards", () => {
		it("finds differences between two scorecards", () => {
			const left = makeScorecardResult("Adapter-A", {
				"pi-01": { criterionId: "pi-01", value: "\u2713" },
				"pi-02": { criterionId: "pi-02", value: "\u2717" },
			});
			const right = makeScorecardResult("Adapter-B", {
				"pi-01": { criterionId: "pi-01", value: "\u2717" },
				"pi-02": { criterionId: "pi-02", value: "\u2713" },
			});

			const comparison = compareScorecards(left, right);
			expect(comparison.differences.length).toBeGreaterThanOrEqual(2);
			const pi01Diff = comparison.differences.find((d) => d.criterionId === "pi-01");
			expect(pi01Diff).toBeDefined();
			expect(pi01Diff!.leftValue).toBe("\u2713");
			expect(pi01Diff!.rightValue).toBe("\u2717");
		});

		it("reports no differences for identical scorecards", () => {
			const card = makeScorecardResult("Adapter-A", {});
			const comparison = compareScorecards(card, card);
			expect(comparison.differences).toHaveLength(0);
		});
	});

	describe("renderComparisonMarkdown", () => {
		it("renders comparison with differences", () => {
			const left = makeScorecardResult("Adapter-A", {
				"pi-01": { criterionId: "pi-01", value: "\u2713" },
			});
			const right = makeScorecardResult("Adapter-B", {
				"pi-01": { criterionId: "pi-01", value: "\u2717" },
			});
			const comparison = compareScorecards(left, right);
			const md = renderComparisonMarkdown(comparison);

			expect(md).toContain("Adapter-A");
			expect(md).toContain("Adapter-B");
			expect(md).toContain("difference(s) found");
		});

		it("renders comparison with no differences", () => {
			const card = makeScorecardResult("Same", {});
			const comparison = compareScorecards(card, card);
			const md = renderComparisonMarkdown(comparison);
			expect(md).toContain("No differences");
		});
	});

	describe("evaluateScorecard", () => {
		function makeAdapter(overrides?: Partial<IRAdapter>): IRAdapter {
			return {
				name: "test-adapter",
				signature: createSignature(["string"], [{ name: "product", arity: 1 }]),
				parse: (source: unknown) => source as TypeTerm,
				encode: (term: TypeTerm) => term as unknown,
				isEncodable: () => true,
				inhabits: () => true,
				...overrides,
			};
		}

		it("returns undecidable/partial for criterion that returns undecidable", () => {
			const undecidableCriterion: CriterionPredicate = {
				id: "pi-01",
				name: "Test",
				description: "Test",
				evaluate: () => ({ status: "undecidable", reason: "Cannot decide" }),
			};

			const adapter = makeAdapter();
			const result = evaluateScorecard(
				adapter,
				[{ criterionId: "pi-01", schema: base("string"), name: "w1" }],
				[undecidableCriterion],
			);

			const cell = result.cells.get("pi-01");
			expect(cell).toBeDefined();
			expect(cell!.value).toBe("partial");
			expect(cell!.justification).toContain("Cannot decide");
		});

		it("catches errors during encode/parse and returns partial", () => {
			const throwingAdapter = makeAdapter({
				encode: () => {
					throw new Error("encode failed");
				},
			});

			const simpleCriterion: CriterionPredicate = {
				id: "pi-01",
				name: "Test",
				description: "Test",
				evaluate: () => ({ status: "satisfied" }),
			};

			const result = evaluateScorecard(
				throwingAdapter,
				[{ criterionId: "pi-01", schema: base("string"), name: "w1" }],
				[simpleCriterion],
			);

			const cell = result.cells.get("pi-01");
			expect(cell).toBeDefined();
			expect(cell!.value).toBe("partial");
			expect(cell!.justification).toContain("round-trip failed");
		});
	});
});
