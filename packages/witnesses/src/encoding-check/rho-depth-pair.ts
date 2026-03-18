// rho-depth-pair
// Define the depth-subtyping encoding-check pair (ρ-depth).
// Demonstrate covariant depth subtyping through nested product structures.
import { array, base, field, product } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** Deep type — product with nested product containing further nesting. */
export const RHO_DEPTH_DEEP: TypeTerm = product([
	field(
		"user",
		product([
			field("profile", product([field("name", base("string")), field("avatar", base("string"))])),
			field(
				"settings",
				product([field("theme", base("string")), field("notifications", array(base("string")))]),
			),
		]),
	),
]);

/** Shallow type — flattened representation of the same data. */
export const RHO_DEPTH_SHALLOW: TypeTerm = product([
	field("user", product([field("profile", product([field("name", base("string"))]))])),
]);

/** Depth encoding-check pair: [deeper, shallower]. */
export const RHO_DEPTH_PAIR: readonly [TypeTerm, TypeTerm] = [RHO_DEPTH_DEEP, RHO_DEPTH_SHALLOW];
