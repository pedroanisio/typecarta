import { PI_PRIME_CRITERIA, PI_PRIME_IDS } from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { DIVERSE_PRIME_SCHEMAS } from "../src/index.js";
import { RHO_DEPTH_PAIR, RHO_GENERIC_PAIR, RHO_WIDTH_PAIR } from "../src/index.js";

describe("Expanded prime schema set C'", () => {
	it("has exactly 70 schemas", () => {
		expect(DIVERSE_PRIME_SCHEMAS).toHaveLength(70);
	});

	it("covers all 70 pi-prime criteria (Pi'-completeness)", () => {
		for (const id of PI_PRIME_IDS) {
			const witness = DIVERSE_PRIME_SCHEMAS.find((w) => w.id === id);
			expect(witness, `Missing witness for ${id}`).toBeDefined();
		}
	});

	it("each schema satisfies its primary criterion", () => {
		for (const witness of DIVERSE_PRIME_SCHEMAS) {
			const criterion = PI_PRIME_CRITERIA.find((c) => c.id === witness.id);
			expect(criterion, `Missing criterion ${witness.id}`).toBeDefined();
			if (!criterion) continue;
			const result = criterion.evaluate(witness.schema);
			expect(
				result.status,
				`${witness.name} should satisfy ${witness.id} but got ${result.status}: ${
					result.status === "not-satisfied" ? result.reason : ""
				}`,
			).toBe("satisfied");
		}
	});

	it("has unique criterion IDs (no duplicates)", () => {
		const ids = DIVERSE_PRIME_SCHEMAS.map((w) => w.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("all IDs match valid pi-prime IDs", () => {
		for (const witness of DIVERSE_PRIME_SCHEMAS) {
			expect(
				(PI_PRIME_IDS as readonly string[]).includes(witness.id),
				`${witness.id} is not a valid PiPrimeId`,
			).toBe(true);
		}
	});
});

describe("Encoding-check witness pairs", () => {
	it("width pair has two distinct TypeTerm elements", () => {
		expect(RHO_WIDTH_PAIR).toHaveLength(2);
		expect(RHO_WIDTH_PAIR[0]).toBeDefined();
		expect(RHO_WIDTH_PAIR[1]).toBeDefined();
		expect(RHO_WIDTH_PAIR[0]).not.toEqual(RHO_WIDTH_PAIR[1]);
	});

	it("depth pair has two distinct TypeTerm elements", () => {
		expect(RHO_DEPTH_PAIR).toHaveLength(2);
		expect(RHO_DEPTH_PAIR[0]).toBeDefined();
		expect(RHO_DEPTH_PAIR[1]).toBeDefined();
		expect(RHO_DEPTH_PAIR[0]).not.toEqual(RHO_DEPTH_PAIR[1]);
	});

	it("generic pair has two distinct TypeTerm elements", () => {
		expect(RHO_GENERIC_PAIR).toHaveLength(2);
		expect(RHO_GENERIC_PAIR[0]).toBeDefined();
		expect(RHO_GENERIC_PAIR[1]).toBeDefined();
		expect(RHO_GENERIC_PAIR[0]).not.toEqual(RHO_GENERIC_PAIR[1]);
	});

	it("width pair elements are both product types", () => {
		expect(RHO_WIDTH_PAIR[0].kind).toBe("apply");
		expect(RHO_WIDTH_PAIR[1].kind).toBe("apply");
	});

	it("depth pair deep element has more nesting than shallow", () => {
		// Deep has user.profile.avatar + user.settings
		// Shallow has user.profile (fewer nested fields)
		const deep = RHO_DEPTH_PAIR[0];
		const shallow = RHO_DEPTH_PAIR[1];
		expect(deep.kind).toBe("apply");
		expect(shallow.kind).toBe("apply");
		expect(JSON.stringify(deep).length).toBeGreaterThan(JSON.stringify(shallow).length);
	});
});
