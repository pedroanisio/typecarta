// family-s
// Define Family S witnesses (π'₆₁..π'₆₂) covering phantom and indexed types.
import { base, conditional, field, forall, product, typeVar, union } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₆₁ — Phantom Type Parameter: α does not appear free in the body. */
export const SP61_PHANTOM: TypeTerm = forall("phantom", product([field("value", base("string"))]));

/** SP₆₂ — GADT / Indexed Type: forall whose body is a union with conditional branches. */
export const SP62_GADT: TypeTerm = forall(
	"alpha",
	union([
		conditional(typeVar("alpha"), base("string"), base("number"), base("boolean")),
		product([field("data", typeVar("alpha"))]),
	]),
	{
		annotations: { gadt: true },
	},
);
