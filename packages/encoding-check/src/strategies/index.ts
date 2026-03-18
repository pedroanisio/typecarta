// strategies
// Barrel export for comparison strategy modules.

export { compareExact, type ExactComparisonResult, type ExactMismatch } from "./exact.js";
export {
	compareSampled,
	type SamplingConfig,
	type SamplingResult,
	type SamplingViolation,
} from "./sampling.js";
