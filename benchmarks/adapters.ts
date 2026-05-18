/**
 * Canonical list of adapters benchmarks iterate over.
 *
 * Pair this list with the @typecarta/cli `DEFAULT_ADAPTERS` registry but
 * keep it duplicated locally — benchmarks must not depend on the CLI
 * package (the dependency direction is benchmarks→adapters, not
 * benchmarks→cli→adapters).
 *
 * To add a new adapter to the benchmark sweep:
 *   1. Add a workspace dependency in `benchmarks/package.json`.
 *   2. Append an entry below.
 */

import { AvroAdapter } from "@typecarta/adapter-avro";
import { EffectSchemaAdapter } from "@typecarta/adapter-effect-schema";
import { GraphQLAdapter } from "@typecarta/adapter-graphql";
import { JsonSchemaAdapter } from "@typecarta/adapter-json-schema";
import { ProtobufAdapter } from "@typecarta/adapter-protobuf";
import { ShaclAdapter } from "@typecarta/adapter-shacl";
import { TypeScriptAdapter } from "@typecarta/adapter-typescript";
import { XsdAdapter } from "@typecarta/adapter-xsd";
import { XsdAdapter as Xsd11Adapter } from "@typecarta/adapter-xsd-1-1";
import { ZodAdapter } from "@typecarta/adapter-zod";
import type { IRAdapter } from "@typecarta/core";

/**
 * Build a fresh instance of each adapter. Benchmarks call this so each
 * iteration starts from a clean state — adapters that maintain caches or
 * have stateful registries don't share between sweeps.
 */
export function buildAllAdapters(): readonly IRAdapter[] {
	return [
		new XsdAdapter(),
		new Xsd11Adapter(),
		new ZodAdapter(),
		new JsonSchemaAdapter(),
		new TypeScriptAdapter(),
		new ProtobufAdapter(),
		new GraphQLAdapter(),
		new EffectSchemaAdapter(),
		new AvroAdapter(),
		new ShaclAdapter(),
	];
}
