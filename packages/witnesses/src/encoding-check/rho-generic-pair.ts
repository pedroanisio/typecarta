// rho-generic-pair
// Define the generic-instantiation encoding-check pair (ρ-generic).
// Two instantiations of the same generic shape verify parametric encoding fidelity.
import { base, field, forall, product, typeVar } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** Generic container: Λα.{value: α, label: string}. */
export const RHO_GENERIC_TEMPLATE: TypeTerm = forall(
	"alpha",
	product([field("value", typeVar("alpha")), field("label", base("string"))]),
);

/** Instantiation A: Container<number> — concrete product with number value. */
export const RHO_GENERIC_INST_A: TypeTerm = product([
	field("value", base("number")),
	field("label", base("string")),
]);

/** Instantiation B: Container<string> — concrete product with string value. */
export const RHO_GENERIC_INST_B: TypeTerm = product([
	field("value", base("string")),
	field("label", base("string")),
]);

/** Generic encoding-check pair: [instantiation A, instantiation B]. */
export const RHO_GENERIC_PAIR: readonly [TypeTerm, TypeTerm] = [
	RHO_GENERIC_INST_A,
	RHO_GENERIC_INST_B,
];
