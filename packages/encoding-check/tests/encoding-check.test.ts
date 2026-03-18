import {
	type TypeTerm,
	type Value,
	array,
	base,
	createEncoding,
	createEvaluator,
	createExtension,
	field,
	product,
} from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { generateReport, runEncodingChecks } from "../src/index.js";
import { compareExact } from "../src/strategies/exact.js";
import { compareSampled } from "../src/strategies/sampling.js";

function membershipPredicate(term: TypeTerm): (v: Value) => boolean {
	if (term.kind === "top") return () => true;
	if (term.kind === "bottom") return () => false;
	if (term.kind === "base") {
		if (term.name === "string") return (v) => typeof v === "string";
		if (term.name === "number") return (v) => typeof v === "number";
	}
	return () => false;
}

describe("encoding-check runner", () => {
	const identity = createEncoding("test-source", "test-target", (term) => term);
	const evaluator = createEvaluator((term) => createExtension(membershipPredicate(term)));
	const testValues: Value[] = [null, true, 0, 1, "hello", "", [], {}];

	it("runs width check", () => {
		const narrow = product([field("name", base("string"))]);
		const wide = product([field("name", base("string")), field("age", base("number"))]);

		const results = runEncodingChecks({
			encoding: identity,
			evaluator,
			testValues,
			widthPairs: [[wide, narrow]],
		});
		expect(results).toHaveLength(1);
		expect(results[0]!.property).toBe("rho-width");
	});

	it("runs depth check", () => {
		const shallow = array(base("string"));
		const deep = array(array(base("string")));

		const results = runEncodingChecks({
			encoding: identity,
			evaluator,
			testValues,
			depthPairs: [[deep, shallow]],
		});
		expect(results).toHaveLength(1);
		expect(results[0]!.property).toBe("rho-depth");
	});

	it("runs generic check", () => {
		const results = runEncodingChecks({
			encoding: identity,
			evaluator,
			testValues,
			genericPairs: [[array(base("string")), array(base("number"))]],
		});
		expect(results).toHaveLength(1);
		expect(results[0]!.property).toBe("rho-generic");
	});
});

describe("generateReport", () => {
	it("produces Markdown with pass/fail counts", () => {
		const report = generateReport([
			{ property: "rho-width", holds: true, witness: [base("string"), base("string")] },
			{
				property: "rho-depth",
				holds: false,
				witness: [base("string"), base("number")],
				reason: "mismatch",
			},
		]);
		expect(report).toContain("# Encoding-Check Report");
		expect(report).toContain("✓");
		expect(report).toContain("✗");
		expect(report).toContain("1/2 checks passed");
	});
});

describe("strategies/exact", () => {
	it("detects equal extensions", () => {
		const ext = createExtension((v) => typeof v === "string");
		const result = compareExact(ext, ext, ["hello", 42, true]);
		expect(result.equal).toBe(true);
		expect(result.mismatches).toHaveLength(0);
	});

	it("detects subset relationship", () => {
		const narrow = createExtension((v) => v === "hello");
		const wide = createExtension((v) => typeof v === "string");
		const result = compareExact(narrow, wide, ["hello", "world", 42]);
		expect(result.subset).toBe(true);
		expect(result.superset).toBe(false);
	});

	it("reports mismatches", () => {
		const left = createExtension((v) => typeof v === "string");
		const right = createExtension((v) => typeof v === "number");
		const result = compareExact(left, right, ["hello", 42]);
		expect(result.equal).toBe(false);
		expect(result.mismatches.length).toBeGreaterThan(0);
	});
});

describe("strategies/sampling", () => {
	it("detects approximate equality for identical extensions", () => {
		const ext = createExtension((v) => typeof v === "string");
		const result = compareSampled(ext, ext, { samplesPerType: 10, seed: 42 });
		expect(result.approximateEqual).toBe(true);
		expect(result.confidence).toBe(1);
	});

	it("detects violations for different extensions", () => {
		const left = createExtension((v) => typeof v === "string");
		const right = createExtension((v) => typeof v === "number");
		const result = compareSampled(left, right, { samplesPerType: 10, seed: 42 });
		expect(result.approximateEqual).toBe(false);
		expect(result.violationCount).toBeGreaterThan(0);
	});

	it("uses seed for reproducibility", () => {
		const ext = createExtension((v) => typeof v === "string");
		const other = createExtension((v) => typeof v === "number");
		const r1 = compareSampled(ext, other, { samplesPerType: 10, seed: 123 });
		const r2 = compareSampled(ext, other, { samplesPerType: 10, seed: 123 });
		expect(r1.sampleCount).toBe(r2.sampleCount);
		expect(r1.violationCount).toBe(r2.violationCount);
	});
});
