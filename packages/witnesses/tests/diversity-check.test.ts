import { PI_IDS, PI_REGISTRY } from "@typecarta/core";
import { describe, expect, it } from "vitest";
import { DIVERSE_SCHEMAS } from "../src/index.js";

describe("Diverse schema set ℂ", () => {
	it("has exactly 15 schemas", () => {
		expect(DIVERSE_SCHEMAS).toHaveLength(15);
	});

	it("covers all 15 criteria (Π-completeness)", () => {
		for (const id of PI_IDS) {
			const witness = DIVERSE_SCHEMAS.find((w) => w.id === id);
			expect(witness, `Missing witness for ${id}`).toBeDefined();
		}
	});

	it("each schema satisfies its primary criterion", () => {
		for (const witness of DIVERSE_SCHEMAS) {
			const criterion = PI_REGISTRY.get(witness.id);
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
		const ids = DIVERSE_SCHEMAS.map((w) => w.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
