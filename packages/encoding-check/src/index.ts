// encoding-check
// Public API for the encoding-check package. Re-export the runner,
// report generator, and comparison strategies.

export { runEncodingChecks } from "./runner.js";
export { generateReport } from "./report.js";
export {
	compareExact,
	type ExactComparisonResult,
	type ExactMismatch,
	compareSampled,
	type SamplingConfig,
	type SamplingResult,
	type SamplingViolation,
} from "./strategies/index.js";
