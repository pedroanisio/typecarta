// adapters — List adapters currently registered in the CLI runtime.

import { getAllAdapters } from "@typecarta/core";
import { DEFAULT_ADAPTER_PACKAGES } from "../default-adapters.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

interface AdapterRow {
	readonly name: string;
	readonly source: "default" | "custom";
	readonly pkg: string;
}

function pad(s: string, width: number): string {
	return s + " ".repeat(Math.max(0, width - s.length));
}

function collectRows(): AdapterRow[] {
	return getAllAdapters().map((a) => {
		const pkg = DEFAULT_ADAPTER_PACKAGES.get(a.name);
		return pkg
			? { name: a.name, source: "default" as const, pkg }
			: { name: a.name, source: "custom" as const, pkg: "(externally registered)" };
	});
}

function renderTable(rows: readonly AdapterRow[]): string {
	const nameWidth = Math.max(4, ...rows.map((r) => r.name.length));
	const sourceWidth = 7;
	const pkgWidth = Math.max(7, ...rows.map((r) => r.pkg.length));

	const lines: string[] = [];
	lines.push(`${BOLD}Registered adapters${RESET}`);
	lines.push("");
	lines.push(
		`${DIM}${pad("Name", nameWidth)}  ${pad("Source", sourceWidth)}  ${pad("Package", pkgWidth)}${RESET}`,
	);
	lines.push(
		`${DIM}${"─".repeat(nameWidth)}  ${"─".repeat(sourceWidth)}  ${"─".repeat(pkgWidth)}${RESET}`,
	);
	for (const r of rows) {
		lines.push(`${pad(r.name, nameWidth)}  ${pad(r.source, sourceWidth)}  ${r.pkg}`);
	}
	lines.push("");
	lines.push(`${DIM}Pass the exact Name to --adapter (quote names that contain spaces).${RESET}`);
	return lines.join("\n");
}

function renderMarkdown(rows: readonly AdapterRow[]): string {
	const lines: string[] = [
		"# Registered adapters",
		"",
		"| Name | Source | Package |",
		"|---|---|---|",
	];
	for (const r of rows) {
		lines.push(`| \`${r.name}\` | ${r.source} | \`${r.pkg}\` |`);
	}
	return lines.join("\n");
}

function renderJSON(rows: readonly AdapterRow[]): string {
	return JSON.stringify(rows, null, 2);
}

/**
 * Execute the `typecarta adapters` subcommand.
 *
 * @param args - CLI arguments after the subcommand name.
 * @returns Resolves when the adapter list has been printed to stdout.
 */
export async function run(args: string[]): Promise<void> {
	const outputIdx = args.indexOf("--output");
	const format = outputIdx !== -1 ? args[outputIdx + 1] : "table";

	const rows = collectRows();

	switch (format) {
		case "json":
			console.log(renderJSON(rows));
			break;
		case "markdown":
			console.log(renderMarkdown(rows));
			break;
		default:
			console.log(renderTable(rows));
	}
}
