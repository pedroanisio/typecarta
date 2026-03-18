// family-p
// Define Family P witnesses (π'₅₆..π'₅₈) covering meta-annotation.
import { base } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₅₆ — Description / Documentation: type carries a human-readable description. */
export const SP56_DESCRIPTION: TypeTerm = base("string", {
	description: "An email address string in RFC 5322 format",
});

/** SP₅₇ — Example Values: type carries example value annotations. */
export const SP57_EXAMPLES: TypeTerm = base("string", {
	examples: ["alice@example.com", "bob@example.org"],
});

/** SP₅₈ — Custom Extension Metadata: custom annotation beyond the well-known set. */
export const SP58_CUSTOM_META: TypeTerm = base("string", {
	"x-format": "iso8601",
	"x-ui-widget": "date-picker",
});
