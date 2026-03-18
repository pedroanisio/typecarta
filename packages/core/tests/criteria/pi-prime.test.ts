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
	PI_PRIME_CRITERIA,
	PI_PRIME_IDS,
	andPredicate,
	array,
	arrow,
	base,
	// constructors for test schemas
	bottom,
	complement,
	conditional,
	extension,
	field,
	forall,
	getPiPrimeCriterion,
	getPiPrimeRegistry,
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
	piPrimeRegistrySize,
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

describe("Π' expanded criterion set", () => {
	it("has exactly 70 criteria registered", () => {
		expect(PI_PRIME_CRITERIA.length).toBe(70);
		expect(piPrimeRegistrySize()).toBe(70);
	});

	it("has 70 unique IDs", () => {
		const ids = PI_PRIME_CRITERIA.map((c) => c.id);
		expect(new Set(ids).size).toBe(70);
	});

	it("all IDs are valid PI_PRIME_IDS", () => {
		for (const c of PI_PRIME_CRITERIA) {
			expect(PI_PRIME_IDS).toContain(c.id);
		}
	});

	it("registry lookup works", () => {
		const c = getPiPrimeCriterion("pi-prime-01");
		expect(c).toBeDefined();
		expect(c!.name).toBe("Syntactic Bottom");
		expect(c!.family).toBe("A");
	});

	it("getPiPrimeRegistry returns all 70", () => {
		const reg = getPiPrimeRegistry();
		expect(reg.size).toBe(70);
	});
});

describe("Family A — Cardinality & Base-Set", () => {
	it("has 7 criteria", () => expect(FAMILY_A.length).toBe(7));

	it("π'₁ detects syntactic bottom", () => {
		expect(FAMILY_A[0]!.evaluate(bottom()).status).toBe("satisfied");
	});
	it("π'₂ detects semantic emptiness via refinement", () => {
		expect(FAMILY_A[1]!.evaluate(refinement(base("number"), rangeConstraint(-1, -2))).status).toBe(
			"satisfied",
		);
	});
	it("π'₃ detects global top", () => {
		expect(FAMILY_A[2]!.evaluate(top()).status).toBe("satisfied");
	});
	it("π'₄ detects sort-restricted top", () => {
		expect(FAMILY_A[3]!.evaluate(base("string")).status).toBe("satisfied");
	});
	it("π'₅ detects singleton literal", () => {
		expect(FAMILY_A[4]!.evaluate(literal(42)).status).toBe("satisfied");
	});
	it("π'₆ detects homogeneous enum", () => {
		expect(FAMILY_A[5]!.evaluate(union([literal("a"), literal("b"), literal("c")])).status).toBe(
			"satisfied",
		);
	});
	it("π'₇ detects heterogeneous enum", () => {
		expect(FAMILY_A[6]!.evaluate(union([literal(1), literal("one"), literal(true)])).status).toBe(
			"satisfied",
		);
	});
});

describe("Family B — Products, Records, Tuples", () => {
	it("has 3 criteria", () => expect(FAMILY_B.length).toBe(3));

	it("π'₈ detects tuple", () => {
		expect(FAMILY_B[0]!.evaluate(tuple([base("string"), base("number")])).status).toBe("satisfied");
	});
	it("π'₉ detects labelled record", () => {
		expect(FAMILY_B[1]!.evaluate(product([field("x", base("number"))])).status).toBe("satisfied");
	});
	it("π'₁₀ detects variadic tuple", () => {
		expect(FAMILY_B[2]!.evaluate(tuple([base("string"), array(base("number"))])).status).toBe(
			"satisfied",
		);
	});
});

describe("Family C — Field Modality", () => {
	it("has 5 criteria", () => expect(FAMILY_C.length).toBe(5));

	it("π'₁₁ detects required field", () => {
		expect(FAMILY_C[0]!.evaluate(product([field("x", base("string"))])).status).toBe("satisfied");
	});
	it("π'₁₂ detects optional-by-absence", () => {
		expect(
			FAMILY_C[1]!.evaluate(product([field("x", base("string"), { optional: true })])).status,
		).toBe("satisfied");
	});
	it("π'₁₃ detects nullable-by-value", () => {
		expect(
			FAMILY_C[2]!.evaluate(product([field("x", union([base("string"), base("null")]))])).status,
		).toBe("satisfied");
	});
	it("π'₁₄ detects default value", () => {
		expect(
			FAMILY_C[3]!.evaluate(product([field("x", base("string"), { defaultValue: "hello" })]))
				.status,
		).toBe("satisfied");
	});
	it("π'₁₅ detects read-only marker", () => {
		expect(
			FAMILY_C[4]!.evaluate(product([field("x", base("string"), { readonly: true })])).status,
		).toBe("satisfied");
	});
});

describe("Family D — Shape Closure", () => {
	it("has 3 criteria", () => expect(FAMILY_D.length).toBe(3));

	it("π'₁₆ detects closed record", () => {
		expect(FAMILY_D[0]!.evaluate(product([field("x", base("number"))])).status).toBe("satisfied");
	});
	it("π'₁₇ detects open record", () => {
		expect(
			FAMILY_D[1]!.evaluate(product([field("x", base("number"))], { open: true })).status,
		).toBe("satisfied");
	});
	it("π'₁₈ detects typed extras", () => {
		expect(
			FAMILY_D[2]!.evaluate(
				product([field("x", base("number"))], { additionalProperties: base("string") }),
			).status,
		).toBe("satisfied");
	});
});

describe("Family E — Sum & Union", () => {
	it("has 4 criteria", () => expect(FAMILY_E.length).toBe(4));

	it("π'₁₉ detects untagged union", () => {
		expect(FAMILY_E[0]!.evaluate(union([base("string"), base("number")])).status).toBe("satisfied");
	});
	it("π'₂₀ detects discriminated union", () => {
		const du = union([
			product([field("tag", literal("a")), field("v", base("string"))]),
			product([field("tag", literal("b")), field("v", base("number"))]),
		]);
		expect(FAMILY_E[1]!.evaluate(du).status).toBe("satisfied");
	});
	it("π'₂₁ detects shape-discriminated union", () => {
		const sdu = union([
			product([field("x", base("number"))]),
			product([field("y", base("string"))]),
		]);
		expect(FAMILY_E[2]!.evaluate(sdu).status).toBe("satisfied");
	});
	it("π'₂₂ detects exhaustive union", () => {
		expect(FAMILY_E[3]!.evaluate(union([base("a"), base("b")], { exhaustive: true })).status).toBe(
			"satisfied",
		);
	});
});

describe("Family F — Intersection", () => {
	it("has 2 criteria", () => expect(FAMILY_F.length).toBe(2));

	it("π'₂₃ detects record-merge intersection", () => {
		const rm = intersection([
			product([field("x", base("number"))]),
			product([field("y", base("string"))]),
		]);
		expect(FAMILY_F[0]!.evaluate(rm).status).toBe("satisfied");
	});
	it("π'₂₄ detects refinement intersection", () => {
		const ri = intersection([base("number"), refinement(base("number"), rangeConstraint(0, 10))]);
		expect(FAMILY_F[1]!.evaluate(ri).status).toBe("satisfied");
	});
});

describe("Family G — Recursion", () => {
	it("has 3 criteria", () => expect(FAMILY_G.length).toBe(3));

	it("π'₂₅ detects self-recursion", () => {
		expect(FAMILY_G[0]!.evaluate(mu("a", typeVar("a"))).status).toBe("satisfied");
	});
	it("π'₂₆ detects mutual recursion", () => {
		expect(FAMILY_G[1]!.evaluate(mu("a", mu("b", typeVar("a")))).status).toBe("satisfied");
	});
	it("π'₂₇ detects recursive generic", () => {
		expect(FAMILY_G[2]!.evaluate(forall("T", mu("a", typeVar("a")))).status).toBe("satisfied");
	});
});

describe("Family H — Parametricity & HKT", () => {
	it("has 6 criteria", () => expect(FAMILY_H.length).toBe(6));

	it("π'₂₈ detects rank-1 generics", () => {
		expect(FAMILY_H[0]!.evaluate(forall("T", typeVar("T"))).status).toBe("satisfied");
	});
	it("π'₂₉ detects bounded generics", () => {
		expect(FAMILY_H[1]!.evaluate(forall("T", typeVar("T"), { bound: base("string") })).status).toBe(
			"satisfied",
		);
	});
	it("π'₃₀ detects generic default", () => {
		expect(
			FAMILY_H[2]!.evaluate(forall("T", typeVar("T"), { default: base("string") })).status,
		).toBe("satisfied");
	});
	it("π'₃₁ detects higher-rank", () => {
		// forall nested inside an apply
		const hr = product([field("run", forall("T", typeVar("T")))]);
		expect(FAMILY_H[3]!.evaluate(hr).status).toBe("satisfied");
	});
	it("π'₃₂ detects HKT", () => {
		expect(
			FAMILY_H[4]!.evaluate(forall("F", typeVar("F"), { annotations: { hkt: true } })).status,
		).toBe("satisfied");
	});
	it("π'₃₃ detects variance annotation", () => {
		expect(FAMILY_H[5]!.evaluate(forall("T", typeVar("T"), { variance: "covariant" })).status).toBe(
			"satisfied",
		);
	});
});

describe("Family I — Nominal & Branding", () => {
	it("has 4 criteria", () => expect(FAMILY_I.length).toBe(4));

	it("π'₃₄ detects structural-only (no nominal)", () => {
		expect(FAMILY_I[0]!.evaluate(base("string")).status).toBe("satisfied");
	});
	it("π'₃₅ detects nominal tag", () => {
		expect(FAMILY_I[1]!.evaluate(nominal("UserId", base("string"))).status).toBe("satisfied");
	});
	it("π'₃₆ detects opaque/sealed wrapper", () => {
		expect(FAMILY_I[2]!.evaluate(nominal("UserId", base("string"), true)).status).toBe("satisfied");
	});
	it("π'₃₇ detects coercion edge", () => {
		expect(FAMILY_I[3]!.evaluate(extension("coercion", {})).status).toBe("satisfied");
	});
});

describe("Family J — Refinement & Predicates", () => {
	it("has 6 criteria", () => expect(FAMILY_J.length).toBe(6));

	it("π'₃₈ detects range constraint", () => {
		expect(FAMILY_J[0]!.evaluate(refinement(base("number"), rangeConstraint(0, 100))).status).toBe(
			"satisfied",
		);
	});
	it("π'₃₉ detects pattern constraint", () => {
		expect(FAMILY_J[1]!.evaluate(refinement(base("string"), patternConstraint("^a"))).status).toBe(
			"satisfied",
		);
	});
	it("π'₄₀ detects multipleOf constraint", () => {
		expect(FAMILY_J[2]!.evaluate(refinement(base("number"), multipleOfConstraint(5))).status).toBe(
			"satisfied",
		);
	});
	it("π'₄₁ detects compound predicate", () => {
		expect(
			FAMILY_J[3]!.evaluate(
				refinement(
					base("number"),
					andPredicate(rangeConstraint(0), rangeConstraint(undefined, 100)),
				),
			).status,
		).toBe("satisfied");
	});
	it("π'₆₈ detects string concatenation", () => {
		expect(
			FAMILY_J[4]!.evaluate(templateLiteral([base("string"), literal("@"), base("string")])).status,
		).toBe("satisfied");
	});
	it("π'₆₉ detects string decomposition", () => {
		expect(
			FAMILY_J[5]!.evaluate(templateLiteral([base("string")], { stringDecomposition: true }))
				.status,
		).toBe("satisfied");
	});
});

describe("Family K — Value Dependency", () => {
	it("has 4 criteria", () => expect(FAMILY_K.length).toBe(4));

	it("π'₄₂ detects tagged dependent choice", () => {
		const du = union([
			product([field("kind", literal("int")), field("value", base("number"))]),
			product([field("kind", literal("float")), field("value", base("number"))]),
		]);
		expect(FAMILY_K[0]!.evaluate(du).status).toBe("satisfied");
	});
	it("π'₄₃ detects cross-field constraint", () => {
		expect(
			FAMILY_K[1]!.evaluate(
				product([field("start", base("number")), field("end", base("number"))], {
					crossField: true,
				}),
			).status,
		).toBe("satisfied");
	});
	it("π'₄₄ detects foreign-key constraint", () => {
		expect(FAMILY_K[2]!.evaluate(extension("foreign-key", {})).status).toBe("satisfied");
	});
	it("π'₆₇ detects path-navigating constraint", () => {
		expect(FAMILY_K[3]!.evaluate(extension("path-constraint", {})).status).toBe("satisfied");
	});
});

describe("Family L — Collection Types", () => {
	it("has 3 criteria", () => expect(FAMILY_L.length).toBe(3));

	it("π'₄₅ detects array", () => {
		expect(FAMILY_L[0]!.evaluate(array(base("number"))).status).toBe("satisfied");
	});
	it("π'₄₆ detects set", () => {
		expect(FAMILY_L[1]!.evaluate(set(base("number"))).status).toBe("satisfied");
	});
	it("π'₄₇ detects map", () => {
		expect(FAMILY_L[2]!.evaluate(map(base("string"), base("number"))).status).toBe("satisfied");
	});
});

describe("Family M — Computation Types", () => {
	it("has 2 criteria", () => expect(FAMILY_M.length).toBe(2));

	it("π'₄₈ detects arrow type", () => {
		expect(FAMILY_M[0]!.evaluate(arrow([base("string")], base("number"))).status).toBe("satisfied");
	});
	it("π'₄₉ detects overloaded function", () => {
		const overloaded = intersection([
			arrow([base("string")], base("number")),
			arrow([base("number")], base("string")),
		]);
		expect(FAMILY_M[1]!.evaluate(overloaded).status).toBe("satisfied");
	});
});

describe("Family N — Modularity", () => {
	it("has 3 criteria", () => expect(FAMILY_N.length).toBe(3));

	it("π'₅₀ detects named alias", () => {
		expect(FAMILY_N[0]!.evaluate(letBinding("X", base("string"), typeVar("X"))).status).toBe(
			"satisfied",
		);
	});
	it("π'₅₁ detects module", () => {
		expect(FAMILY_N[1]!.evaluate(extension("module", {})).status).toBe("satisfied");
	});
	it("π'₅₂ detects visibility control", () => {
		expect(FAMILY_N[2]!.evaluate(extension("visibility", {})).status).toBe("satisfied");
	});
});

describe("Family O — Evolution", () => {
	it("has 3 criteria", () => expect(FAMILY_O.length).toBe(3));

	it("π'₅₃ detects deprecation", () => {
		expect(FAMILY_O[0]!.evaluate(base("string", { deprecated: true })).status).toBe("satisfied");
	});
	it("π'₅₄ detects version", () => {
		expect(FAMILY_O[1]!.evaluate(base("string", { version: "2.0" })).status).toBe("satisfied");
	});
	it("π'₅₅ detects backward compatibility", () => {
		expect(FAMILY_O[2]!.evaluate(base("string", { backwardCompatibleWith: "1.0" })).status).toBe(
			"satisfied",
		);
	});
});

describe("Family P — Meta-Annotation", () => {
	it("has 3 criteria", () => expect(FAMILY_P.length).toBe(3));

	it("π'₅₆ detects description", () => {
		expect(FAMILY_P[0]!.evaluate(base("string", { description: "A name" })).status).toBe(
			"satisfied",
		);
	});
	it("π'₅₇ detects examples", () => {
		expect(FAMILY_P[1]!.evaluate(base("string", { examples: ["foo"] })).status).toBe("satisfied");
	});
	it("π'₅₈ detects custom metadata", () => {
		expect(FAMILY_P[2]!.evaluate(base("string", { "x-custom": true })).status).toBe("satisfied");
	});
});

describe("Family Q — Type-Level Negation", () => {
	it("has 1 criterion", () => expect(FAMILY_Q.length).toBe(1));

	it("π'₅₉ detects complement", () => {
		expect(FAMILY_Q[0]!.evaluate(complement(base("string"))).status).toBe("satisfied");
	});
});

describe("Family R — Unsound / Bivariant", () => {
	it("has 1 criterion", () => expect(FAMILY_R.length).toBe(1));

	it("π'₆₀ detects bivariant type", () => {
		expect(FAMILY_R[0]!.evaluate(extension("bivariant", {})).status).toBe("satisfied");
	});
});

describe("Family S — Phantom & Indexed", () => {
	it("has 2 criteria", () => expect(FAMILY_S.length).toBe(2));

	it("π'₆₁ detects phantom type parameter", () => {
		// forall T where T does not appear free in body
		expect(FAMILY_S[0]!.evaluate(forall("T", base("string"))).status).toBe("satisfied");
	});
	it("π'₆₂ detects GADT", () => {
		expect(
			FAMILY_S[1]!.evaluate(forall("T", typeVar("T"), { annotations: { gadt: true } })).status,
		).toBe("satisfied");
	});
});

describe("Family T — Type-Level Computation", () => {
	it("has 3 criteria", () => expect(FAMILY_T.length).toBe(3));

	it("π'₆₃ detects keyof", () => {
		expect(FAMILY_T[0]!.evaluate(keyOf(product([field("x", base("number"))]))).status).toBe(
			"satisfied",
		);
	});
	it("π'₆₄ detects mapped type", () => {
		expect(FAMILY_T[1]!.evaluate(mapped(base("string"), base("number"))).status).toBe("satisfied");
	});
	it("π'₆₅ detects conditional type", () => {
		expect(
			FAMILY_T[2]!.evaluate(
				conditional(typeVar("T"), base("string"), literal(true), literal(false)),
			).status,
		).toBe("satisfied");
	});
});

describe("Family U — Row Polymorphism", () => {
	it("has 1 criterion", () => expect(FAMILY_U.length).toBe(1));

	it("π'₆₆ detects row-polymorphic record", () => {
		expect(FAMILY_U[0]!.evaluate(rowPoly([field("x", base("number"))], "rho")).status).toBe(
			"satisfied",
		);
	});
});

describe("Family V — Temporal / Stateful", () => {
	it("has 1 criterion", () => expect(FAMILY_V.length).toBe(1));

	it("π'₇₀ detects state-machine type", () => {
		expect(FAMILY_V[0]!.evaluate(extension("state-machine", {})).status).toBe("satisfied");
	});
});
