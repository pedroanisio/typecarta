// family-r
// Define Family R witness (π'₆₀) covering unsound bivariant positions.
import { field, forall, product, typeVar } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₆₀ — Unsound Bivariant Type: forall with bivariant annotation. */
export const SP60_BIVARIANT: TypeTerm = forall(
	"alpha",
	product([field("value", typeVar("alpha"))]),
	{
		annotations: { bivariant: true },
	},
);
