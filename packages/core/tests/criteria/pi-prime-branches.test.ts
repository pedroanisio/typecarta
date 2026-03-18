import {
	FAMILY_A,
	FAMILY_B,
	FAMILY_C,
	FAMILY_D,
	FAMILY_E,
	FAMILY_F,
	FAMILY_G,
	FAMILY_H,
	FAMILY_I,
	FAMILY_J,
	FAMILY_K,
	FAMILY_L,
	FAMILY_M,
	FAMILY_N,
	FAMILY_O,
	FAMILY_P,
	FAMILY_Q,
	FAMILY_R,
	FAMILY_S,
	FAMILY_T,
	FAMILY_U,
	FAMILY_V,
	andPredicate,
	array,
	arrow,
	base,
	bottom,
	complement,
	conditional,
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
	rowPoly,
	set,
	templateLiteral,
	top,
	tuple,
	typeVar,
	union,
} from "@typecarta/core";
import { describe, expect, it } from "vitest";

describe("Π' branch coverage — subterm detection and rejection", () => {
	// Family A (7 criteria)
	describe("Family A", () => {
		it("π'₁ finds bottom in subterm", () => {
			expect(FAMILY_A[0]!.evaluate(product([field("x", bottom())])).status).toBe("satisfied");
		});
		it("π'₁ rejects non-bottom", () => {
			expect(FAMILY_A[0]!.evaluate(top()).status).toBe("not-satisfied");
		});
		it("π'₂ finds semantic emptiness in subterm", () => {
			expect(
				FAMILY_A[1]!.evaluate(product([field("x", refinement(base("n"), rangeConstraint(0)))]))
					.status,
			).toBe("satisfied");
		});
		it("π'₂ rejects when no emptiness pattern", () => {
			expect(FAMILY_A[1]!.evaluate(top()).status).toBe("not-satisfied");
		});
		it("π'₃ finds top in subterm", () => {
			expect(FAMILY_A[2]!.evaluate(product([field("x", top())])).status).toBe("satisfied");
		});
		it("π'₃ rejects non-top", () => {
			expect(FAMILY_A[2]!.evaluate(bottom()).status).toBe("not-satisfied");
		});
		it("π'₄ finds base in subterm", () => {
			expect(FAMILY_A[3]!.evaluate(product([field("x", base("string"))])).status).toBe("satisfied");
		});
		it("π'₄ rejects when no base type", () => {
			expect(FAMILY_A[3]!.evaluate(bottom()).status).toBe("not-satisfied");
		});
		it("π'₅ finds literal in subterm", () => {
			expect(FAMILY_A[4]!.evaluate(product([field("x", literal(1))])).status).toBe("satisfied");
		});
		it("π'₅ rejects non-literal", () => {
			expect(FAMILY_A[4]!.evaluate(top()).status).toBe("not-satisfied");
		});
		it("π'₆ finds enum in subterm", () => {
			expect(
				FAMILY_A[5]!.evaluate(product([field("x", union([literal("a"), literal("b")]))])).status,
			).toBe("satisfied");
		});
		it("π'₆ rejects non-enum", () => {
			expect(FAMILY_A[5]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₇ finds hetero enum in subterm", () => {
			expect(
				FAMILY_A[6]!.evaluate(product([field("x", union([literal(1), literal("a")]))])).status,
			).toBe("satisfied");
		});
		it("π'₇ rejects homo enum", () => {
			expect(FAMILY_A[6]!.evaluate(union([literal("a"), literal("b")])).status).toBe(
				"not-satisfied",
			);
		});
	});

	// Family B (3 criteria)
	describe("Family B", () => {
		it("π'₈ finds tuple in subterm", () => {
			expect(FAMILY_B[0]!.evaluate(product([field("x", tuple([base("n")]))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₈ rejects non-tuple", () => {
			expect(FAMILY_B[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₉ finds record in subterm", () => {
			expect(FAMILY_B[1]!.evaluate(union([product([field("x", base("n"))])])).status).toBe(
				"satisfied",
			);
		});
		it("π'₉ rejects non-record", () => {
			expect(FAMILY_B[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₁₀ finds variadic in subterm", () => {
			expect(
				FAMILY_B[2]!.evaluate(product([field("x", tuple([base("s"), array(base("n"))]))])).status,
			).toBe("satisfied");
		});
		it("π'₁₀ rejects non-variadic", () => {
			expect(FAMILY_B[2]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family C (5 criteria)
	describe("Family C", () => {
		it("π'₁₁ finds required in subterm", () => {
			expect(FAMILY_C[0]!.evaluate(union([product([field("x", base("n"))])])).status).toBe(
				"satisfied",
			);
		});
		it("π'₁₁ rejects when no required fields", () => {
			expect(FAMILY_C[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₁₂ finds optional in subterm", () => {
			expect(
				FAMILY_C[1]!.evaluate(union([product([field("x", base("n"), { optional: true })])])).status,
			).toBe("satisfied");
		});
		it("π'₁₂ rejects non-optional", () => {
			expect(FAMILY_C[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₁₃ finds nullable in subterm", () => {
			expect(
				FAMILY_C[2]!.evaluate(union([product([field("x", union([base("s"), base("null")]))])]))
					.status,
			).toBe("satisfied");
		});
		it("π'₁₃ rejects non-nullable", () => {
			expect(FAMILY_C[2]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₁₄ finds default in subterm", () => {
			expect(
				FAMILY_C[3]!.evaluate(union([product([field("x", base("s"), { defaultValue: "hi" })])]))
					.status,
			).toBe("satisfied");
		});
		it("π'₁₄ rejects no defaults", () => {
			expect(FAMILY_C[3]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₁₅ finds readonly in subterm", () => {
			expect(
				FAMILY_C[4]!.evaluate(union([product([field("x", base("s"), { readonly: true })])])).status,
			).toBe("satisfied");
		});
		it("π'₁₅ rejects non-readonly", () => {
			expect(FAMILY_C[4]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family D (3)
	describe("Family D", () => {
		it("π'₁₆ finds closed in subterm", () => {
			expect(FAMILY_D[0]!.evaluate(union([product([field("x", base("n"))])])).status).toBe(
				"satisfied",
			);
		});
		it("π'₁₆ rejects non-record", () => {
			expect(FAMILY_D[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₁₇ finds open in subterm", () => {
			expect(
				FAMILY_D[1]!.evaluate(union([product([field("x", base("n"))], { open: true })])).status,
			).toBe("satisfied");
		});
		it("π'₁₇ rejects closed", () => {
			expect(FAMILY_D[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₁₈ finds typed extras in subterm", () => {
			expect(
				FAMILY_D[2]!.evaluate(
					union([product([field("x", base("n"))], { additionalProperties: base("s") })]),
				).status,
			).toBe("satisfied");
		});
		it("π'₁₈ rejects no extras", () => {
			expect(FAMILY_D[2]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family E (4)
	describe("Family E", () => {
		it("π'₁₉ finds union in subterm", () => {
			expect(
				FAMILY_E[0]!.evaluate(product([field("x", union([base("a"), base("b")]))])).status,
			).toBe("satisfied");
		});
		it("π'₁₉ rejects non-union", () => {
			expect(FAMILY_E[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₂₀ finds disc union in subterm", () => {
			const du = union([product([field("t", literal("a"))]), product([field("t", literal("b"))])]);
			expect(FAMILY_E[1]!.evaluate(product([field("x", du)])).status).toBe("satisfied");
		});
		it("π'₂₀ rejects non-discriminated", () => {
			expect(FAMILY_E[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₂₁ finds shape-disc in subterm", () => {
			const sdu = union([product([field("x", base("n"))]), product([field("y", base("s"))])]);
			expect(FAMILY_E[2]!.evaluate(product([field("z", sdu)])).status).toBe("satisfied");
		});
		it("π'₂₁ rejects non-shape-disc", () => {
			expect(FAMILY_E[2]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₂₂ finds exhaustive in subterm", () => {
			expect(
				FAMILY_E[3]!.evaluate(
					product([field("x", union([base("a"), base("b")], { exhaustive: true }))]),
				).status,
			).toBe("satisfied");
		});
		it("π'₂₂ rejects non-exhaustive", () => {
			expect(FAMILY_E[3]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family F (2)
	describe("Family F", () => {
		it("π'₂₃ finds record-merge in subterm", () => {
			const rm = intersection([product([field("x", base("n"))]), product([field("y", base("s"))])]);
			expect(FAMILY_F[0]!.evaluate(product([field("z", rm)])).status).toBe("satisfied");
		});
		it("π'₂₃ rejects non-record-merge", () => {
			expect(FAMILY_F[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₂₄ finds ref intersection in subterm", () => {
			const ri = intersection([base("n"), refinement(base("n"), rangeConstraint(0))]);
			expect(FAMILY_F[1]!.evaluate(product([field("x", ri)])).status).toBe("satisfied");
		});
		it("π'₂₄ rejects non-ref-intersection", () => {
			expect(FAMILY_F[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family G (3)
	describe("Family G", () => {
		it("π'₂₅ finds mu in subterm", () => {
			expect(FAMILY_G[0]!.evaluate(product([field("x", mu("a", typeVar("a")))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₂₅ rejects non-mu", () => {
			expect(FAMILY_G[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₂₆ finds mutual rec in subterm", () => {
			expect(
				FAMILY_G[1]!.evaluate(product([field("x", mu("a", mu("b", typeVar("a"))))])).status,
			).toBe("satisfied");
		});
		it("π'₂₆ rejects non-mutual", () => {
			expect(FAMILY_G[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₂₇ finds recursive generic in subterm", () => {
			expect(
				FAMILY_G[2]!.evaluate(product([field("x", forall("T", mu("a", typeVar("a"))))])).status,
			).toBe("satisfied");
		});
		it("π'₂₇ rejects non-rec-generic", () => {
			expect(FAMILY_G[2]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family H (6)
	describe("Family H", () => {
		it("π'₂₈ finds forall in subterm", () => {
			expect(FAMILY_H[0]!.evaluate(product([field("x", forall("T", typeVar("T")))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₂₈ rejects non-forall", () => {
			expect(FAMILY_H[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₂₉ finds bounded in subterm", () => {
			expect(
				FAMILY_H[1]!.evaluate(
					product([field("x", forall("T", typeVar("T"), { bound: base("s") }))]),
				).status,
			).toBe("satisfied");
		});
		it("π'₂₉ rejects unbounded", () => {
			expect(FAMILY_H[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₃₀ finds default in subterm", () => {
			expect(
				FAMILY_H[2]!.evaluate(
					product([field("x", forall("T", typeVar("T"), { default: base("s") }))]),
				).status,
			).toBe("satisfied");
		});
		it("π'₃₀ rejects no-default", () => {
			expect(FAMILY_H[2]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₃₃ finds variance in subterm", () => {
			expect(
				FAMILY_H[5]!.evaluate(
					product([field("x", forall("T", typeVar("T"), { variance: "contravariant" }))]),
				).status,
			).toBe("satisfied");
		});
		it("π'₃₃ rejects no-variance", () => {
			expect(FAMILY_H[5]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family I (4)
	describe("Family I", () => {
		it("π'₃₄ rejects when nominal present", () => {
			expect(FAMILY_I[0]!.evaluate(nominal("X", base("s"))).status).toBe("not-satisfied");
		});
		it("π'₃₅ finds nominal in subterm", () => {
			expect(FAMILY_I[1]!.evaluate(product([field("x", nominal("X", base("s")))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₃₅ rejects non-nominal", () => {
			expect(FAMILY_I[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₃₆ finds sealed in subterm", () => {
			expect(
				FAMILY_I[2]!.evaluate(product([field("x", nominal("X", base("s"), true))])).status,
			).toBe("satisfied");
		});
		it("π'₃₆ rejects non-sealed", () => {
			expect(FAMILY_I[2]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₃₇ finds coercion in subterm", () => {
			expect(FAMILY_I[3]!.evaluate(product([field("x", extension("coercion", {}))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₃₇ rejects non-coercion", () => {
			expect(FAMILY_I[3]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family J (6)
	describe("Family J", () => {
		it("π'₃₈ finds range in subterm", () => {
			expect(
				FAMILY_J[0]!.evaluate(product([field("x", refinement(base("n"), rangeConstraint(0)))]))
					.status,
			).toBe("satisfied");
		});
		it("π'₃₈ rejects non-range", () => {
			expect(FAMILY_J[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₃₉ finds pattern in subterm", () => {
			expect(
				FAMILY_J[1]!.evaluate(product([field("x", refinement(base("s"), patternConstraint("^a")))]))
					.status,
			).toBe("satisfied");
		});
		it("π'₃₉ rejects non-pattern", () => {
			expect(FAMILY_J[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₄₀ finds multipleOf in subterm", () => {
			expect(
				FAMILY_J[2]!.evaluate(product([field("x", refinement(base("n"), multipleOfConstraint(3)))]))
					.status,
			).toBe("satisfied");
		});
		it("π'₄₀ rejects non-multipleOf", () => {
			expect(FAMILY_J[2]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₄₁ finds compound in subterm", () => {
			expect(
				FAMILY_J[3]!.evaluate(
					product([
						field(
							"x",
							refinement(
								base("n"),
								andPredicate(rangeConstraint(0), rangeConstraint(undefined, 10)),
							),
						),
					]),
				).status,
			).toBe("satisfied");
		});
		it("π'₄₁ rejects non-compound", () => {
			expect(FAMILY_J[3]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₆₈ finds concat in subterm", () => {
			expect(
				FAMILY_J[4]!.evaluate(product([field("x", templateLiteral([base("s")]))])).status,
			).toBe("satisfied");
		});
		it("π'₆₈ rejects non-concat", () => {
			expect(FAMILY_J[4]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₆₉ finds decomposition in subterm", () => {
			expect(
				FAMILY_J[5]!.evaluate(
					product([field("x", templateLiteral([base("s")], { stringDecomposition: true }))]),
				).status,
			).toBe("satisfied");
		});
		it("π'₆₉ rejects non-decomposition", () => {
			expect(FAMILY_J[5]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family K (4)
	describe("Family K", () => {
		it("π'₄₂ rejects non-dependent", () => {
			expect(FAMILY_K[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₄₃ rejects no cross-field", () => {
			expect(FAMILY_K[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₄₄ finds foreign-key in subterm", () => {
			expect(
				FAMILY_K[2]!.evaluate(product([field("x", extension("foreign-key", {}))])).status,
			).toBe("satisfied");
		});
		it("π'₄₄ rejects non-foreign-key", () => {
			expect(FAMILY_K[2]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₆₇ finds path-constraint in subterm", () => {
			expect(
				FAMILY_K[3]!.evaluate(product([field("x", extension("path-constraint", {}))])).status,
			).toBe("satisfied");
		});
		it("π'₆₇ rejects non-path", () => {
			expect(FAMILY_K[3]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family L (3)
	describe("Family L", () => {
		it("π'₄₅ finds array in subterm", () => {
			expect(FAMILY_L[0]!.evaluate(product([field("x", array(base("n")))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₄₅ rejects non-array", () => {
			expect(FAMILY_L[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₄₆ finds set in subterm", () => {
			expect(FAMILY_L[1]!.evaluate(product([field("x", set(base("n")))])).status).toBe("satisfied");
		});
		it("π'₄₆ rejects non-set", () => {
			expect(FAMILY_L[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₄₇ finds map in subterm", () => {
			expect(FAMILY_L[2]!.evaluate(product([field("x", map(base("s"), base("n")))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₄₇ rejects non-map", () => {
			expect(FAMILY_L[2]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family M (2)
	describe("Family M", () => {
		it("π'₄₈ finds arrow in subterm", () => {
			expect(
				FAMILY_M[0]!.evaluate(product([field("x", arrow([base("s")], base("n")))])).status,
			).toBe("satisfied");
		});
		it("π'₄₈ rejects non-arrow", () => {
			expect(FAMILY_M[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₄₉ finds overloaded in subterm", () => {
			const ov = intersection([arrow([base("s")], base("n")), arrow([base("n")], base("s"))]);
			expect(FAMILY_M[1]!.evaluate(product([field("x", ov)])).status).toBe("satisfied");
		});
		it("π'₄₉ rejects non-overloaded", () => {
			expect(FAMILY_M[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family N (3)
	describe("Family N", () => {
		it("π'₅₀ finds let in subterm", () => {
			expect(
				FAMILY_N[0]!.evaluate(product([field("x", letBinding("X", base("s"), typeVar("X")))]))
					.status,
			).toBe("satisfied");
		});
		it("π'₅₀ rejects non-let", () => {
			expect(FAMILY_N[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₅₁ finds module in subterm", () => {
			expect(FAMILY_N[1]!.evaluate(product([field("x", extension("module", {}))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₅₁ rejects non-module", () => {
			expect(FAMILY_N[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₅₂ finds visibility in subterm", () => {
			expect(FAMILY_N[2]!.evaluate(product([field("x", extension("visibility", {}))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₅₂ rejects non-visibility", () => {
			expect(FAMILY_N[2]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family O (3)
	describe("Family O", () => {
		it("π'₅₃ finds deprecated in subterm", () => {
			expect(
				FAMILY_O[0]!.evaluate(product([field("x", base("s", { deprecated: true }))])).status,
			).toBe("satisfied");
		});
		it("π'₅₃ rejects non-deprecated", () => {
			expect(FAMILY_O[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₅₄ finds version in subterm", () => {
			expect(FAMILY_O[1]!.evaluate(product([field("x", base("s", { version: "1" }))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₅₄ rejects non-versioned", () => {
			expect(FAMILY_O[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₅₅ finds compat in subterm", () => {
			expect(
				FAMILY_O[2]!.evaluate(product([field("x", base("s", { backwardCompatibleWith: "1" }))]))
					.status,
			).toBe("satisfied");
		});
		it("π'₅₅ rejects non-compat", () => {
			expect(FAMILY_O[2]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family P (3)
	describe("Family P", () => {
		it("π'₅₆ finds description in subterm", () => {
			expect(
				FAMILY_P[0]!.evaluate(product([field("x", base("s", { description: "d" }))])).status,
			).toBe("satisfied");
		});
		it("π'₅₆ rejects no description", () => {
			expect(FAMILY_P[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₅₇ finds examples in subterm", () => {
			expect(
				FAMILY_P[1]!.evaluate(product([field("x", base("s", { examples: [1] }))])).status,
			).toBe("satisfied");
		});
		it("π'₅₇ rejects no examples", () => {
			expect(FAMILY_P[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₅₈ finds custom in subterm", () => {
			expect(FAMILY_P[2]!.evaluate(product([field("x", base("s", { "x-foo": 1 }))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₅₈ rejects no annotations", () => {
			expect(FAMILY_P[2]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family Q (1)
	describe("Family Q", () => {
		it("π'₅₉ finds complement in subterm", () => {
			expect(FAMILY_Q[0]!.evaluate(product([field("x", complement(base("s")))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₅₉ rejects non-complement", () => {
			expect(FAMILY_Q[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family R (1)
	describe("Family R", () => {
		it("π'₆₀ finds bivariant in subterm", () => {
			expect(FAMILY_R[0]!.evaluate(product([field("x", extension("bivariant", {}))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₆₀ rejects non-bivariant", () => {
			expect(FAMILY_R[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family S (2)
	describe("Family S", () => {
		it("π'₆₁ finds phantom in subterm", () => {
			expect(FAMILY_S[0]!.evaluate(product([field("x", forall("T", base("s")))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₆₁ rejects non-phantom (var used)", () => {
			expect(FAMILY_S[0]!.evaluate(forall("T", typeVar("T"))).status).toBe("not-satisfied");
		});
		it("π'₆₂ finds gadt in subterm", () => {
			expect(
				FAMILY_S[1]!.evaluate(
					product([field("x", forall("T", typeVar("T"), { annotations: { gadt: true } }))]),
				).status,
			).toBe("satisfied");
		});
		it("π'₆₂ rejects non-gadt", () => {
			expect(FAMILY_S[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family T (3)
	describe("Family T", () => {
		it("π'₆₃ finds keyof in subterm", () => {
			expect(FAMILY_T[0]!.evaluate(product([field("x", keyOf(base("s")))])).status).toBe(
				"satisfied",
			);
		});
		it("π'₆₃ rejects non-keyof", () => {
			expect(FAMILY_T[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₆₄ finds mapped in subterm", () => {
			expect(
				FAMILY_T[1]!.evaluate(product([field("x", mapped(base("s"), base("n")))])).status,
			).toBe("satisfied");
		});
		it("π'₆₄ rejects non-mapped", () => {
			expect(FAMILY_T[1]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
		it("π'₆₅ finds conditional in subterm", () => {
			expect(
				FAMILY_T[2]!.evaluate(
					product([
						field("x", conditional(typeVar("T"), base("s"), literal(true), literal(false))),
					]),
				).status,
			).toBe("satisfied");
		});
		it("π'₆₅ rejects non-conditional", () => {
			expect(FAMILY_T[2]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family U (1)
	describe("Family U", () => {
		it("π'₆₆ finds rowpoly in subterm", () => {
			expect(
				FAMILY_U[0]!.evaluate(product([field("x", rowPoly([field("y", base("n"))], "r"))])).status,
			).toBe("satisfied");
		});
		it("π'₆₆ rejects non-rowpoly", () => {
			expect(FAMILY_U[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});

	// Family V (1)
	describe("Family V", () => {
		it("π'₇₀ finds state-machine in subterm", () => {
			expect(
				FAMILY_V[0]!.evaluate(product([field("x", extension("state-machine", {}))])).status,
			).toBe("satisfied");
		});
		it("π'₇₀ rejects non-state-machine", () => {
			expect(FAMILY_V[0]!.evaluate(base("string")).status).toBe("not-satisfied");
		});
	});
});
