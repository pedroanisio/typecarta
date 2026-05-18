# vendor/specs

Vendored canonical specifications for typecarta's tracked schema targets. The contents
of this directory are downloaded — not authored. Edit the source list at
`scripts/download-specs.py` and re-run the script; do not edit the cached
files by hand.

## Why this exists

Each implemented adapter under `packages/adapters/*` declares a `specVersion`
(e.g. `xsd 1.0`, `JSON Schema draft-07`, `Apache Avro 1.11`) and every
scorecard verdict is a claim about *that* spec. This directory may also include
target specs for adapters under assessment or development, such as SHACL and
LinkML. To make those claims auditable, the relevant spec bytes are pinned here
with a `_meta.json` recording the source URL, fetch timestamp, content-type,
byte count, and SHA-256.

## Layout

```
vendor/specs/
├── <adapter-key>/
│   ├── _meta.json        ← provenance (URL, SHA-256, fetched_at, …)
│   ├── <spec-file>       ← the bytes — HTML, .md, .json, etc.
│   └── _NO_SPEC.md       ← present iff no formal external spec exists
```

The three TypeScript-library adapters (`typescript`, `zod`, `effect-schema`)
have no formal spec separate from their source code; their directories
contain only `_NO_SPEC.md` + `_meta.json` explaining what the closest
authoritative reference would be.

## Maintenance

```bash
# Fetch anything missing (idempotent — skips files already present).
python3 scripts/download-specs.py

# Re-download everything from scratch.
python3 scripts/download-specs.py --force

# Verify on-disk SHA-256 matches what _meta.json recorded.
python3 scripts/download-specs.py --check

# Restrict to one or more adapters.
python3 scripts/download-specs.py --adapter xsd --adapter graphql
```

`--check` is appropriate to run in CI. It exits non-zero if any spec
file's bytes drifted from the recorded SHA — a signal that someone
hand-edited the cache or that a download was corrupted.

## What to do when a spec moves

If a canonical URL breaks (W3C reorganization, GitHub branch rename,
etc.), edit the entry in `SPECS` in `scripts/download-specs.py` and run
`python3 scripts/download-specs.py --force --adapter <key>`. Commit the
updated bytes + `_meta.json` together.
