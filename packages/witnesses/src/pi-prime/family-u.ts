// family-u
// Define Family U witness (π'₆₆) covering row polymorphism.
import { base, field, rowPoly } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₆₆ — Row-Polymorphic Record: {id: number, name: string | ρ}. */
export const SP66_ROW_POLY: TypeTerm = rowPoly(
	[field("id", base("number")), field("name", base("string"))],
	"rho",
);
