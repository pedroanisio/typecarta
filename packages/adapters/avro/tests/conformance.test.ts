import { array, base, bottom, field, forall, literal, map, product, union } from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { AvroAdapter } from "../src/adapter.js";
import type { AvroSchema } from "../src/adapter.js";

const adapter = new AvroAdapter();

// Structural comparison ignoring synthetic record names that the encoder
// fabricates when none is supplied by the IR (Avro requires every record to
// be named, so encode picks "Record"; parse drops the name into the term).
function stripRecordNames(term: unknown): unknown {
	if (Array.isArray(term)) return term.map(stripRecordNames);
	if (term && typeof term === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(term)) {
			if (k === "name" && (term as { type?: string }).type === "record") continue;
			out[k] = stripRecordNames(v);
		}
		return out;
	}
	return term;
}

describe("AvroAdapter", () => {
	describe("parse → encode roundtrip", () => {
		it("roundtrips null primitive", () => {
			const schema: AvroSchema = "null";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips boolean primitive", () => {
			const schema: AvroSchema = "boolean";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips int primitive", () => {
			const schema: AvroSchema = "int";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips long primitive", () => {
			const schema: AvroSchema = "long";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips float primitive", () => {
			const schema: AvroSchema = "float";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips double primitive", () => {
			const schema: AvroSchema = "double";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips string primitive", () => {
			const schema: AvroSchema = "string";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips bytes primitive", () => {
			const schema: AvroSchema = "bytes";
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips array schema", () => {
			const schema: AvroSchema = { type: "array", items: "string" };
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});

		it("roundtrips map schema", () => {
			const schema: AvroSchema = { type: "map", values: "int" };
			const term = adapter.parse(schema);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual(schema);
		});
	});

	describe("parse complex types", () => {
		it("parses a record schema", () => {
			const schema: AvroSchema = {
				type: "record",
				name: "Person",
				fields: [
					{ name: "name", type: "string" },
					{ name: "age", type: "int" },
				],
			};
			const term = adapter.parse(schema);
			expect(term.kind).toBe("apply");
		});

		it("parses an enum schema", () => {
			const schema: AvroSchema = {
				type: "enum",
				name: "Status",
				symbols: ["ACTIVE", "INACTIVE"],
			};
			const term = adapter.parse(schema);
			expect(term.kind).toBe("apply");
		});

		it("parses a union schema (array)", () => {
			const schema: AvroSchema = ["null", "string"];
			const term = adapter.parse(schema);
			expect(term.kind).toBe("apply");
		});

		it("parses an empty union as bottom", () => {
			const schema: AvroSchema = [];
			const term = adapter.parse(schema);
			expect(term.kind).toBe("bottom");
		});

		it("parses a fixed schema as bytes", () => {
			const schema: AvroSchema = { type: "fixed", name: "MD5", size: 16 };
			const term = adapter.parse(schema);
			expect(term.kind).toBe("base");
		});
	});

	describe("inhabits: true for matching values", () => {
		it("null value inhabits null primitive", () => {
			const term = adapter.parse("null");
			expect(adapter.inhabits(null, term)).toBe(true);
		});

		it("boolean value inhabits boolean primitive", () => {
			const term = adapter.parse("boolean");
			expect(adapter.inhabits(true, term)).toBe(true);
		});

		it("integer value inhabits int primitive", () => {
			const term = adapter.parse("int");
			expect(adapter.inhabits(42, term)).toBe(true);
		});

		it("float value inhabits double primitive", () => {
			const term = adapter.parse("double");
			expect(adapter.inhabits(3.14, term)).toBe(true);
		});

		it("string value inhabits string primitive", () => {
			const term = adapter.parse("string");
			expect(adapter.inhabits("hello", term)).toBe(true);
		});

		it("object value inhabits record schema", () => {
			const term = adapter.parse({
				type: "record",
				name: "Person",
				fields: [{ name: "name", type: "string" }],
			});
			expect(adapter.inhabits({ name: "Alice" }, term)).toBe(true);
		});

		it("array value inhabits array schema", () => {
			const term = adapter.parse({ type: "array", items: "string" });
			expect(adapter.inhabits(["a", "b"], term)).toBe(true);
		});

		it("string value inhabits nullable string union", () => {
			const term = adapter.parse(["null", "string"]);
			expect(adapter.inhabits("hello", term)).toBe(true);
			expect(adapter.inhabits(null, term)).toBe(true);
		});
	});

	describe("inhabits: false for non-matching values", () => {
		it("number does not inhabit string primitive", () => {
			const term = adapter.parse("string");
			expect(adapter.inhabits(42, term)).toBe(false);
		});

		it("string does not inhabit boolean primitive", () => {
			const term = adapter.parse("boolean");
			expect(adapter.inhabits("true", term)).toBe(false);
		});

		it("float does not inhabit int primitive", () => {
			const term = adapter.parse("int");
			expect(adapter.inhabits(3.14, term)).toBe(false);
		});

		it("wrong fields do not inhabit record schema", () => {
			const term = adapter.parse({
				type: "record",
				name: "Person",
				fields: [{ name: "name", type: "string" }],
			});
			expect(adapter.inhabits({ name: 42 }, term)).toBe(false);
		});

		it("wrong element type does not inhabit array schema", () => {
			const term = adapter.parse({ type: "array", items: "int" });
			expect(adapter.inhabits(["not", "numbers"], term)).toBe(false);
		});
	});

	describe("isEncodable", () => {
		it("returns true for supported terms", () => {
			expect(adapter.isEncodable(base("string"))).toBe(true);
			expect(adapter.isEncodable(base("int"))).toBe(true);
			expect(adapter.isEncodable(base("boolean"))).toBe(true);
			expect(adapter.isEncodable(base("double"))).toBe(true);
			expect(adapter.isEncodable(base("null"))).toBe(true);
			expect(adapter.isEncodable(array(base("string")))).toBe(true);
			expect(adapter.isEncodable(map(base("string"), base("int")))).toBe(true);
			expect(adapter.isEncodable(product([field("x", base("string"))]))).toBe(true);
		});

		it("returns false for unsupported terms", () => {
			expect(adapter.isEncodable(forall("T", base("string")))).toBe(false);
			// Avro has no top type
			expect(adapter.isEncodable(base("date"))).toBe(false);
		});
	});

	// P0.1 — Family B regression: IR-canonical base names must not cascade
	// failures into containing records, arrays, maps, and unions. The
	// reviewer's bench:fidelity audit (2026-05-18) flagged SP9 Labelled
	// Record as ✗ because the IR uses `number` / `integer` (JSON-Schema-
	// flavored), while Avro's primitive set is `null|boolean|int|long|
	// float|double|bytes|string`. Mirror the GraphQL Tier 1 fix:
	// normalize on encode, map back on parse.
	describe("Family B regression: IR base-name normalization", () => {
		it('encodes base("number") as Avro double', () => {
			expect(adapter.encode(base("number"))).toBe("double");
		});

		it('encodes base("integer") as Avro long', () => {
			expect(adapter.encode(base("integer"))).toBe("long");
		});

		it("isEncodable accepts IR-canonical base names used by the witness corpus", () => {
			expect(adapter.isEncodable(base("number"))).toBe(true);
			expect(adapter.isEncodable(base("integer"))).toBe(true);
		});

		it("SP9 Labelled Record encodes through the full record schema", () => {
			const term = product([
				field("id", base("number")),
				field("name", base("string")),
				field("email", base("string")),
			]);
			const encoded = adapter.encode(term);
			expect(encoded).toEqual({
				type: "record",
				name: "Record",
				fields: [
					{ name: "id", type: "double" },
					{ name: "name", type: "string" },
					{ name: "email", type: "string" },
				],
			});
		});

		it("SP9 Labelled Record round-trips structurally", () => {
			const term = product([
				field("id", base("number")),
				field("name", base("string")),
				field("email", base("string")),
			]);
			const encoded = adapter.encode(term);
			const parsed = adapter.parse(encoded);
			expect(parsed).toEqual(term);
		});

		it('array of base("number") encodes through', () => {
			const term = array(base("number"));
			const encoded = adapter.encode(term);
			expect(encoded).toEqual({ type: "array", items: "double" });
		});

		it('map of base("integer") encodes through', () => {
			const term = map(base("string"), base("integer"));
			const encoded = adapter.encode(term);
			expect(encoded).toEqual({ type: "map", values: "long" });
		});

		it("parse maps Avro double back to IR number", () => {
			expect(adapter.parse("double")).toEqual(base("number"));
		});

		it("parse maps Avro long back to IR integer", () => {
			expect(adapter.parse("long")).toEqual(base("integer"));
		});

		it("inhabits accepts numeric values against IR number after normalization", () => {
			expect(adapter.inhabits(3.14, base("number"))).toBe(true);
			expect(adapter.inhabits(42, base("integer"))).toBe(true);
			// Non-integers fail integer
			expect(adapter.inhabits(3.14, base("integer"))).toBe(false);
		});

		it("inhabits SP9 Labelled Record accepts a matching object", () => {
			const term = product([
				field("id", base("number")),
				field("name", base("string")),
				field("email", base("string")),
			]);
			expect(adapter.inhabits({ id: 1, name: "Alice", email: "a@x" }, term)).toBe(true);
			expect(adapter.inhabits({ id: "not-a-number", name: "Alice", email: "a@x" }, term)).toBe(
				false,
			);
		});

		// Suppress unused-import warning while keeping the helper available
		// for future structural tests that need name-agnostic comparisons.
		it("stripRecordNames helper is available", () => {
			expect(stripRecordNames({ type: "record", name: "X", fields: [] })).toEqual({
				type: "record",
				fields: [],
			});
		});

		// `bottom` and `literal` keep their existing semantics; pin them so
		// the normalization change doesn't accidentally widen acceptance.
		it("does not accept bottom", () => {
			expect(adapter.encode(bottom())).toEqual([]);
		});

		it("preserves literal-as-enum encoding", () => {
			expect(adapter.encode(literal("ACTIVE"))).toEqual({
				type: "enum",
				name: "LiteralEnum",
				symbols: ["ACTIVE"],
			});
		});

		// Nullable-by-union round-trip: ["null", "double"] should parse as
		// union(base("null"), base("number")) and re-encode back to the
		// same descriptor.
		it("nullable number union round-trips through normalization", () => {
			const schema: AvroSchema = ["null", "double"];
			const term = adapter.parse(schema);
			expect(term).toEqual(union([base("null"), base("number")]));
			expect(adapter.encode(term)).toEqual(schema);
		});
	});
});
