// rho-width-pair
// Define the width-subtyping encoding-check pair (ρ-width).
// The narrower type (fewer fields) is a width-subtype of the wider type.
import { base, field, product } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** Wider type — has three fields. */
export const RHO_WIDTH_WIDE: TypeTerm = product([
	field("id", base("number")),
	field("name", base("string")),
	field("email", base("string")),
]);

/** Narrower type — has two fields (a width-subtype). */
export const RHO_WIDTH_NARROW: TypeTerm = product([
	field("id", base("number")),
	field("name", base("string")),
]);

/** Width encoding-check pair: [wider, narrower]. */
export const RHO_WIDTH_PAIR: readonly [TypeTerm, TypeTerm] = [RHO_WIDTH_WIDE, RHO_WIDTH_NARROW];
