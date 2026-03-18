// check-encoding — Evaluate encoding-check properties between adapter pairs.

import {
	type Encoding,
	type EncodingCheckWitnessPair,
	type IRAdapter,
	apply,
	array,
	base,
	createEncoding,
	createEvaluator,
	field,
	forall,
	getAdapter,
	product,
	runEncodingChecks,
	typeVar,
} from "@typecarta/core";

/** Build the default witness pairs for width, depth, and generic encoding checks. */
function getDefaultPairs(): EncodingCheckWitnessPair[] {
	// Width: { name: string } ≤ { name: string, age: number }
	const narrow = product([field("name", base("string"))]);
	const wide = product([field("name", base("string")), field("age", base("number"))]);

	// Depth: Array<Array<string>> vs Array<string>
	const shallow = array(base("string"));
	const deep = array(array(base("string")));

	// Generic: List<string> vs List<number>
	const inst1 = apply("array", [base("string")]);
	const inst2 = apply("array", [base("number")]);

	return [
		{ property: "rho-width", subtype: wide, supertype: narrow },
		{ property: "rho-depth", subtype: deep, supertype: shallow },
		{ property: "rho-generic", subtype: inst1, supertype: inst2 },
	];
}

/**
 * Execute the `typecarta check-encoding` subcommand.
 *
 * @param args - CLI arguments after the subcommand name.
 * @returns Resolves when results have been printed to stdout.
 */
export async function run(args: string[]): Promise<void> {
	const sourceIdx = args.indexOf("--source");
	const targetIdx = args.indexOf("--target");
	const outputIdx = args.indexOf("--output");
	const format = outputIdx !== -1 ? args[outputIdx + 1] : "table";

	if (sourceIdx === -1 || targetIdx === -1 || !args[sourceIdx + 1] || !args[targetIdx + 1]) {
		console.error(
			"Usage: typecarta check-encoding --source <adapter> --target <adapter> [--output table|json]",
		);
		process.exit(1);
	}

	const sourceAdapter = getAdapter(args[sourceIdx + 1]!) as IRAdapter | undefined;
	const targetAdapter = getAdapter(args[targetIdx + 1]!) as IRAdapter | undefined;

	if (!sourceAdapter || !targetAdapter) {
		console.error("One or both adapters not found.");
		process.exit(1);
		return;
	}

	// Create encoding: source → target
	const encoding: Encoding = createEncoding((term) => {
		try {
			const native = sourceAdapter.encode(term);
			// Re-parse through target
			return targetAdapter.parse(native as never);
		} catch {
			return term; // fallback: identity
		}
	});

	const evaluator = createEvaluator((value, term) => targetAdapter.inhabits(value, term));
	const testValues = [
		null,
		true,
		false,
		0,
		1,
		-1,
		42,
		3.14,
		"",
		"hello",
		"test",
		[],
		[1, 2],
		{},
		{ name: "x" },
	];

	const pairs = getDefaultPairs();
	const suite = runEncodingChecks(pairs, encoding, evaluator, testValues);

	if (format === "json") {
		console.log(
			JSON.stringify(
				{
					source: sourceAdapter.name,
					target: targetAdapter.name,
					results: suite.results.map((r) => ({
						property: r.property,
						holds: r.holds,
						reason: r.reason ?? null,
					})),
					allPassed: suite.allPassed,
				},
				null,
				2,
			),
		);
	} else {
		console.log(`Encoding Check: ${sourceAdapter.name} → ${targetAdapter.name}\n`);
		console.log("| Property    | Holds | Reason |");
		console.log("|-------------|:-----:|--------|");
		for (const r of suite.results) {
			console.log(
				`| ${r.property.padEnd(11)} | ${r.holds ? "  ✓  " : "  ✗  "} | ${r.reason ?? ""} |`,
			);
		}
		console.log(
			`\n${suite.allPassed ? "All checks passed." : `${suite.results.filter((r) => !r.holds).length} check(s) failed.`}`,
		);
	}
}
