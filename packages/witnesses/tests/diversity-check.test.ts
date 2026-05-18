import { CORE_IDS, getCriterion } from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { CORE_SCHEMAS } from "../src/index.js";

describe("Core witness set", () => {
	it("has exactly 15 schemas", () => {
		expect(CORE_SCHEMAS).toHaveLength(15);
	});

	it("covers every core-tagged criterion", () => {
		for (const id of CORE_IDS) {
			const witness = CORE_SCHEMAS.find((w) => w.id === id);
			expect(witness, `Missing witness for ${id}`).toBeDefined();
		}
	});

	it("each schema satisfies its primary criterion", () => {
		for (const witness of CORE_SCHEMAS) {
			const criterion = getCriterion(witness.id);
			expect(criterion, `Missing criterion ${witness.id}`).toBeDefined();
			if (!criterion) continue;
			const result = criterion.evaluate(witness.schema);
			expect(
				result.status,
				`${witness.name} should satisfy ${witness.id} but got ${result.status}`,
			).toBe("satisfied");
		}
	});

	it("has unique criterion IDs (no duplicates)", () => {
		const ids = CORE_SCHEMAS.map((w) => w.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
