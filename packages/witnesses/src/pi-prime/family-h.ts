// family-h
// Define Family H witnesses (π'₂₈..π'₃₃) covering parametricity and higher-kinded types.
import { apply, arrow, base, field, forall, product, typeVar } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₂₈ — Rank-1 Generics: Λα.{data: α, label: string}. */
export const SP28_RANK1_GENERICS: TypeTerm = forall(
	"alpha",
	product([field("data", typeVar("alpha")), field("label", base("string"))]),
);

/** SP₂₉ — Bounded Generics: Λα<:{id: number}.{item: α}. */
export const SP29_BOUNDED_GENERICS: TypeTerm = forall(
	"alpha",
	product([field("item", typeVar("alpha"))]),
	{
		bound: product([field("id", base("number"))]),
	},
);

/** SP₃₀ — Generic Default: Λα=string.{value: α}. */
export const SP30_GENERIC_DEFAULT: TypeTerm = forall(
	"alpha",
	product([field("value", typeVar("alpha"))]),
	{
		default: base("string"),
	},
);

/** SP₃₁ — Higher-Rank Polymorphism: a product containing a forall inside. */
export const SP31_HIGHER_RANK: TypeTerm = product([
	field("transform", forall("alpha", arrow([typeVar("alpha")], typeVar("alpha")))),
]);

/** SP₃₂ — Higher-Kinded Type Parameter: Λ(F: * → *).F(string). */
export const SP32_HKT: TypeTerm = forall("F", apply("apply", [typeVar("F"), base("string")]), {
	annotations: { hkt: true },
});

/** SP₃₃ — Variance Annotation: Λ(out α).{value: α}. */
export const SP33_VARIANCE: TypeTerm = forall(
	"alpha",
	product([field("value", typeVar("alpha"))]),
	{
		variance: "covariant",
	},
);
