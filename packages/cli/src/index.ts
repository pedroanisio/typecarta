#!/usr/bin/env node

// @typecarta/cli — Command-line interface.
// Parse argv and dispatch to the appropriate subcommand handler.

import { registerDefaultAdapters } from "./default-adapters.js";

const args = process.argv.slice(2);
const command = args[0];

/** Dispatch the CLI subcommand derived from argv. */
async function main(): Promise<void> {
	registerDefaultAdapters();

	switch (command) {
		case "scorecard":
			await import("./commands/scorecard.js").then((m) => m.run(args.slice(1)));
			break;
		case "compare":
			await import("./commands/compare.js").then((m) => m.run(args.slice(1)));
			break;
		case "witness":
			await import("./commands/witness.js").then((m) => m.run(args.slice(1)));
			break;
		case "profile":
			await import("./commands/profile.js").then((m) => m.run(args.slice(1)));
			break;
		case "check-encoding":
			await import("./commands/check-encoding.js").then((m) => m.run(args.slice(1)));
			break;
		case "adapters":
			await import("./commands/adapters.js").then((m) => m.run(args.slice(1)));
			break;
		case "capabilities":
			await import("./commands/capabilities.js").then((m) => m.run(args.slice(1)));
			break;
		default:
			printUsage();
	}
}

/** Print the top-level usage message to stdout. */
function printUsage(): void {
	console.log(`
typecarta — Schema IR Expressiveness Toolkit

Usage:
  typecarta adapters [--output table|markdown|json]
  typecarta scorecard --adapter <name> [--filter core|all] [--output table|markdown|json]
  typecarta compare --left <adapter> --right <adapter> [--output table|json]
  typecarta witness --criterion <pi-prime-NN>
  typecarta profile --schema <file> [--adapter <name>]
  typecarta check-encoding --source <adapter> --target <adapter>
  typecarta capabilities [--format table|json]

Tip:
  Run \`typecarta adapters\` to see registered adapter names.
  Run \`typecarta capabilities --format json\` to export TypeCarta self-capability evidence.
  --filter core (15 criteria) is the default; --filter all evaluates all 70.
  --mode is a legacy alias: --mode core/full == --filter core/all.

Options:
  --help    Show this help message
`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
