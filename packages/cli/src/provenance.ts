// provenance — Capture typecarta version + commit hash for scorecard reports.
//
// Lives in the CLI (not core) so that @typecarta/core stays pure and free of
// node:fs / node:child_process imports. Library consumers who need provenance
// pass explicit values to `createProvenance` from @typecarta/core.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	createProvenance,
	type IRAdapter,
	type ScorecardProvenance,
} from "@typecarta/core";

const HERE = dirname(fileURLToPath(import.meta.url));

let cachedVersion: string | undefined;
let cachedCommit: string | undefined;

/**
 * Read the typecarta CLI version from its own package.json.
 *
 * Falls back to "unknown" if the file cannot be read. The package.json sits
 * one level above the compiled dist/ directory.
 */
function readVersion(): string {
	if (cachedVersion !== undefined) return cachedVersion;
	try {
		const pkgPath = join(HERE, "..", "package.json");
		const raw = readFileSync(pkgPath, "utf8");
		const pkg = JSON.parse(raw) as { version?: unknown };
		cachedVersion = typeof pkg.version === "string" ? pkg.version : "unknown";
	} catch {
		cachedVersion = "unknown";
	}
	return cachedVersion;
}

/**
 * Read the current git short hash, marking dirty trees with a `-dirty` suffix.
 *
 * `$TYPECARTA_COMMIT_HASH` takes precedence so CI builds can inject the SHA
 * even when git is unavailable. Falls back to "unknown" if neither source
 * resolves.
 */
function readCommitHash(): string {
	if (cachedCommit !== undefined) return cachedCommit;
	const fromEnv = process.env.TYPECARTA_COMMIT_HASH;
	if (fromEnv && fromEnv.length > 0) {
		cachedCommit = fromEnv;
		return cachedCommit;
	}
	try {
		const hash = execSync("git rev-parse --short HEAD", {
			cwd: HERE,
			stdio: ["ignore", "pipe", "ignore"],
		})
			.toString()
			.trim();
		if (hash.length === 0) {
			cachedCommit = "unknown";
			return cachedCommit;
		}
		try {
			const dirty = execSync("git status --porcelain", {
				cwd: HERE,
				stdio: ["ignore", "pipe", "ignore"],
			})
				.toString()
				.trim();
			cachedCommit = dirty.length > 0 ? `${hash}-dirty` : hash;
		} catch {
			cachedCommit = hash;
		}
	} catch {
		cachedCommit = "unknown";
	}
	return cachedCommit;
}

/**
 * Build a {@link ScorecardProvenance} record for the current CLI invocation,
 * pulling the adapter's target spec version from the adapter itself.
 *
 * Pass the adapter that produced the scorecard so the resulting provenance
 * names the exact spec (e.g. XSD 1.0 vs. 1.1) the verdicts are claims about.
 */
export function captureProvenance(adapter: IRAdapter): ScorecardProvenance {
	return createProvenance({
		typecartaVersion: readVersion(),
		adapterSpecVersion: adapter.specVersion,
		commitHash: readCommitHash(),
	});
}
