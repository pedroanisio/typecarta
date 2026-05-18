// witness — Look up and display a witness schema for a given criterion.

import { CRITERION_IDS, type CriterionId, printTerm } from "@typecarta/core";
import { ALL_WITNESSES } from "@typecarta/witnesses";

/**
 * Execute the `typecarta witness` subcommand.
 *
 * @param args - CLI arguments after the subcommand name.
 * @returns Resolves when the witness has been printed to stdout.
 */
export async function run(args: string[]): Promise<void> {
	const criterionIdx = args.indexOf("--criterion");
	if (criterionIdx === -1 || !args[criterionIdx + 1]) {
		console.error("Usage: typecarta witness --criterion <pi-prime-NN>");
		process.exit(1);
	}
	const criterionId = args[criterionIdx + 1] as CriterionId;

	if (!CRITERION_IDS.includes(criterionId)) {
		console.error(
			`Unknown criterion: ${criterionId}. Use one of pi-prime-01 .. pi-prime-70.`,
		);
		process.exit(1);
	}

	const witness = ALL_WITNESSES.find((w) => w.id === criterionId);
	if (!witness) {
		console.error(`No witness found for ${criterionId}`);
		process.exit(1);
		return;
	}

	console.log(`${witness.name}`);
	console.log(`  ${printTerm(witness.schema)}`);
}
