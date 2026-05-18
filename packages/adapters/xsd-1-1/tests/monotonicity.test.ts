// XSD 1.0 ⊆ XSD 1.1 monotonicity invariant.
//
// XSD 1.1 is a strict superset of XSD 1.0: every legal 1.0 schema is a
// legal 1.1 schema, and 1.1 adds xs:assert / xs:alternative / xs:override /
// xs:openContent / stronger wildcards. Therefore for every scorecard row,
// 1.1's verdict must be at least as strong as 1.0's. A regression on any
// row indicates a bug in:
//
//   - the 1.1 adapter encoder (e.g. silent loss of a code path the
//     shared engine provides), or
//   - a witness fixture (the same witness scoring differently against
//     the two adapters), or
//   - the criterion evaluator.
//
// It does NOT indicate a finding about the languages themselves.
//
// This test pins the invariant. If a future change causes a regression,
// the test fails loudly with a per-row breakdown.

import { CRITERIA, checkMonotonicity, evaluateScorecard } from "@typecarta/core";
import { XsdAdapter as Xsd10Adapter } from "@typecarta/adapter-xsd";
import { ALL_WITNESSES } from "../../../witnesses/src/index.js";
import { describe, expect, it } from "vitest";
import { XsdAdapter as Xsd11Adapter } from "../src/adapter.js";

const xsd10 = new Xsd10Adapter();
const xsd11 = new Xsd11Adapter();

function fullScorecardFor(adapter: Xsd10Adapter | Xsd11Adapter) {
	const witnesses = ALL_WITNESSES.map((w) => ({
		criterionId: w.id,
		name: w.name,
		schema: w.schema,
	}));
	return evaluateScorecard(adapter, witnesses, CRITERIA);
}

describe("xsd 1.0 ⊆ xsd-1-1 monotonicity", () => {
	it("xsd-1-1 never regresses against xsd 1.0 on any row", () => {
		const subset = fullScorecardFor(xsd10);
		const superset = fullScorecardFor(xsd11);
		const result = checkMonotonicity(subset, superset);

		// Format every violation so a CI failure tells you exactly which row
		// and which transition triggered it.
		const summary = result.violations
			.map(
				(v) =>
					`${v.criterionId}: ${v.subsetValue} (1.0) → ${v.supersetValue} (1.1) — ${v.kind}`,
			)
			.join("\n");

		expect(result.violations, `monotonicity violations:\n${summary}`).toEqual([]);
	});
});
