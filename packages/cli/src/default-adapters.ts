// Default adapter registration for the CLI.
//
// Keep this list intentionally explicit: adding a dependency here makes the
// adapter available by name to CLI commands without requiring user-side setup.

import { AvroAdapter } from "@typecarta/adapter-avro";
import { EffectSchemaAdapter } from "@typecarta/adapter-effect-schema";
import { GraphQLAdapter } from "@typecarta/adapter-graphql";
import { JsonSchemaAdapter } from "@typecarta/adapter-json-schema";
import { ProtobufAdapter } from "@typecarta/adapter-protobuf";
import { TypeScriptAdapter } from "@typecarta/adapter-typescript";
import { XsdAdapter } from "@typecarta/adapter-xsd";
import { ZodAdapter } from "@typecarta/adapter-zod";
import { type IRAdapter, getAdapter, registerAdapter } from "@typecarta/core";

/** Adapter instances bundled with the CLI, registered on startup. */
export const DEFAULT_ADAPTERS: readonly IRAdapter[] = [
	new XsdAdapter(),
	new ZodAdapter(),
	new JsonSchemaAdapter(),
	new TypeScriptAdapter(),
	new ProtobufAdapter(),
	new GraphQLAdapter(),
	new EffectSchemaAdapter(),
	new AvroAdapter(),
] as const;

/** Map adapter name to the npm package that provides it. */
export const DEFAULT_ADAPTER_PACKAGES: ReadonlyMap<string, string> = new Map([
	["xsd", "@typecarta/adapter-xsd"],
	["Zod", "@typecarta/adapter-zod"],
	["JSON Schema draft-07", "@typecarta/adapter-json-schema"],
	["TypeScript", "@typecarta/adapter-typescript"],
	["Protocol Buffers", "@typecarta/adapter-protobuf"],
	["GraphQL", "@typecarta/adapter-graphql"],
	["Effect Schema", "@typecarta/adapter-effect-schema"],
	["Apache Avro", "@typecarta/adapter-avro"],
]);

/** Register all adapters that ship as CLI defaults. */
export function registerDefaultAdapters(): void {
	for (const adapter of DEFAULT_ADAPTERS) {
		if (!getAdapter(adapter.name)) {
			registerAdapter(adapter);
		}
	}
}
