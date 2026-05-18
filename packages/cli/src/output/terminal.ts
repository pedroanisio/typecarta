// Terminal output formatter — render scorecards as colored, family-grouped tables.

import type { CellValue, ScorecardComparison, ScorecardResult } from "@typecarta/core";
import { PI_CRITERIA, PI_PRIME_CRITERIA } from "@typecarta/core";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

interface CriterionMeta {
	readonly id: string;
	readonly name: string;
	readonly family?: string;
}

const CRITERIA_BY_ID: ReadonlyMap<string, CriterionMeta> = new Map([
	...PI_CRITERIA.map((c) => [c.id, { id: c.id, name: c.name }] as const),
	...PI_PRIME_CRITERIA.map(
		(c) => [c.id, { id: c.id, name: c.name, family: c.family }] as const,
	),
]);

const FAMILY_TITLES: ReadonlyMap<string, string> = new Map([
	["A", "Cardinality and Base-Set Structure"],
	["B", "Products, Records, and Tuples"],
	["C", "Field Modality"],
	["D", "Shape Closure"],
	["E", "Sum and Union Structure"],
	["F", "Intersection"],
	["G", "Recursion"],
	["H", "Parametricity & HKT"],
	["I", "Nominal & Branding"],
	["J", "Refinement & Predicates"],
	["K", "Value Dependency"],
	["L", "Collection Types"],
	["M", "Computation Types"],
	["N", "Modularity & Scoping"],
	["O", "Evolution & Compatibility"],
	["P", "Meta-Annotation"],
	["Q", "Type-Level Negation"],
	["R", "Unsound / Bivariant"],
	["S", "Phantom & Indexed"],
	["T", "Type-Level Computation"],
	["U", "Row Polymorphism"],
	["V", "Temporal / Stateful"],
]);

const CORE_GROUP_LABEL = "Π core (15 criteria)";

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

function stripAnsi(str: string): string {
	return str.replace(/\x1b\[\d+m/g, "");
}

function pad(str: string, width: number): string {
	return str + " ".repeat(Math.max(0, width - stripAnsi(str).length));
}

interface Row {
	readonly id: string;
	readonly name: string;
	readonly value: CellValue;
	readonly justification: string;
	readonly group: string;
}

function buildRows(result: ScorecardResult): readonly Row[] {
	const rows: Row[] = [];
	for (const [id, cell] of result.cells) {
		const meta = CRITERIA_BY_ID.get(id);
		const family = meta?.family;
		const group = family
			? `Family ${family} · ${FAMILY_TITLES.get(family) ?? ""}`.trimEnd()
			: CORE_GROUP_LABEL;
		rows.push({
			id,
			name: meta?.name ?? "",
			value: cell.value,
			justification: cell.justification ?? "",
			group,
		});
	}
	return rows;
}

function groupBy(rows: readonly Row[]): ReadonlyMap<string, readonly Row[]> {
	const groups = new Map<string, Row[]>();
	for (const row of rows) {
		const bucket = groups.get(row.group);
		if (bucket) bucket.push(row);
		else groups.set(row.group, [row]);
	}
	return groups;
}

function progressBar(satisfied: number, partial: number, missing: number, width = 30): string {
	const total = satisfied + partial + missing;
	if (total === 0) return "";
	const sCount = Math.round((satisfied / total) * width);
	const pCount = Math.round((partial / total) * width);
	const mCount = Math.max(0, width - sCount - pCount);
	return (
		`${GREEN}${"✓".repeat(sCount)}${RESET}` +
		`${YELLOW}${"◐".repeat(pCount)}${RESET}` +
		`${RED}${"✗".repeat(mCount)}${RESET}`
	);
}

function percent(numerator: number, total: number): string {
	if (total === 0) return "0%";
	return `${Math.round((numerator / total) * 100)}%`;
}

function renderSummary(result: ScorecardResult, modeLabel: string): string[] {
	const { satisfied, partial, notSatisfied } = result.totals;
	const total = satisfied + partial + notSatisfied;
	const lines: string[] = [];
	lines.push(`${BOLD}Scorecard: ${result.adapterName}${RESET}   ${DIM}[${modeLabel} · ${total} criteria]${RESET}`);
	lines.push("");
	lines.push(`  ${DIM}Coverage${RESET}   ${progressBar(satisfied, partial, notSatisfied)}`);
	lines.push(
		`  ${BOLD}Totals:${RESET}   ${GREEN}✓ ${satisfied}${RESET}  ${YELLOW}◐ ${partial}${RESET}  ${RED}✗ ${notSatisfied}${RESET}` +
			`   ${DIM}→  ${percent(satisfied, total)} satisfied · ${percent(partial, total)} partial · ${percent(notSatisfied, total)} missing${RESET}`,
	);
	return lines;
}

function tallyGroup(group: readonly Row[]): {
	readonly satisfied: number;
	readonly partial: number;
	readonly missing: number;
} {
	let satisfied = 0;
	let partial = 0;
	let missing = 0;
	for (const row of group) {
		if (row.value === "✓") satisfied++;
		else if (row.value === "partial") partial++;
		else missing++;
	}
	return { satisfied, partial, missing };
}

function renderGroup(title: string, rows: readonly Row[], idWidth: number, nameWidth: number): string[] {
	const lines: string[] = [];
	const tally = tallyGroup(rows);
	const tallyStr = `${tally.satisfied}/${tally.partial}/${tally.missing}`;
	const header = `── ${title} `;
	const filler = "─".repeat(Math.max(2, 70 - header.length - tallyStr.length - 2));
	lines.push("");
	lines.push(`${DIM}${header}${filler}  ${tallyStr}${RESET}`);
	for (const row of rows) {
		lines.push(
			`  ${pad(row.id, idWidth)}  ${pad(row.name, nameWidth)}  ${colorize(row.value)}  ${DIM}${row.justification}${RESET}`,
		);
	}
	return lines;
}

/**
 * Render a scorecard as a colored, family-grouped terminal report.
 *
 * @param result - Scorecard evaluation result to render.
 * @returns A formatted string with ANSI color codes.
 */
export function renderTerminal(result: ScorecardResult): string {
	const rows = buildRows(result);
	const total = result.totals.satisfied + result.totals.partial + result.totals.notSatisfied;
	const modeLabel = total > 15 ? "full mode" : "core mode";

	const idWidth = Math.max(2, ...rows.map((r) => r.id.length));
	const nameWidth = Math.max(4, ...rows.map((r) => r.name.length));

	const lines: string[] = [];
	lines.push(...renderSummary(result, modeLabel));

	const groups = groupBy(rows);
	for (const [title, groupRows] of groups) {
		lines.push(...renderGroup(title, groupRows, idWidth, nameWidth));
	}

	lines.push("");
	lines.push(`${DIM}Legend: ✓ satisfied · ◐ partial · ✗ missing · totals shown per group as ✓/◐/✗${RESET}`);
	return lines.join("\n");
}

/**
 * Render a scorecard comparison as a colored terminal table.
 *
 * @param comparison - Side-by-side scorecard comparison to render.
 * @returns A formatted string with ANSI color codes.
 */
export function renderTerminalComparison(comparison: ScorecardComparison): string {
	const leftName = comparison.left.adapterName;
	const rightName = comparison.right.adapterName;

	const ids = [...new Set([...comparison.left.cells.keys(), ...comparison.right.cells.keys()])];
	const idWidth = Math.max(2, ...ids.map((id) => id.length));
	const nameWidth = Math.max(
		4,
		...ids.map((id) => (CRITERIA_BY_ID.get(id)?.name ?? "").length),
	);
	const colWidth = Math.max(leftName.length, rightName.length, 6);

	const lines: string[] = [];
	lines.push(`${BOLD}Comparison:${RESET} ${leftName}  ${DIM}vs${RESET}  ${rightName}`);
	lines.push("");
	lines.push(
		`${DIM}${pad("#", idWidth)}  ${pad("Criterion", nameWidth)}  ${pad(leftName, colWidth)}  ${pad(rightName, colWidth)}${RESET}`,
	);
	lines.push(
		`${DIM}${"─".repeat(idWidth)}  ${"─".repeat(nameWidth)}  ${"─".repeat(colWidth)}  ${"─".repeat(colWidth)}${RESET}`,
	);

	for (const id of ids) {
		const name = CRITERIA_BY_ID.get(id)?.name ?? "";
		const leftVal = comparison.left.cells.get(id)?.value ?? "✗";
		const rightVal = comparison.right.cells.get(id)?.value ?? "✗";
		lines.push(
			`${pad(id, idWidth)}  ${pad(name, nameWidth)}  ${pad(colorize(leftVal), colWidth + 9)}  ${pad(colorize(rightVal), colWidth + 9)}`,
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
