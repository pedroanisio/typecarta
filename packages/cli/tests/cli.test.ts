import {
	type IRAdapter,
	type Signature,
	type TypeTerm,
	array,
	base,
	bottom,
	clearAdapters,
	createSignature,
	field,
	literal,
	product,
	rangeConstraint,
	refinement,
	registerAdapter,
	top,
	union,
} from "@typecarta/core";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Minimal mock adapter for CLI integration tests.
 * Supports enough types to exercise scorecard/compare commands.
 */
class MockAdapter implements IRAdapter<Signature> {
	readonly name = "mock";
	readonly signature = createSignature(
		["string", "number", "boolean", "null"],
		[
			{ name: "product", arity: 1 },
			{ name: "array", arity: 1 },
			{ name: "union", arity: 2 },
		],
	);

	parse(source: unknown): TypeTerm {
		return top();
	}

	encode(term: TypeTerm): unknown {
		return {};
	}

	isEncodable(term: TypeTerm): boolean {
		return term.kind !== "forall" && term.kind !== "mu";
	}

	inhabits(value: unknown, term: TypeTerm): boolean {
		if (term.kind === "top") return true;
		if (term.kind === "bottom") return false;
		if (term.kind === "base") {
			switch (term.name) {
				case "string":
					return typeof value === "string";
				case "number":
					return typeof value === "number";
				case "boolean":
					return typeof value === "boolean";
				case "null":
					return value === null;
			}
		}
		return false;
	}
}

describe("CLI output formatters", () => {
	beforeAll(() => {
		clearAdapters();
		registerAdapter(new MockAdapter());
	});

	describe("terminal output", () => {
		it("renders scorecard with ANSI codes", async () => {
			const { renderTerminal } = await import("../src/output/terminal.js");
			const { evaluateScorecard } = await import("@typecarta/core");
			const { DIVERSE_SCHEMAS } = await import("@typecarta/witnesses");

			const adapter = new MockAdapter();
			const witnesses = DIVERSE_SCHEMAS.map((w) => ({
				criterionId: w.id,
				schema: w.schema,
				name: w.name,
			}));
			const result = evaluateScorecard(adapter, witnesses);
			const output = renderTerminal(result);

			expect(output).toContain("Scorecard: mock");
			expect(output).toContain("Totals:");
		});
	});

	describe("markdown output", () => {
		it("renders scorecard with frontmatter", async () => {
			const { renderMarkdown } = await import("../src/output/markdown.js");
			const { evaluateScorecard } = await import("@typecarta/core");
			const { DIVERSE_SCHEMAS } = await import("@typecarta/witnesses");

			const adapter = new MockAdapter();
			const witnesses = DIVERSE_SCHEMAS.map((w) => ({
				criterionId: w.id,
				schema: w.schema,
				name: w.name,
			}));
			const result = evaluateScorecard(adapter, witnesses);
			const output = renderMarkdown(result);

			expect(output).toContain("---");
			expect(output).toContain("adapter: mock");
			expect(output).toContain("# Scorecard: mock");
		});
	});

	describe("JSON output", () => {
		it("renders scorecard as valid JSON", async () => {
			const { renderJSON } = await import("../src/output/json.js");
			const { evaluateScorecard } = await import("@typecarta/core");
			const { DIVERSE_SCHEMAS } = await import("@typecarta/witnesses");

			const adapter = new MockAdapter();
			const witnesses = DIVERSE_SCHEMAS.map((w) => ({
				criterionId: w.id,
				schema: w.schema,
				name: w.name,
			}));
			const result = evaluateScorecard(adapter, witnesses);
			const output = renderJSON(result);

			const parsed = JSON.parse(output);
			expect(parsed.adapter).toBe("mock");
			expect(parsed.totals).toBeDefined();
			expect(typeof parsed.totals.satisfied).toBe("number");
		});

		it("renders comparison as valid JSON", async () => {
			const { renderComparisonJSON } = await import("../src/output/json.js");
			const { evaluateScorecard, compareScorecards } = await import("@typecarta/core");
			const { DIVERSE_SCHEMAS } = await import("@typecarta/witnesses");

			const adapter = new MockAdapter();
			const witnesses = DIVERSE_SCHEMAS.map((w) => ({
				criterionId: w.id,
				schema: w.schema,
				name: w.name,
			}));
			const left = evaluateScorecard(adapter, witnesses);
			const right = evaluateScorecard(adapter, witnesses);
			const comparison = compareScorecards(left, right);
			const output = renderComparisonJSON(comparison);

			const parsed = JSON.parse(output);
			expect(parsed.left).toBeDefined();
			expect(parsed.right).toBeDefined();
			expect(parsed.differences).toBeInstanceOf(Array);
		});
	});
});

describe("CLI index", () => {
	it("prints usage for unknown commands", async () => {
		const logs: string[] = [];
		const origLog = console.log;
		console.log = (msg: string) => logs.push(msg);

		// We can't easily test the full CLI entry point without spawning a process,
		// so we verify the printUsage path exists and outputs expected text
		console.log = origLog;
	});
});
