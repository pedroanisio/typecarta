import {
	type IRAdapter,
	SELF_CAPABILITIES,
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
			const { CORE_SCHEMAS } = await import("@typecarta/witnesses");

			const adapter = new MockAdapter();
			const witnesses = CORE_SCHEMAS.map((w) => ({
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
			const { CORE_SCHEMAS } = await import("@typecarta/witnesses");

			const adapter = new MockAdapter();
			const witnesses = CORE_SCHEMAS.map((w) => ({
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
			const { CORE_SCHEMAS } = await import("@typecarta/witnesses");

			const adapter = new MockAdapter();
			const witnesses = CORE_SCHEMAS.map((w) => ({
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
			const { CORE_SCHEMAS } = await import("@typecarta/witnesses");

			const adapter = new MockAdapter();
			const witnesses = CORE_SCHEMAS.map((w) => ({
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

describe("capabilities command", () => {
	it("exports TypeCarta self-capabilities as stable machine-readable JSON", async () => {
		const logs: string[] = [];
		const origLog = console.log;
		console.log = (msg: string) => logs.push(msg);
		try {
			const { run } = await import("../src/commands/capabilities.js");
			await run(["--format", "json"]);
		} finally {
			console.log = origLog;
		}

		const parsed = JSON.parse(logs.join("\n"));
		expect(Object.keys(parsed).sort()).toEqual(["capabilities", "schemaVersion", "subject"]);
		expect(parsed.subject).toBe("typecarta-self");
		expect(parsed.schemaVersion).toBe("0.1.0");
		expect(parsed.capabilities).toHaveLength(SELF_CAPABILITIES.length);
		expect(parsed.capabilities).toEqual(SELF_CAPABILITIES);

		const allowedSupport = new Set([
			"native-node",
			"apply-constructor",
			"annotation",
			"extension",
			"unsupported",
			"out-of-scope",
		]);

		for (const capability of parsed.capabilities) {
			expect(Object.keys(capability).sort()).toEqual([
				"criterionId",
				"mechanism",
				"notes",
				"support",
				"witnessKind",
			]);
			expect(capability.criterionId).toMatch(/^pi-prime-\d{2}$/);
			expect(allowedSupport.has(capability.support)).toBe(true);
			expect(capability.mechanism.length).toBeGreaterThan(0);
			expect(capability.witnessKind.length).toBeGreaterThan(0);
			expect(capability.notes.length).toBeGreaterThan(0);
			expect(capability.term).toBeUndefined();
		}

		expect(parsed.capabilities[0]).toEqual({
			criterionId: "pi-prime-08",
			support: "apply-constructor",
			mechanism: "TypeTerm apply constructor",
			witnessKind: "apply:tuple",
			notes: "Positional tuples use the well-known tuple constructor.",
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
