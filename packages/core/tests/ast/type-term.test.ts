import {
	andPredicate,
	array,
	base,
	bottom,
	children,
	collect,
	complement,
	conditional,
	field,
	forall,
	freeVars,
	intersection,
	isKind,
	isTypeTerm,
	keyOf,
	letBinding,
	literal,
	mapChildren,
	mu,
	multipleOfConstraint,
	nominal,
	occursFree,
	patternConstraint,
	printTerm,
	product,
	rangeConstraint,
	refinement,
	resetFreshCounter,
	substitute,
	top,
	transform,
	typeVar,
	union,
} from "@typecarta/core";
import type { TypeTerm, TypeTermVisitor } from "@typecarta/core";
import { beforeEach, describe, expect, it } from "vitest";

describe("TypeTerm constructors", () => {
	it("creates bottom node", () => {
		const t = bottom();
		expect(t.kind).toBe("bottom");
	});

	it("creates top node", () => {
		const t = top();
		expect(t.kind).toBe("top");
	});

	it("creates literal nodes", () => {
		expect(literal(42).value).toBe(42);
		expect(literal("hello").value).toBe("hello");
		expect(literal(true).value).toBe(true);
		expect(literal(null).value).toBe(null);
	});

	it("creates base type nodes", () => {
		const t = base("string");
		expect(t.kind).toBe("base");
		expect(t.name).toBe("string");
	});

	it("creates variable nodes", () => {
		const t = typeVar("alpha");
		expect(t.kind).toBe("var");
		expect(t.name).toBe("alpha");
	});

	it("creates product with fields", () => {
		const t = product([field("x", base("number")), field("y", base("string"), { optional: true })]);
		expect(t.kind).toBe("apply");
		expect(t.constructor).toBe("product");
		expect(t.fields).toHaveLength(2);
		expect(t.fields![0]!.name).toBe("x");
		expect(t.fields![1]!.optional).toBe(true);
	});

	it("creates union", () => {
		const t = union([base("string"), base("number")]);
		expect(t.constructor).toBe("union");
		expect(t.args).toHaveLength(2);
	});

	it("creates intersection", () => {
		const t = intersection([base("string"), base("number")]);
		expect(t.constructor).toBe("intersection");
	});

	it("creates array", () => {
		const t = array(base("string"));
		expect(t.constructor).toBe("array");
		expect(t.args[0]!.kind).toBe("base");
	});

	it("creates mu (fixpoint)", () => {
		const t = mu(
			"alpha",
			product([field("value", base("string")), field("children", array(typeVar("alpha")))]),
		);
		expect(t.kind).toBe("mu");
		expect(t.var).toBe("alpha");
	});

	it("creates forall with bound and variance", () => {
		const t = forall("T", product([field("data", typeVar("T"))]), {
			bound: base("string"),
			variance: "covariant",
		});
		expect(t.kind).toBe("forall");
		expect(t.bound?.kind).toBe("base");
		expect(t.variance).toBe("covariant");
	});

	it("creates refinement with compound predicate", () => {
		const t = refinement(
			base("number"),
			andPredicate(rangeConstraint(0, 100), multipleOfConstraint(5)),
		);
		expect(t.kind).toBe("refinement");
		expect(t.predicate.kind).toBe("and");
	});

	it("creates nominal types", () => {
		const userId = nominal("UserId", base("string"));
		expect(userId.kind).toBe("nominal");
		expect(userId.tag).toBe("UserId");
		expect(userId.sealed).toBe(false);
	});

	it("creates complement", () => {
		const t = complement(base("string"));
		expect(t.kind).toBe("complement");
	});

	it("creates conditional type", () => {
		const t = conditional(typeVar("T"), base("string"), literal(true), literal(false));
		expect(t.kind).toBe("conditional");
	});

	it("creates let binding", () => {
		const t = letBinding("X", base("string"), typeVar("X"));
		expect(t.kind).toBe("let");
		expect(t.name).toBe("X");
	});
});

describe("type guards", () => {
	it("isTypeTerm validates correctly", () => {
		expect(isTypeTerm(bottom())).toBe(true);
		expect(isTypeTerm({ kind: "bottom" })).toBe(true);
		expect(isTypeTerm(null)).toBe(false);
		expect(isTypeTerm(42)).toBe(false);
		expect(isTypeTerm({})).toBe(false);
	});

	it("isKind narrows correctly", () => {
		const t: TypeTerm = literal(42);
		if (isKind(t, "literal")) {
			expect(t.value).toBe(42);
		}
	});
});

describe("traversal", () => {
	it("children returns direct children", () => {
		const t = union([base("string"), base("number")]);
		expect(children(t)).toHaveLength(2);
	});

	it("children returns empty for leaf nodes", () => {
		expect(children(bottom())).toHaveLength(0);
		expect(children(top())).toHaveLength(0);
		expect(children(literal(42))).toHaveLength(0);
		expect(children(base("string"))).toHaveLength(0);
		expect(children(typeVar("x"))).toHaveLength(0);
	});

	it("collect finds matching nodes", () => {
		const t = union([product([field("x", base("number"))]), product([field("y", base("string"))])]);
		const bases = collect(t, (n) => n.kind === "base");
		expect(bases).toHaveLength(2);
	});

	it("transform modifies tree", () => {
		const t = union([base("string"), base("number")]);
		const transformed = transform(t, (node) => {
			if (node.kind === "base" && node.name === "string") {
				return base("text");
			}
			return node;
		});
		expect(transformed.kind).toBe("apply");
		if (transformed.kind === "apply") {
			expect((transformed.args[0] as any).name).toBe("text");
		}
	});
});

describe("free variables", () => {
	it("finds free variables", () => {
		const t = product([field("x", typeVar("alpha")), field("y", typeVar("beta"))]);
		const fv = freeVars(t);
		expect(fv.has("alpha")).toBe(true);
		expect(fv.has("beta")).toBe(true);
	});

	it("respects forall binding", () => {
		const t = forall("alpha", product([field("x", typeVar("alpha")), field("y", typeVar("beta"))]));
		const fv = freeVars(t);
		expect(fv.has("alpha")).toBe(false);
		expect(fv.has("beta")).toBe(true);
	});

	it("respects mu binding", () => {
		const t = mu("alpha", array(typeVar("alpha")));
		const fv = freeVars(t);
		expect(fv.has("alpha")).toBe(false);
	});

	it("respects let binding", () => {
		const t = letBinding("X", base("string"), typeVar("X"));
		const fv = freeVars(t);
		expect(fv.has("X")).toBe(false);
	});

	it("occursFree checks correctly", () => {
		expect(occursFree("alpha", typeVar("alpha"))).toBe(true);
		expect(occursFree("alpha", typeVar("beta"))).toBe(false);
		expect(occursFree("alpha", forall("alpha", typeVar("alpha")))).toBe(false);
	});
});

describe("substitution", () => {
	beforeEach(() => resetFreshCounter());

	it("substitutes free variable", () => {
		const t = typeVar("alpha");
		const result = substitute(t, "alpha", base("string"));
		expect(result.kind).toBe("base");
		if (result.kind === "base") expect(result.name).toBe("string");
	});

	it("does not substitute bound variable in forall", () => {
		const t = forall("alpha", typeVar("alpha"));
		const result = substitute(t, "alpha", base("string"));
		// alpha is bound, so body should remain a variable
		expect(result.kind).toBe("forall");
		if (result.kind === "forall") {
			expect(result.body.kind).toBe("var");
		}
	});

	it("does not substitute bound variable in mu", () => {
		const t = mu("alpha", typeVar("alpha"));
		const result = substitute(t, "alpha", base("string"));
		expect(result.kind).toBe("mu");
		if (result.kind === "mu") {
			expect(result.body.kind).toBe("var");
		}
	});

	it("avoids capture in forall", () => {
		// forall beta. alpha — substitute alpha := beta
		// Must rename beta to avoid capture
		const t = forall("beta", typeVar("alpha"));
		const result = substitute(t, "alpha", typeVar("beta"));
		expect(result.kind).toBe("forall");
		if (result.kind === "forall") {
			expect(result.var).not.toBe("beta");
			expect(result.body.kind).toBe("var");
			if (result.body.kind === "var") {
				expect(result.body.name).toBe("beta");
			}
		}
	});

	it("leaves unrelated variables alone", () => {
		const t = typeVar("beta");
		const result = substitute(t, "alpha", base("string"));
		expect(result.kind).toBe("var");
		if (result.kind === "var") expect(result.name).toBe("beta");
	});
});

describe("pretty printer", () => {
	it("prints bottom", () => {
		expect(printTerm(bottom())).toBe("⊥");
	});

	it("prints top", () => {
		expect(printTerm(top())).toBe("⊤");
	});

	it("prints literals", () => {
		expect(printTerm(literal(42))).toBe("42");
		expect(printTerm(literal("hello"))).toBe('"hello"');
		expect(printTerm(literal(true))).toBe("true");
		expect(printTerm(literal(null))).toBe("null");
	});

	it("prints product", () => {
		const t = product([field("x", base("number")), field("y", base("string"))]);
		expect(printTerm(t)).toBe("{x: number, y: string}");
	});

	it("prints union", () => {
		const t = union([base("string"), base("number")]);
		expect(printTerm(t)).toBe("string | number");
	});

	it("prints mu", () => {
		const t = mu("alpha", typeVar("alpha"));
		expect(printTerm(t)).toBe("μalpha. alpha");
	});

	it("prints forall", () => {
		const t = forall("T", typeVar("T"));
		expect(printTerm(t)).toBe("ΛT. T");
	});

	it("prints refinement", () => {
		const t = refinement(base("number"), rangeConstraint(0, 100));
		expect(printTerm(t)).toBe("{v: number | v >= 0 ∧ v <= 100}");
	});

	it("prints array", () => {
		expect(printTerm(array(base("string")))).toBe("string[]");
	});
});
