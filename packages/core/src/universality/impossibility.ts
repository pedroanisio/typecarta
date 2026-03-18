// impossibility
// Provide decidability hazard checks for the impossibility boundary (Prop. 7.1).

import { collect } from "../ast/traversal.js";
import type { TypeTerm } from "../ast/type-term.js";

/**
 * Check whether a type term combines mu, complement, and forall nodes.
 *
 * @param term - The type term to inspect.
 * @returns An object indicating presence of each operator and whether the combination is hazardous.
 *
 * @remarks
 * Detects the decidability hazard from Section 7 Remark 7.1.2: combining
 * mu, negation, and universal quantification may render type equivalence undecidable.
 */
export function checkDecidabilityHazard(term: TypeTerm): {
	readonly hasMu: boolean;
	readonly hasComplement: boolean;
	readonly hasForall: boolean;
	readonly isHazardous: boolean;
	readonly warning?: string;
} {
	const hasMu = collect(term, (n) => n.kind === "mu").length > 0;
	const hasComplement = collect(term, (n) => n.kind === "complement").length > 0;
	const hasForall = collect(term, (n) => n.kind === "forall").length > 0;
	const isHazardous = hasMu && hasComplement && hasForall;

	return {
		hasMu,
		hasComplement,
		hasForall,
		isHazardous,
		...(isHazardous
			? {
					warning:
						"This type combines μ, ¬, and Λ. Type equivalence may be undecidable (§7 Remark 7.1.2).",
				}
			: {}),
	};
}
