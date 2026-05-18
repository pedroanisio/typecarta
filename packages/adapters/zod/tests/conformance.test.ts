import {
	andPredicate,
	array,
	base,
	bottom,
	field,
	forall,
	literal,
	multipleOfConstraint,
	patternConstraint,
	product,
	rangeConstraint,
	refinement,
	tuple,
	union,
} from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { ZodAdapter } from "../src/adapter.js";
import type { ZodDescriptor } from "../src/adapter.js";

const adapter = new ZodAdapter();

describe("ZodAdapter", () => {
	describe("parse → encode roundtrip", () => {
		it("roundtrips z.string()", () => {
			const desc: ZodDescriptor = { type: "string" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips z.number()", () => {
			const desc: ZodDescriptor = { type: "number" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips z.boolean()", () => {
			const desc: ZodDescriptor = { type: "boolean" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips z.null()", () => {
			const desc: ZodDescriptor = { type: "null" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips z.date()", () => {
			const desc: ZodDescriptor = { type: "date" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips z.object({})", () => {
			const desc: ZodDescriptor = {
				type: "object",
				shape: {
					name: { type: "string" },
					age: { type: "number" },
				},
			};
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips z.array(z.string())", () => {
			const desc: ZodDescriptor = { type: "array", element: { type: "string" } };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips z.literal('hello')", () => {
			const desc: ZodDescriptor = { type: "literal", value: "hello" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips z.never()", () => {
			const desc: ZodDescriptor = { type: "never" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});

		it("roundtrips z.unknown()", () => {
			const desc: ZodDescriptor = { type: "unknown" };
			const term = adapter.parse(desc);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(desc);
		});
	});

	describe("inhabits: true for matching values", () => {
		it("string value inhabits z.string()", () => {
			const term = adapter.parse({ type: "string" });
			expect(adapter.inhabits("hello", term)).toBe(true);
		});

		it("number value inhabits z.number()", () => {
			const term = adapter.parse({ type: "number" });
			expect(adapter.inhabits(42, term)).toBe(true);
		});

		it("boolean value inhabits z.boolean()", () => {
			const term = adapter.parse({ type: "boolean" });
			expect(adapter.inhabits(true, term)).toBe(true);
		});

		it("null value inhabits z.null()", () => {
			const term = adapter.parse({ type: "null" });
			expect(adapter.inhabits(null, term)).toBe(true);
		});

		it("object value inhabits z.object()", () => {
			const term = adapter.parse({
				type: "object",
				shape: { name: { type: "string" }, age: { type: "number" } },
			});
			expect(adapter.inhabits({ name: "Alice", age: 30 }, term)).toBe(true);
		});

		it("array value inhabits z.array()", () => {
			const term = adapter.parse({ type: "array", element: { type: "number" } });
			expect(adapter.inhabits([1, 2, 3], term)).toBe(true);
		});

		it("tuple value inhabits z.tuple()", () => {
			const term = adapter.parse({
				type: "tuple",
				elements: [{ type: "string" }, { type: "number" }],
			});
			expect(adapter.inhabits(["hello", 42], term)).toBe(true);
		});

		it("union value inhabits z.union()", () => {
			const term = adapter.parse({
				type: "union",
				options: [{ type: "string" }, { type: "number" }],
			});
			expect(adapter.inhabits("hello", term)).toBe(true);
			expect(adapter.inhabits(42, term)).toBe(true);
		});

		it("any value inhabits z.unknown()", () => {
			const term = adapter.parse({ type: "unknown" });
			expect(adapter.inhabits("anything", term)).toBe(true);
			expect(adapter.inhabits(null, term)).toBe(true);
		});
	});

	describe("inhabits: false for non-matching values", () => {
		it("number does not inhabit z.string()", () => {
			const term = adapter.parse({ type: "string" });
			expect(adapter.inhabits(42, term)).toBe(false);
		});

		it("string does not inhabit z.number()", () => {
			const term = adapter.parse({ type: "number" });
			expect(adapter.inhabits("hello", term)).toBe(false);
		});

		it("nothing inhabits z.never()", () => {
			const term = adapter.parse({ type: "never" });
			expect(adapter.inhabits("anything", term)).toBe(false);
			expect(adapter.inhabits(null, term)).toBe(false);
		});

		it("wrong shape does not inhabit z.object()", () => {
			const term = adapter.parse({
				type: "object",
				shape: { name: { type: "string" } },
			});
			expect(adapter.inhabits({ name: 42 }, term)).toBe(false);
		});

		it("wrong element type does not inhabit z.array()", () => {
			const term = adapter.parse({ type: "array", element: { type: "number" } });
			expect(adapter.inhabits(["not", "numbers"], term)).toBe(false);
		});

		it("wrong length does not inhabit z.tuple()", () => {
			const term = adapter.parse({
				type: "tuple",
				elements: [{ type: "string" }, { type: "number" }],
			});
			expect(adapter.inhabits(["only one"], term)).toBe(false);
		});
	});

	describe("isEncodable", () => {
		it("returns true for supported terms", () => {
			expect(adapter.isEncodable(base("string"))).toBe(true);
			expect(adapter.isEncodable(base("number"))).toBe(true);
			expect(adapter.isEncodable(base("boolean"))).toBe(true);
			expect(adapter.isEncodable(array(base("string")))).toBe(true);
			expect(adapter.isEncodable(product([field("x", base("number"))]))).toBe(true);
			expect(adapter.isEncodable(union([base("string"), base("number")]))).toBe(true);
			expect(adapter.isEncodable(bottom())).toBe(true);
			expect(adapter.isEncodable(literal("hello"))).toBe(true);
		});

		it("returns false for unsupported terms", () => {
			expect(adapter.isEncodable(forall("T", base("string")))).toBe(false);
			expect(adapter.isEncodable(base("symbol"))).toBe(false);
		});
	});

	// Regression for the Zod adapter's missing refinement support, flagged
	// by the bench:fidelity reviewer (2026-05-18). Zod 3 natively has
	// `.min(n)`, `.max(n)`, `.regex(re)`, `.multipleOf(d)`, and `.refine(fn)`;
	// the adapter previously rejected every IR `refinement` term.
	describe("regression: refinement support", () => {
		it("declares `refinement` in supportsKind", () => {
			expect(adapter.supportsKind("refinement")).toBe(true);
		});

		it("encodes refinement(number, range) as `{type: refined, …}`", () => {
			const term = refinement(base("number"), rangeConstraint(0, 100));
			expect(adapter.isEncodable(term)).toBe(true);
			const encoded = adapter.encode(term);
			expect(encoded.type).toBe("refined");
		});

		it("round-trips refinement(number, range) faithfully", () => {
			const term = refinement(base("number"), rangeConstraint(0, 100));
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("refinement");
			if (parsed.kind === "refinement") {
				expect(parsed.predicate.kind).toBe("range");
			}
		});

		it("round-trips refinement(string, pattern) faithfully", () => {
			const term = refinement(base("string"), patternConstraint("^[a-z]+$"));
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("refinement");
			if (parsed.kind === "refinement") {
				expect(parsed.predicate.kind).toBe("pattern");
			}
		});

		it("round-trips refinement(number, multipleOf) faithfully", () => {
			const term = refinement(base("number"), multipleOfConstraint(5));
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("refinement");
			if (parsed.kind === "refinement") {
				expect(parsed.predicate.kind).toBe("multipleOf");
			}
		});

		it("composes compound predicates (and(range, multipleOf)) via stacked checks", () => {
			const term = refinement(
				base("number"),
				andPredicate(rangeConstraint(0, 100), multipleOfConstraint(5)),
			);
			const parsed = adapter.parse(adapter.encode(term));
			expect(parsed.kind).toBe("refinement");
			if (parsed.kind === "refinement") {
				expect(parsed.predicate.kind).toBe("and");
			}
		});

		it("inhabits checks the base type AND the predicate", () => {
			const term = refinement(base("number"), rangeConstraint(0, 100));
			expect(adapter.inhabits(50, term)).toBe(true);
			expect(adapter.inhabits(150, term)).toBe(false); // out of range
			expect(adapter.inhabits("50", term)).toBe(false); // wrong base type
		});
	});
});
