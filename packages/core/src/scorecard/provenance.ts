// scorecard/provenance
// Construct ScorecardProvenance records. Pure: no I/O, no node deps.
//
// PALS's law: every scorecard a consumer relies on must be traceable to a
// specific typecarta build. evaluateScorecard does not auto-attach
// provenance — callers compute it at the runtime boundary (where version
// and commit hash are knowable) and pass it in.
//
// The CLI reads version/hash from package.json/git in @typecarta/cli's
// provenance module. Library consumers and tests should call
// createProvenance with explicit values.

import type { ScorecardProvenance } from "./types.js";

/**
 * Build a {@link ScorecardProvenance} from explicit values, with
 * `"unknown"` fallbacks for fields the caller does not supply and the
 * current ISO-8601 timestamp for `generatedAt` by default.
 *
 * @param overrides - explicit values for any subset of the provenance fields.
 * @returns a provenance record with overrides applied over the defaults.
 */
export function createProvenance(
	overrides: Partial<ScorecardProvenance> = {},
): ScorecardProvenance {
	return {
		typecartaVersion: overrides.typecartaVersion ?? "unknown",
		adapterSpecVersion: overrides.adapterSpecVersion ?? "unknown",
		commitHash: overrides.commitHash ?? "unknown",
		generatedAt: overrides.generatedAt ?? new Date().toISOString(),
	};
}
