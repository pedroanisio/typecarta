// Terminal output formatter — render scorecards as colored table output.

import type { CellValue, ScorecardComparison, ScorecardResult } from "@typecarta/core";
import { PI_CRITERIA } from "@typecarta/core";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function colorize(value: CellValue): string {
	switch (value) {
		case "✓":
			return `${GREEN}✓${RESET}`;
		case "partial":
			return `${YELLOW}◐${RESET}`;
		case "✗":
			return `${RED}✗${RESET}`;
	}
}

function pad(str: string, width: number): string {
	return str + " ".repeat(Math.max(0, width - stripAnsi(str).length));
}

function stripAnsi(str: string): string {
	return str.replace(/\x1b\[\d+m/g, "");
}

/**
 * Render a scorecard as a colored terminal table.
 *
 * @param result - Scorecard evaluation result to render.
 * @returns A formatted string with ANSI color codes.
 */
export function renderTerminal(result: ScorecardResult): string {
	const lines: string[] = [];
	const idWidth = 7;
	const nameWidth = 24;
	const resultWidth = 8;

	lines.push(`${BOLD}Scorecard: ${result.adapterName}${RESET}`);
	lines.push("");
	lines.push(
		`${DIM}${pad("#", idWidth)} ${pad("Criterion", nameWidth)} ${pad("Result", resultWidth)} Justification${RESET}`,
	);
	lines.push(
		`${DIM}${"─".repeat(idWidth)} ${"─".repeat(nameWidth)} ${"─".repeat(resultWidth)} ${"─".repeat(30)}${RESET}`,
	);

	for (const criterion of PI_CRITERIA) {
		const cell = result.cells.get(criterion.id);
		const value = cell?.value ?? "✗";
		const justification = cell?.justification ?? "";
		lines.push(
			`${pad(criterion.id, idWidth)} ${pad(criterion.name, nameWidth)} ${pad(colorize(value), resultWidth + 9)} ${DIM}${justification}${RESET}`,
		);
	}

	lines.push("");
	lines.push(
		`${BOLD}Totals:${RESET} ${GREEN}✓ ${result.totals.satisfied}${RESET} ${DIM}|${RESET} ${YELLOW}◐ ${result.totals.partial}${RESET} ${DIM}|${RESET} ${RED}✗ ${result.totals.notSatisfied}${RESET}`,
	);

	return lines.join("\n");
}

/**
 * Render a scorecard comparison as a colored terminal table.
 *
 * @param comparison - Side-by-side scorecard comparison to render.
 * @returns A formatted string with ANSI color codes.
 */
export function renderTerminalComparison(comparison: ScorecardComparison): string {
	const lines: string[] = [];
	const idWidth = 7;
	const nameWidth = 24;
	const colWidth = 10;

	const leftName = comparison.left.adapterName;
	const rightName = comparison.right.adapterName;

	lines.push(`${BOLD}Comparison: ${leftName} vs ${rightName}${RESET}`);
	lines.push("");
	lines.push(
		`${DIM}${pad("#", idWidth)} ${pad("Criterion", nameWidth)} ${pad(leftName, colWidth)} ${pad(rightName, colWidth)}${RESET}`,
	);
	lines.push(
		`${DIM}${"─".repeat(idWidth)} ${"─".repeat(nameWidth)} ${"─".repeat(colWidth)} ${"─".repeat(colWidth)}${RESET}`,
	);

	for (const criterion of PI_CRITERIA) {
		const leftCell = comparison.left.cells.get(criterion.id);
		const rightCell = comparison.right.cells.get(criterion.id);
		const leftVal = leftCell?.value ?? "✗";
		const rightVal = rightCell?.value ?? "✗";
		lines.push(
			`${pad(criterion.id, idWidth)} ${pad(criterion.name, nameWidth)} ${pad(colorize(leftVal), colWidth + 9)} ${pad(colorize(rightVal), colWidth + 9)}`,
		);
	}

	lines.push("");
	if (comparison.differences.length > 0) {
		lines.push(`${BOLD}${comparison.differences.length} difference(s) found.${RESET}`);
	} else {
		lines.push(`${GREEN}No differences.${RESET}`);
	}

	return lines.join("\n");
}
