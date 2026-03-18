// family-j
// Define Family J witnesses (π'₃₈..π'₄₁, π'₆₈..π'₆₉) covering refinement and predicates.
import {
	andPredicate,
	base,
	literal,
	multipleOfConstraint,
	patternConstraint,
	rangeConstraint,
	refinement,
	templateLiteral,
} from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₃₈ — Range / Bound Constraint: {v: number | 0 ≤ v ≤ 255}. */
export const SP38_RANGE: TypeTerm = refinement(base("number"), rangeConstraint(0, 255));

/** SP₃₉ — Pattern / Regex Constraint: {v: string | v ~ /^[A-Z]{2}\\d{3}$/}. */
export const SP39_PATTERN: TypeTerm = refinement(
	base("string"),
	patternConstraint("^[A-Z]{2}\\d{3}$"),
);

/** SP₄₀ — Modular / Divisibility Constraint: {v: number | v mod 3 = 0}. */
export const SP40_MULTIPLE_OF: TypeTerm = refinement(base("number"), multipleOfConstraint(3));

/** SP₄₁ — Compound Decidable Predicate: range ∧ multipleOf. */
export const SP41_COMPOUND: TypeTerm = refinement(
	base("number"),
	andPredicate(rangeConstraint(0, 100), multipleOfConstraint(5)),
);

/** SP₆₈ — String Concatenation Closure: concat(prefix, suffix). */
export const SP68_STRING_CONCAT: TypeTerm = templateLiteral([literal("user-"), base("string")]);

/** SP₆₉ — String Pattern Decomposition: concat with stringDecomposition annotation. */
export const SP69_STRING_DECOMPOSITION: TypeTerm = templateLiteral(
	[literal("prefix-"), base("string")],
	{ stringDecomposition: true },
);
