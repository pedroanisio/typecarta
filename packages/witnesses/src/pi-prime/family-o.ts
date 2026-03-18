// family-o
// Define Family O witnesses (π'₅₃..π'₅₅) covering evolution and compatibility.
import { base, field, product } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₅₃ — Deprecation Annotation: type carries deprecated marker. */
export const SP53_DEPRECATED: TypeTerm = product([field("oldField", base("string"))], {
	deprecated: true,
});

/** SP₅₄ — Versioned Schema Identity: type carries version annotation. */
export const SP54_VERSIONED: TypeTerm = product([field("data", base("string"))], {
	version: "2.0.0",
});

/** SP₅₅ — Backward Compatibility: type references a prior compatible version. */
export const SP55_BACKWARD_COMPAT: TypeTerm = product([field("data", base("string"))], {
	backwardCompatibleWith: "1.0.0",
});
