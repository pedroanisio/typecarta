// family-i
// Define Family I witnesses (π'₃₄..π'₃₇) covering nominal identity and branding.
import { base, extension, field, nominal, product } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₃₄ — Structural Identity Only: no nominal tags, purely structural. */
export const SP34_STRUCTURAL: TypeTerm = product([
	field("x", base("number")),
	field("y", base("number")),
]);

/** SP₃₅ — Nominal Tag / Brand: type distinguished by nominal tag. */
export const SP35_NOMINAL_TAG: TypeTerm = nominal("UserId", base("string"));

/** SP₃₆ — Opaque / Newtype Wrapper: sealed nominal hiding inner type. */
export const SP36_OPAQUE: TypeTerm = nominal("SecretKey", base("string"), true);

/** SP₃₇ — Explicit Coercion Edge: extension encoding a coercion between nominal types. */
export const SP37_COERCION: TypeTerm = extension(
	"coercion",
	{
		from: "UserId",
		to: "AccountId",
	},
	[nominal("UserId", base("string")), nominal("AccountId", base("string"))],
);
