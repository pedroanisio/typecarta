// family-t
// Define Family T witnesses (π'₆₃..π'₆₅) covering type-level computation.
import { base, conditional, field, keyOf, mapped, product, typeVar } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₆₃ — Structural Key Enumeration: keyof {x: number, y: number}. */
export const SP63_KEYOF: TypeTerm = keyOf(
	product([field("x", base("number")), field("y", base("number"))]),
);

/** SP₆₄ — Mapped Type: {[K in keyof T]: string}. */
export const SP64_MAPPED: TypeTerm = mapped(
	keyOf(product([field("x", base("number")), field("y", base("number"))])),
	base("string"),
);

/** SP₆₅ — Conditional Type: α extends string ? number : boolean. */
export const SP65_CONDITIONAL: TypeTerm = conditional(
	typeVar("alpha"),
	base("string"),
	base("number"),
	base("boolean"),
);
