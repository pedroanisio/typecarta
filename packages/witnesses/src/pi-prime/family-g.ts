// family-g
// Define Family G witnesses (π'₂₅..π'₂₇) covering recursion patterns.
import { array, base, field, forall, mu, product, typeVar } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₂₅ — Direct Self-Recursion: μα.{value: string, children: α[]}. */
export const SP25_DIRECT_RECURSION: TypeTerm = mu(
	"alpha",
	product([field("value", base("string")), field("children", array(typeVar("alpha")))]),
);

/** SP₂₆ — Mutual Recursion: nested μ inside μ — A = {v: string, next: μβ.{items: α[]}}. */
export const SP26_MUTUAL_RECURSION: TypeTerm = mu(
	"alpha",
	product([
		field("value", base("string")),
		field("next", mu("beta", product([field("items", array(typeVar("alpha")))]))),
	]),
);

/** SP₂₇ — Recursive Generic: Λα.μβ.{data: α, next: β | null}. */
export const SP27_RECURSIVE_GENERIC: TypeTerm = forall(
	"alpha",
	mu("beta", product([field("data", typeVar("alpha")), field("next", typeVar("beta"))])),
);
