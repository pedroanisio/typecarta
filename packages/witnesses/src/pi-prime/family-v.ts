// family-v
// Define Family V witness (π'₇₀) covering temporal and stateful types.
import { base, extension, field, literal, product } from "@typecarta/core";
import type { TypeTerm } from "@typecarta/core";

/** SP₇₀ — State-Machine Type: extension representing a state machine. */
export const SP70_STATE_MACHINE: TypeTerm = extension(
	"state-machine",
	{
		states: ["idle", "loading", "success", "error"],
		transitions: [
			{ from: "idle", to: "loading", event: "fetch" },
			{ from: "loading", to: "success", event: "resolve" },
			{ from: "loading", to: "error", event: "reject" },
		],
	},
	[product([field("state", literal("idle")), field("data", base("null"))])],
);
