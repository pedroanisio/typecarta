// witness — Look up and display a witness schema for a given criterion.

import { PI_IDS, type PiId, printTerm } from "@typecarta/core";
import { DIVERSE_SCHEMAS } from "@typecarta/witnesses";

/**
 * Execute the `typecarta witness` subcommand.
 *
 * @param args - CLI arguments after the subcommand name.
 * @returns Resolves when the witness has been printed to stdout.
 */
export async function run(args: string[]): Promise<void> {
	const criterionIdx = args.indexOf("--criterion");
	if (criterionIdx === -1 || !args[criterionIdx + 1]) {
		console.error("Usage: typecarta witness --criterion <pi-NN>");
		process.exit(1);
	}
	const criterionId = args[criterionIdx + 1] as PiId;

	if (!PI_IDS.includes(criterionId)) {
		console.error(`Unknown criterion: ${criterionId}. Valid: ${PI_IDS.join(", ")}`);
		process.exit(1);
	}

	const witness = DIVERSE_SCHEMAS.find((w) => w.id === criterionId);
	if (!witness) {
		console.error(`No witness found for ${criterionId}`);
		process.exit(1);
		return;
	}

	console.log(`${witness.name}`);
	console.log(`  ${printTerm(witness.schema)}`);
}
