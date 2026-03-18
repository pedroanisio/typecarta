import {
	PI_REGISTRY,
	array,
	arrow,
	base,
	bottom,
	field,
	forall,
	intersection,
	literal,
	mu,
	nominal,
	product,
	rangeConstraint,
	refinement,
	top,
	typeVar,
	union,
} from "@typecarta/core";
import { describe, expect, it } from "vitest";

/**
 * Tests for the collect() fallthrough path in each pi criterion predicate.
 *
 * Every pi-XX evaluate() method has three branches:
 *   1. Direct match at the root node
 *   2. Subterm match via collect() -- THIS FILE targets this branch
 *   3. Not satisfied
 *
 * Each test wraps the target term inside an unrelated container (product or
 * union) so the direct check at the root fails, forcing the collect() path
 * to discover the target in a nested position.
 */
describe("Pi criteria -- collect() subterm fallthrough", () => {
	// ── pi-01: Bottom ──────────────────────────────────────────────────
	it("pi-01 finds bottom nested inside a product", () => {
		const t = product([field("x", bottom())]);
		const result = PI_REGISTRY.get("pi-01")!.evaluate(t);
		expect(result.status).toBe("satisfied");
	});

	// ── pi-02: Top ─────────────────────────────────────────────────────
	it("pi-02 finds top nested inside a product", () => {
		const t = product([field("x", top())]);
		const result = PI_REGISTRY.get("pi-02")!.evaluate(t);
		expect(result.status).toBe("satisfied");
	});

	// ── pi-03: Literal / Unit ──────────────────────────────────────────
	it("pi-03 finds literal nested inside a product", () => {
		const t = product([field("x", literal(42))]);
		const result = PI_REGISTRY.get("pi-03")!.evaluate(t);
		expect(result.status).toBe("satisfied");
	});

	// ── pi-04: Product ─────────────────────────────────────────────────
	it("pi-04 finds product nested inside a union", () => {
		const t = union([product([field("x", base("number"))]), base("string")]);
		const result = PI_REGISTRY.get("pi-04")!.evaluate(t);
		expect(result.status).toBe("satisfied");
	});

	// ── pi-05: Sum / Union ─────────────────────────────────────────────
	it("pi-05 finds union nested inside a product", () => {
		const t = product([field("x", union([base("a"), base("b")]))]);
		const result = PI_REGISTRY.get("pi-05")!.evaluate(t);
		expect(result.status).toBe("satisfied");
	});

	// ── pi-06: Intersection ────────────────────────────────────────────
	it("pi-06 finds intersection nested inside a product", () => {
		const t = product([field("x", intersection([base("a"), base("b")]))]);
		const result = PI_REGISTRY.get("pi-06")!.evaluate(t);
		expect(result.status).toBe("satisfied");
	});

	// ── pi-07: Recursion ───────────────────────────────────────────────
	it("pi-07 finds mu nested inside a product", () => {
		const t = product([field("x", mu("a", typeVar("a")))]);
		const result = PI_REGISTRY.get("pi-07")!.evaluate(t);
		expect(result.status).toBe("satisfied");
	});

	// ── pi-08: Mutual Recursion ────────────────────────────────────────
	it("pi-08 finds mutual recursion nested inside a product", () => {
		const mutualRec = mu(
			"a",
			product([field("next", mu("b", product([field("items", array(typeVar("a")))])))]),
		);
		const t = product([field("x", mutualRec)]);
		const result = PI_REGISTRY.get("pi-08")!.evaluate(t);
		expect(result.status).toBe("satisfied");
	});

	// ── pi-09: Parametricity ───────────────────────────────────────────
	it("pi-09 finds forall nested inside a product", () => {
		const t = product([field("x", forall("T", typeVar("T")))]);
		const result = PI_REGISTRY.get("pi-09")!.evaluate(t);
		expect(result.status).toBe("satisfied");
	});

	// ── pi-10: Refinement ──────────────────────────────────────────────
	it("pi-10 finds refinement nested inside a product", () => {
		const t = product([field("x", refinement(base("number"), rangeConstraint(0, 10)))]);
		const result = PI_REGISTRY.get("pi-10")!.evaluate(t);
		expect(result.status).toBe("satisfied");
	});

	// ── pi-11: Optionality ─────────────────────────────────────────────
	it("pi-11 finds optional-field product nested inside a union", () => {
		const optProduct = product([field("x", base("string"), { optional: true })]);
		const t = union([optProduct, base("null")]);
		const result = PI_REGISTRY.get("pi-11")!.evaluate(t);
		expect(result.status).toBe("satisfied");
	});

	// ── pi-12: Nominal ─────────────────────────────────────────────────
	it("pi-12 finds nominal nested inside a product", () => {
		const t = product([field("x", nominal("Tag", base("string")))]);
		const result = PI_REGISTRY.get("pi-12")!.evaluate(t);
		expect(result.status).toBe("satisfied");
	});

	// ── pi-15: Higher-Kinded (arrow bound) ─────────────────────────────
	it("pi-15 finds HKT (arrow bound) nested inside a product", () => {
		const hkt = forall("F", typeVar("F"), {
			bound: arrow([base("*")], base("*")),
		});
		const t = product([field("x", hkt)]);
		const result = PI_REGISTRY.get("pi-15")!.evaluate(t);
		expect(result.status).toBe("satisfied");
	});

	// ── pi-15: Higher-Kinded (annotation-based) ────────────────────────
	it("pi-15 detects HKT via annotations at top level", () => {
		const hkt = forall("F", typeVar("F"), {
			annotations: { hkt: true },
		});
		const result = PI_REGISTRY.get("pi-15")!.evaluate(hkt);
		expect(result.status).toBe("satisfied");
	});

	it("pi-15 finds HKT via annotations nested inside a product", () => {
		const hkt = forall("F", typeVar("F"), {
			annotations: { hkt: true },
		});
		const t = product([field("x", hkt)]);
		const result = PI_REGISTRY.get("pi-15")!.evaluate(t);
		expect(result.status).toBe("satisfied");
	});
});
