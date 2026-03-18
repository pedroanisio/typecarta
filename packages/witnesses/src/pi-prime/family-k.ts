// family-k
// Define Family K witnesses (π'₄₂..π'₄₄, π'₆₇) covering value dependency.
import {
	base,
	extension,
	field,
	literal,
	product,
	rangeConstraint,
	refinement,
	union,
} from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₄₂ — Finite Tagged Dependent Choice: tag-dependent branches. */
export const SP42_TAGGED_DEPENDENT: TypeTerm = union([
	product([
		field("kind", literal("int")),
		field("value", refinement(base("number"), rangeConstraint())),
	]),
	product([field("kind", literal("float")), field("value", base("number"))]),
]);

/** SP₄₃ — Intra-Object Cross-Field Constraint: refinement over a product. */
export const SP43_CROSS_FIELD: TypeTerm = refinement(
	product([field("min", base("number")), field("max", base("number"))]),
	rangeConstraint(), // cross-field: the product itself is the refinement base
);

/** SP₄₄ — Inter-Object Referential Constraint: foreign-key extension. */
export const SP44_FOREIGN_KEY: TypeTerm = extension(
	"foreign-key",
	{
		sourceField: "authorId",
		targetCollection: "users",
		targetField: "id",
	},
	[product([field("authorId", base("string")), field("title", base("string"))])],
);

/** SP₆₇ — Path-Navigating Constraint: path-constraint extension. */
export const SP67_PATH_CONSTRAINT: TypeTerm = extension(
	"path-constraint",
	{
		path: "$.address.zipCode",
		constraint: "pattern",
	},
	[product([field("address", product([field("zipCode", base("string"))]))])],
);
