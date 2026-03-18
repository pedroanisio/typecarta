// family-n
// Define Family N witnesses (π'₅₀..π'₅₂) covering modularity and scoping.
import { base, extension, field, letBinding, product } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₅₀ — Named Type Alias: let Email = string in {email: Email}. */
export const SP50_TYPE_ALIAS: TypeTerm = letBinding(
	"Email",
	base("string"),
	product([field("email", base("string"))]),
);

/** SP₅₁ — Module / Namespace: extension grouping types into a module. */
export const SP51_MODULE: TypeTerm = extension(
	"module",
	{
		name: "UserModule",
	},
	[product([field("id", base("string"))])],
);

/** SP₅₂ — Visibility / Export Control: extension controlling export visibility. */
export const SP52_VISIBILITY: TypeTerm = extension(
	"visibility",
	{
		level: "public",
	},
	[product([field("id", base("string"))])],
);
