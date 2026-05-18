// capabilities — Export TypeCarta's self-capability evidence.

import { SELF_CAPABILITIES } from "@typecarta/core";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

interface CapabilityDocument {
	readonly subject: "typecarta-self";
	readonly schemaVersion: "0.1.0";
	readonly capabilities: typeof SELF_CAPABILITIES;
}

function pad(s: string, width: number): string {
	return s + " ".repeat(Math.max(0, width - s.length));
}

function parseFormat(args: readonly string[]): string {
	const formatIdx = args.indexOf("--format");
	if (formatIdx !== -1) return args[formatIdx + 1] ?? "table";

	const outputIdx = args.indexOf("--output");
	if (outputIdx !== -1) return args[outputIdx + 1] ?? "table";

	return "table";
}

function createDocument(): CapabilityDocument {
	return {
		subject: "typecarta-self",
		schemaVersion: "0.1.0",
		capabilities: SELF_CAPABILITIES,
	};
}

function renderJSON(document: CapabilityDocument): string {
	return JSON.stringify(document, null, 2);
}

function renderTable(document: CapabilityDocument): string {
	const rows = document.capabilities;
	const idWidth = Math.max("Criterion".length, ...rows.map((r) => r.criterionId.length));
	const supportWidth = Math.max("Support".length, ...rows.map((r) => r.support.length));
	const witnessWidth = Math.max("Witness".length, ...rows.map((r) => r.witnessKind.length));

	const lines: string[] = [];
	lines.push(`${BOLD}TypeCarta self capabilities${RESET}`);
	lines.push("");
	lines.push(
		`${DIM}${pad("Criterion", idWidth)}  ${pad("Support", supportWidth)}  ${pad("Witness", witnessWidth)}  Mechanism${RESET}`,
	);
	lines.push(
		`${DIM}${"─".repeat(idWidth)}  ${"─".repeat(supportWidth)}  ${"─".repeat(witnessWidth)}  ${"─".repeat("Mechanism".length)}${RESET}`,
	);
	for (const row of rows) {
		lines.push(
			`${pad(row.criterionId, idWidth)}  ${pad(row.support, supportWidth)}  ${pad(row.witnessKind, witnessWidth)}  ${row.mechanism}`,
		);
	}
	lines.push("");
	lines.push(`${DIM}Use --format json for machine-readable output.${RESET}`);
	return lines.join("\n");
}

/**
 * Execute the `typecarta capabilities` subcommand.
 *
 * @param args - CLI arguments after the subcommand name.
 * @returns Resolves when the capability export has been printed to stdout.
 */
export async function run(args: string[]): Promise<void> {
	const format = parseFormat(args);
	const document = createDocument();

	switch (format) {
		case "json":
			console.log(renderJSON(document));
			break;
		case "table":
			console.log(renderTable(document));
			break;
		default:
			console.error('Invalid --format value. Use "table" or "json".');
			process.exit(1);
	}
}
