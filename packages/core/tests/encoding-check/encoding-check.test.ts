import {
	base,
	bottom,
	checkDepthPreservation,
	checkGenericPreservation,
	checkModels,
	checkStructurePreservation,
	checkWidthPreservation,
	createEncoding,
	createEvaluator,
	createExtension,
	field,
	literal,
	product,
	runEncodingChecks,
	top,
	union,
} from "@typecarta/core";
import type {
	Encoding,
	EncodingCheckWitnessPair,
	ExtensionEvaluator,
	TypeTerm,
	Value,
} from "@typecarta/core";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Test helpers: build a simple evaluator and encoding that we can control
// ---------------------------------------------------------------------------

/** Returns an evaluator that maps base("number") to numbers, base("string")
 *  to strings, top to everything, bottom to nothing, and literal(x) to
 *  exactly x. */
function makeEvaluator(): ExtensionEvaluator {
	return createEvaluator((term: TypeTerm) => {
		switch (term.kind) {
			case "base":
				if (term.name === "number") {
					return createExtension((v) => typeof v === "number", [1, 2, 3]);
				}
				if (term.name === "string") {
					return createExtension((v) => typeof v === "string", ["a", "b"]);
				}
				return createExtension(() => false, []);
			case "literal":
				return createExtension((v) => v === term.value, [term.value]);
			case "top":
				return createExtension(() => true);
			case "bottom":
				return createExtension(() => false, []);
			case "apply":
				if (term.constructor === "union" && term.args.length === 2) {
					// Evaluate union as union of extensions
					const leftExt = makeEvaluator().evaluate(term.args[0]!);
					const rightExt = makeEvaluator().evaluate(term.args[1]!);
					return createExtension((v) => leftExt.contains(v) || rightExt.contains(v));
				}
				return createExtension(() => false, []);
			default:
				return createExtension(() => false, []);
		}
	});
}

/** Identity encoding: maps every term to itself. */
function identityEncoding(): Encoding {
	return createEncoding("source", "target", (t) => t);
}

/** An encoding that maps everything to top(). */
function widenEncoding(): Encoding {
	return createEncoding("source", "target", () => top());
}

/** An encoding that maps everything to bottom(). */
function narrowEncoding(): Encoding {
	return createEncoding("source", "target", () => bottom());
}

const TEST_VALUES: readonly Value[] = [1, 2, 3, "a", "b", true, false, null];

// ===========================================================================
//  checkWidthPreservation
// ===========================================================================

describe("checkWidthPreservation", () => {
	it("returns holds=true when width subtyping is preserved", () => {
		// literal(1) is a subtype of base("number") in extension semantics
		const wide = literal(1);
		const narrow = base("number");
		const evaluator = makeEvaluator();
		const enc = identityEncoding();

		const result = checkWidthPreservation(wide, narrow, enc, evaluator, TEST_VALUES);

		expect(result.property).toBe("rho-width");
		expect(result.holds).toBe(true);
		expect(result.witness).toEqual([wide, narrow]);
		expect(result.reason).toBe("Width subtyping preserved");
	});

	it("returns holds=false when width subtyping is not preserved", () => {
		// base("string") is NOT a subtype of literal(1)
		const wide = base("string");
		const narrow = literal(1);
		const evaluator = makeEvaluator();
		const enc = identityEncoding();

		const result = checkWidthPreservation(wide, narrow, enc, evaluator, TEST_VALUES);

		expect(result.property).toBe("rho-width");
		expect(result.holds).toBe(false);
		expect(result.reason).toBe("φ(S_wide) ≤ φ(S_narrow) does not hold");
	});

	it("returns holds=true when encoding collapses both to top", () => {
		const enc = widenEncoding();
		const evaluator = makeEvaluator();

		const result = checkWidthPreservation(
			base("string"),
			base("number"),
			enc,
			evaluator,
			TEST_VALUES,
		);

		expect(result.holds).toBe(true);
	});

	it("returns holds=true for bottom ≤ anything with identity encoding", () => {
		const evaluator = makeEvaluator();
		const enc = identityEncoding();

		const result = checkWidthPreservation(bottom(), top(), enc, evaluator, TEST_VALUES);

		expect(result.holds).toBe(true);
	});
});

// ===========================================================================
//  checkDepthPreservation
// ===========================================================================

describe("checkDepthPreservation", () => {
	it("returns holds=true when depth subtyping is preserved", () => {
		const deep = literal(42);
		const shallow = base("number");
		const evaluator = makeEvaluator();
		const enc = identityEncoding();

		const result = checkDepthPreservation(deep, shallow, enc, evaluator, TEST_VALUES);

		expect(result.property).toBe("rho-depth");
		expect(result.holds).toBe(true);
		expect(result.witness).toEqual([deep, shallow]);
		expect(result.reason).toBe("Depth subtyping preserved");
	});

	it("returns holds=false when depth subtyping is not preserved", () => {
		const deep = base("number");
		const shallow = literal(42);
		const evaluator = makeEvaluator();
		const enc = identityEncoding();

		const result = checkDepthPreservation(deep, shallow, enc, evaluator, TEST_VALUES);

		expect(result.property).toBe("rho-depth");
		expect(result.holds).toBe(false);
		expect(result.reason).toBe("φ(S_deep) ≤ φ(S_shallow) does not hold");
	});

	it("returns holds=true with narrow encoding (bottom ≤ bottom)", () => {
		const evaluator = makeEvaluator();
		const enc = narrowEncoding();

		const result = checkDepthPreservation(
			base("string"),
			base("number"),
			enc,
			evaluator,
			TEST_VALUES,
		);

		// bottom ≤ bottom always holds
		expect(result.holds).toBe(true);
	});
});

// ===========================================================================
//  checkGenericPreservation
// ===========================================================================

describe("checkGenericPreservation", () => {
	it("returns holds=true when generic subtyping is preserved", () => {
		const inst1 = literal(1);
		const inst2 = base("number");
		const evaluator = makeEvaluator();
		const enc = identityEncoding();

		const result = checkGenericPreservation(inst1, inst2, enc, evaluator, TEST_VALUES);

		expect(result.property).toBe("rho-generic");
		expect(result.holds).toBe(true);
		expect(result.witness).toEqual([inst1, inst2]);
		expect(result.reason).toBe("Generic subtyping preserved");
	});

	it("returns holds=false when generic subtyping is not preserved", () => {
		const inst1 = base("string");
		const inst2 = base("number");
		const evaluator = makeEvaluator();
		const enc = identityEncoding();

		const result = checkGenericPreservation(inst1, inst2, enc, evaluator, TEST_VALUES);

		expect(result.property).toBe("rho-generic");
		expect(result.holds).toBe(false);
		expect(result.reason).toBe("φ(F(τ₁)) ≤ φ(F(τ₂)) does not hold");
	});

	it("returns holds=true when encoding maps both to top", () => {
		const evaluator = makeEvaluator();
		const enc = widenEncoding();

		const result = checkGenericPreservation(
			base("string"),
			base("number"),
			enc,
			evaluator,
			TEST_VALUES,
		);

		expect(result.holds).toBe(true);
	});
});

// ===========================================================================
//  runEncodingChecks
// ===========================================================================

describe("runEncodingChecks", () => {
	const evaluator = makeEvaluator();
	const enc = identityEncoding();

	it("returns allPassed=true when all pairs pass", () => {
		const pairs: EncodingCheckWitnessPair[] = [
			{ property: "rho-width", subtype: literal(1), supertype: base("number") },
			{ property: "rho-depth", subtype: bottom(), supertype: top() },
			{ property: "rho-generic", subtype: literal(1), supertype: base("number") },
		];

		const suite = runEncodingChecks(pairs, enc, evaluator, TEST_VALUES);

		expect(suite.allPassed).toBe(true);
		expect(suite.results).toHaveLength(3);
		expect(suite.results[0]!.property).toBe("rho-width");
		expect(suite.results[1]!.property).toBe("rho-depth");
		expect(suite.results[2]!.property).toBe("rho-generic");
		for (const r of suite.results) {
			expect(r.holds).toBe(true);
		}
	});

	it("returns allPassed=false when at least one pair fails", () => {
		const pairs: EncodingCheckWitnessPair[] = [
			{ property: "rho-width", subtype: literal(1), supertype: base("number") },
			{ property: "rho-depth", subtype: base("string"), supertype: literal(1) },
		];

		const suite = runEncodingChecks(pairs, enc, evaluator, TEST_VALUES);

		expect(suite.allPassed).toBe(false);
		expect(suite.results).toHaveLength(2);
		expect(suite.results[0]!.holds).toBe(true);
		expect(suite.results[1]!.holds).toBe(false);
	});

	it("returns allPassed=true for empty pairs array", () => {
		const suite = runEncodingChecks([], enc, evaluator, TEST_VALUES);

		expect(suite.allPassed).toBe(true);
		expect(suite.results).toHaveLength(0);
	});

	it("handles all three property types in a mixed suite", () => {
		const pairs: EncodingCheckWitnessPair[] = [
			{ property: "rho-width", subtype: base("number"), supertype: literal(1) },
			{ property: "rho-depth", subtype: base("number"), supertype: literal(1) },
			{ property: "rho-generic", subtype: base("number"), supertype: literal(1) },
		];

		const suite = runEncodingChecks(pairs, enc, evaluator, TEST_VALUES);

		expect(suite.allPassed).toBe(false);
		// All three should fail because base("number") is NOT a subtype of literal(1)
		for (const r of suite.results) {
			expect(r.holds).toBe(false);
		}
	});

	it("works with the widen encoding where all become top", () => {
		const widenEnc = widenEncoding();
		const pairs: EncodingCheckWitnessPair[] = [
			{ property: "rho-width", subtype: base("string"), supertype: base("number") },
			{ property: "rho-depth", subtype: base("string"), supertype: base("number") },
			{ property: "rho-generic", subtype: base("string"), supertype: base("number") },
		];

		const suite = runEncodingChecks(pairs, widenEnc, evaluator, TEST_VALUES);

		expect(suite.allPassed).toBe(true);
	});
});

// ===========================================================================
//  checkModels
// ===========================================================================

describe("checkModels", () => {
	it("returns models=true when encoding is faithful (identity)", () => {
		const evaluator = makeEvaluator();
		const enc = identityEncoding();
		const testTerms: TypeTerm[] = [base("number"), literal(1)];

		const result = checkModels(enc, evaluator, evaluator, testTerms, TEST_VALUES);

		expect(result.models).toBe(true);
		expect(result.faithfulness.isFaithful).toBe(true);
		expect(result.encoding).toBe(enc);
	});

	it("returns models=false when encoding is not faithful", () => {
		const sourceEval = makeEvaluator();
		// Target evaluator interprets everything as empty (not faithful)
		const targetEval = createEvaluator(() => createExtension(() => false, []));
		const enc = identityEncoding();
		const testTerms: TypeTerm[] = [base("number")];

		const result = checkModels(enc, sourceEval, targetEval, testTerms, TEST_VALUES);

		// source says 1 is in base("number"), target says nothing is -> not sound/complete
		expect(result.models).toBe(false);
		expect(result.faithfulness.isFaithful).toBe(false);
	});

	it("returns models=true with empty test terms", () => {
		const evaluator = makeEvaluator();
		const enc = identityEncoding();

		const result = checkModels(enc, evaluator, evaluator, [], TEST_VALUES);

		// With no terms to check, faithfulness is vacuously true
		expect(result.models).toBe(true);
	});
});

// ===========================================================================
//  checkStructurePreservation
// ===========================================================================

describe("checkStructurePreservation", () => {
	const evaluator = makeEvaluator();

	it("returns isPreserving=true when structure is preserved", () => {
		const enc = identityEncoding();
		const pairs: [TypeTerm, TypeTerm][] = [
			[literal(1), base("number")],
			[bottom(), top()],
		];

		const result = checkStructurePreservation(enc, evaluator, evaluator, pairs, TEST_VALUES);

		expect(result.isPreserving).toBe(true);
		expect(result.violations).toHaveLength(0);
	});

	it("returns violations when structure is not preserved", () => {
		// Encoding that swaps: encodes literal(1) as base("string") and
		// base("number") as literal(1).
		// In source: literal(1) ≤ base("number") holds.
		// After encoding: base("string") ≤ literal(1) does not hold.
		const swapEnc = createEncoding("src", "tgt", (term: TypeTerm) => {
			if (term.kind === "literal" && term.value === 1) return base("string");
			if (term.kind === "base" && term.name === "number") return literal(1);
			return term;
		});

		const pairs: [TypeTerm, TypeTerm][] = [[literal(1), base("number")]];
		const result = checkStructurePreservation(swapEnc, evaluator, evaluator, pairs, TEST_VALUES);

		expect(result.isPreserving).toBe(false);
		expect(result.violations).toHaveLength(1);
		expect(result.violations[0]!.reason).toContain("φ(a) ≤ φ(b) fails in target");
	});

	it("skips pairs where a is not a subtype of b in source", () => {
		const enc = identityEncoding();
		// base("string") is NOT a subtype of base("number") in the source
		const pairs: [TypeTerm, TypeTerm][] = [[base("string"), base("number")]];

		const result = checkStructurePreservation(enc, evaluator, evaluator, pairs, TEST_VALUES);

		// Since the source subtype check fails, the pair is skipped entirely
		expect(result.isPreserving).toBe(true);
		expect(result.violations).toHaveLength(0);
	});

	it("returns isPreserving=true for empty pairs", () => {
		const enc = identityEncoding();

		const result = checkStructurePreservation(enc, evaluator, evaluator, [], TEST_VALUES);

		expect(result.isPreserving).toBe(true);
		expect(result.violations).toHaveLength(0);
	});

	it("detects multiple violations", () => {
		// Encoding that maps everything to bottom -- so subtype relations break
		// when a ≤ b holds in source but bottom ≤ bottom always holds. Actually
		// bottom ≤ bottom holds, so let's use a different approach.
		// Map literal(1) -> base("string"), base("number") -> literal("x")
		const badEnc = createEncoding("src", "tgt", (term: TypeTerm) => {
			if (term.kind === "literal" && term.value === 1) return base("string");
			if (term.kind === "base" && term.name === "number") return literal("x");
			if (term.kind === "bottom") return base("string");
			if (term.kind === "top") return literal(1);
			return term;
		});

		const pairs: [TypeTerm, TypeTerm][] = [
			[literal(1), base("number")], // source: holds. target: string ≤ literal("x")? no
			[bottom(), top()], // source: holds. target: string ≤ literal(1)? no
		];

		const result = checkStructurePreservation(badEnc, evaluator, evaluator, pairs, TEST_VALUES);

		expect(result.isPreserving).toBe(false);
		expect(result.violations.length).toBeGreaterThanOrEqual(2);
	});

	it("preserves structure with widen encoding (top ≤ top always)", () => {
		const enc = widenEncoding();
		const pairs: [TypeTerm, TypeTerm][] = [
			[literal(1), base("number")],
			[bottom(), top()],
		];

		const result = checkStructurePreservation(enc, evaluator, evaluator, pairs, TEST_VALUES);

		// top ≤ top always holds
		expect(result.isPreserving).toBe(true);
	});
});
