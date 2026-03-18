#!/usr/bin/env node

// @typecarta/cli — Command-line interface.
// Parse argv and dispatch to the appropriate subcommand handler.

const args = process.argv.slice(2);
const command = args[0];

/** Dispatch the CLI subcommand derived from argv. */
async function main(): Promise<void> {
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
		default:
			printUsage();
	}
}

/** Print the top-level usage message to stdout. */
function printUsage(): void {
	console.log(`
typecarta — Schema IR Expressiveness Toolkit

Usage:
  typecarta scorecard --adapter <name>
  typecarta compare --left <adapter> --right <adapter> [--output table|json]
  typecarta witness --criterion <pi-NN>
  typecarta profile --schema <file>
  typecarta check-encoding --source <adapter> --target <adapter>

Options:
  --help    Show this help message
`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
