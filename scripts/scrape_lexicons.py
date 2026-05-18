#!/usr/bin/env python3
"""
scrape_lexicons.py — v2
=======================

Scrape the authoritative syntactic lexicons of several schema / type
languages from their canonical sources, and emit a single JSON document
plus a JSON Schema 2020-12 describing its shape.

Covered languages
-----------------
- JSON Schema 2020-12 (8 vocabulary meta-schemas)
- XSD 1.1 (Part 1 + Part 2 schema-for-schemas + Part 2 HTML prose)
- SHACL (Core Turtle ontology + Compact Syntax ANTLR grammar)
- JSON-LD 1.1 (§1.7 Syntax Tokens and Keywords)
- TypeScript (tree-sitter-typescript node-types + lib.es5.d.ts intrinsics)
- Zod v3 (single-file public .d.ts distribution)
- Zod v4 (multi-file public .d.ts distribution)

Changes vs. v1 (from peer review against `universal_extractor.py`)
-----------------------------------------------------------------
1. SHA-256 + byte-length recorded for every fetched source. The output's
   `metadata.source_provenance` is independently reproducible — if a
   remote source's bytes change, a downstream consumer can detect drift
   from the recorded hash.

2. Output JSON Schema 2020-12 is emitted as a sibling file
   (`lexicons.schema.json`) and the payload is validated against it
   before writing. If `jsonschema` is not installed, validation is
   skipped with a warning, but the schema is still emitted.

3. HTML parsing migrated from regex-on-raw-bytes to lxml structural
   selection where it cleanly applies (XSD 1.1 Part 2 datatype headings,
   SHACL Compact Syntax `<pre>` grammar block). For the EBNF-production
   extraction the regex is retained, but applied to the lxml-normalised
   serialisation rather than raw bytes — gaining lxml's tag-soup
   recovery without changing the proven boundary terminators.

4. Authority labels refined. `tree-sitter-typescript` is labelled
   explicitly as a community grammar that answers a slightly different
   question than the TypeScript compiler's `SyntaxKind` enum would; the
   two surfaces can disagree.

What is deliberately NOT changed
--------------------------------
The per-source extractor architecture. The previous review explored
collapsing every source into a fixed extractor vocabulary; both
independent reviews agreed the per-source format heterogeneity (XSD,
Turtle, ANTLR, .d.ts, HTML prose) is irreducible. Each extractor stays
hand-written and explicit. The `_spec_cache/` directory still exists;
the SHA-256 provenance complements caching, it does not replace it.

Usage
-----
    python scrape_lexicons.py
    python scrape_lexicons.py --out lexicons.json --schema-out lexicons.schema.json
    python scrape_lexicons.py --no-validate            # skip self-validation
    python scrape_lexicons.py --cache-dir /tmp/cache   # use a different cache

Disclaimer
----------
Entries are scraped from authoritative sources. Authority varies per
source (W3C Recommendation vs. Community Group draft vs. reference
implementation). Per-source authority is recorded in the output's
metadata; consumers should weight accordingly. This document records
the lexicon of each language — no cross-language mapping is asserted.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import lxml.html  # type: ignore
    _HAS_LXML = True
except ImportError:
    _HAS_LXML = False

try:
    import yaml  # type: ignore  # PyYAML
    _HAS_YAML = True
except ImportError:
    _HAS_YAML = False

try:
    from jsonschema import Draft202012Validator  # type: ignore
    _HAS_JSONSCHEMA = True
except ImportError:
    _HAS_JSONSCHEMA = False


# =========================================================================== #
# Authoritative source URLs                                                   #
# =========================================================================== #

JSON_SCHEMA_DIALECT_URL = "https://json-schema.org/draft/2020-12/schema"
JSON_SCHEMA_VOCABULARIES: dict[str, str] = {
    "core":              "https://json-schema.org/draft/2020-12/meta/core",
    "applicator":        "https://json-schema.org/draft/2020-12/meta/applicator",
    "validation":        "https://json-schema.org/draft/2020-12/meta/validation",
    "meta-data":         "https://json-schema.org/draft/2020-12/meta/meta-data",
    "format-annotation": "https://json-schema.org/draft/2020-12/meta/format-annotation",
    "format-assertion":  "https://json-schema.org/draft/2020-12/meta/format-assertion",
    "content":           "https://json-schema.org/draft/2020-12/meta/content",
    "unevaluated":       "https://json-schema.org/draft/2020-12/meta/unevaluated",
}

XSD_PART1_XSD_URL   = "https://www.w3.org/TR/xmlschema11-1/XMLSchema.xsd"
XSD_PART2_XSD_URL   = "https://www.w3.org/TR/xmlschema11-2/datatypes.xsd"
XSD_PART2_HTML_URL  = "https://www.w3.org/TR/xmlschema11-2/"

# SHACL Core ontology lives at a stable W3C namespace URI (the REC's normative
# namespace). The 2017 Recommendation's vocabulary is what this URL serves.
SHACL_VOCAB_TTL_URL      = "https://www.w3.org/ns/shacl.ttl"

# SHACL Compact Syntax is a W3C Community Group draft with no version tag.
# Pin to a specific commit SHA from w3c/shacl so the scraped grammar is
# reproducible across runs.
SHACL_COMPACT_SYNTAX_COMMIT = "e28389980cab29f0bb63f83a4037a6cbef52e3ba"  # 2025-01-27
SHACL_COMPACT_SYNTAX_URL = (
    f"https://raw.githubusercontent.com/w3c/shacl/"
    f"{SHACL_COMPACT_SYNTAX_COMMIT}/shacl-compact-syntax/index.html"
)

JSON_LD_1_1_HTML_URL = "https://www.w3.org/TR/json-ld11/"

# Pinned: tree-sitter-typescript v0.23.2 (latest tagged release).
TYPESCRIPT_TREE_SITTER_VERSION = "v0.23.2"
TYPESCRIPT_TREE_SITTER_NODE_TYPES_URL = (
    f"https://raw.githubusercontent.com/tree-sitter/tree-sitter-typescript/"
    f"{TYPESCRIPT_TREE_SITTER_VERSION}/typescript/src/node-types.json"
)

# Pinned: TypeScript v6.0.3 (latest release as of pinning).
TYPESCRIPT_VERSION = "v6.0.3"
TYPESCRIPT_LIB_ES5_DTS_URL = (
    f"https://raw.githubusercontent.com/microsoft/TypeScript/"
    f"{TYPESCRIPT_VERSION}/src/lib/es5.d.ts"
)

# Pinned: zod@3.24.4 (last release with the `lib/types.d.ts` layout;
# starting at 3.25.0 the package was reorganized into v3/ + v4/ trees).
ZOD_V3_VERSION = "3.24.4"
ZOD_V3_DTS_URLS: tuple[str, ...] = (
    f"https://cdn.jsdelivr.net/npm/zod@{ZOD_V3_VERSION}/lib/types.d.ts",
)

# Pinned: zod@4.4.3 (latest stable v4 in the dedicated v4 package line).
ZOD_V4_VERSION = "4.4.3"
ZOD_V4_DTS_URLS: tuple[str, ...] = (
    f"https://cdn.jsdelivr.net/npm/zod@{ZOD_V4_VERSION}/v4/classic/schemas.d.ts",
    f"https://cdn.jsdelivr.net/npm/zod@{ZOD_V4_VERSION}/v4/classic/checks.d.ts",
    f"https://cdn.jsdelivr.net/npm/zod@{ZOD_V4_VERSION}/v4/classic/iso.d.ts",
    f"https://cdn.jsdelivr.net/npm/zod@{ZOD_V4_VERSION}/v4/classic/coerce.d.ts",
    f"https://cdn.jsdelivr.net/npm/zod@{ZOD_V4_VERSION}/v4/classic/errors.d.ts",
    f"https://cdn.jsdelivr.net/npm/zod@{ZOD_V4_VERSION}/v4/classic/parse.d.ts",
    f"https://cdn.jsdelivr.net/npm/zod@{ZOD_V4_VERSION}/v4/classic/compat.d.ts",
    f"https://cdn.jsdelivr.net/npm/zod@{ZOD_V4_VERSION}/v4/classic/external.d.ts",
)

# Pinned: linkml-model v1.11.0 (released 2026-05-14). The metamodel is
# self-describing — meta.yaml is itself a LinkML schema that defines the
# vocabulary used to write LinkML schemas. types.yaml provides the 19
# built-in scalar types referenced from meta.yaml.
LINKML_MODEL_VERSION = "v1.11.0"
LINKML_META_URL = (
    f"https://raw.githubusercontent.com/linkml/linkml-model/"
    f"{LINKML_MODEL_VERSION}/linkml_model/model/schema/meta.yaml"
)
LINKML_TYPES_URL = (
    f"https://raw.githubusercontent.com/linkml/linkml-model/"
    f"{LINKML_MODEL_VERSION}/linkml_model/model/schema/types.yaml"
)

# Pinned: CPython v3.12.13 (latest 3.12 patch release at pinning).
# Authoritative sources for Python's built-in surface:
#   - Lib/keyword.py: auto-generated from Grammar/python.gram, exports kwlist
#     and softkwlist module-level lists. The deterministic source of truth
#     for the language's reserved and soft-reserved words.
#   - Doc/library/functions.rst: the canonical "Built-in Functions" page,
#     which uses both `.. function::` (49 hits: abs, all, len, …) and
#     `.. class::` (19 hits: bool, int, str, …) directives. The 19
#     class-directives ARE the built-in type-constructor inventory.
#   - Doc/library/exceptions.rst: `.. exception::` directives enumerate
#     the 70 built-in exceptions in the standard hierarchy.
#
# Dunder methods are deliberately NOT scraped: cpython does not enumerate
# them in any single machine-parseable file. datamodel.rst only covers
# ~46 of the ~100+ real dunders (arithmetic, reflected, in-place, async,
# buffer, descriptor protocol live in prose tables and other rst files).
# A scraped partial list would be misleading; honest omission is
# preferable per CLAUDE.md Rule 2.
PYTHON_VERSION = "v3.12.13"
PYTHON_KEYWORD_PY_URL = (
    f"https://raw.githubusercontent.com/python/cpython/"
    f"{PYTHON_VERSION}/Lib/keyword.py"
)
PYTHON_FUNCTIONS_RST_URL = (
    f"https://raw.githubusercontent.com/python/cpython/"
    f"{PYTHON_VERSION}/Doc/library/functions.rst"
)
PYTHON_EXCEPTIONS_RST_URL = (
    f"https://raw.githubusercontent.com/python/cpython/"
    f"{PYTHON_VERSION}/Doc/library/exceptions.rst"
)

# Pinned: protobuf v34.1 (released 2026-03-19). descriptor.proto is the
# self-describing meta-schema that contains the canonical scalar-type
# inventory (FieldDescriptorProto.Type enum) plus the FieldOptions message
# (option keywords like `deprecated`, `packed`, `jstype`, `retention`).
#
# Well-known types: deliberate ALLOWLIST of the 11 canonical WKTs documented
# at protobuf.dev. The src/google/protobuf/ directory also contains ~62
# unittest fixtures, internal helpers, and edition-features files that are
# NOT part of the language's well-known-type surface. A regex exclusion
# would still admit files like cpp_features.proto and late_loaded_option.proto;
# only an explicit allowlist is honest.
#
# Language keywords (message, enum, oneof, repeated, …) are deliberately
# OMITTED: protobuf has no machine-readable grammar artifact. The EBNF lives
# in prose form inside proto3-spec.md / edition-2023-spec.md, with keywords
# embedded as quoted literals in production right-hand sides. Scraping
# those strings and intersecting with a curated allowlist would mean the
# emitted lexicon is partly authored by us, not protobuf — violates
# CLAUDE.md Rule 2. Honest omission documented in source_authority.
PROTOBUF_VERSION = "v34.1"
PROTOBUF_DESCRIPTOR_URL = (
    f"https://raw.githubusercontent.com/protocolbuffers/protobuf/"
    f"{PROTOBUF_VERSION}/src/google/protobuf/descriptor.proto"
)
# Canonical well-known types per protobuf.dev/reference/protobuf/google.protobuf.
# This is the authoritative inventory; do NOT replace with a regex over
# the directory listing — unittest fixtures live in the same directory.
PROTOBUF_WELL_KNOWN_TYPE_FILES: tuple[str, ...] = (
    "any.proto",
    "api.proto",
    "duration.proto",
    "empty.proto",
    "field_mask.proto",
    "source_context.proto",
    "struct.proto",
    "timestamp.proto",
    "type.proto",
    "wrappers.proto",
)
PROTOBUF_WKT_URL_TEMPLATE = (
    f"https://raw.githubusercontent.com/protocolbuffers/protobuf/"
    f"{PROTOBUF_VERSION}/src/google/protobuf/{{filename}}"
)

# Pinned: PostgreSQL REL_18_4 (latest 18.x patch as of pinning; PG 18.0
# released 2025-09-25). Five canonical sources, all under the postgres
# monorepo at github.com/postgres/postgres:
#   - parser/kwlist.h: PG_KEYWORD(name, token, category, bare_label)
#     macros. The 494 lines are the authoritative reserved/non-reserved
#     keyword surface (auto-consumed by gram.y at build time).
#   - catalog/pg_type.dat: 112 Perl-hash entries, one per built-in type.
#     `typname` is the canonical name (int4, varchar, jsonb, …).
#   - catalog/pg_proc.dat: 3397 Perl-hash entries → 2782 unique proname
#     values. The 615-name overload pressure is preserved per-entry as
#     `overload_count` so downstream consumers see it.
#   - catalog/pg_operator.dat: 799 entries → 74 unique oprname symbols
#     (+, -, =, <, @>, <->, ?|, …). Overload-by-operand-type is
#     implementation detail, not lexicon — collapse to unique symbols.
#   - catalog/pg_cast.dat: 235 (castsource, casttarget) pairs — the
#     built-in cast graph between types.
#
# These five files compile into the initial template1 database via
# genbki.pl. They ARE the catalog; no more authoritative source exists.
POSTGRES_VERSION = "REL_18_4"
POSTGRES_KWLIST_URL = (
    f"https://raw.githubusercontent.com/postgres/postgres/"
    f"{POSTGRES_VERSION}/src/include/parser/kwlist.h"
)
POSTGRES_PG_TYPE_URL = (
    f"https://raw.githubusercontent.com/postgres/postgres/"
    f"{POSTGRES_VERSION}/src/include/catalog/pg_type.dat"
)
POSTGRES_PG_PROC_URL = (
    f"https://raw.githubusercontent.com/postgres/postgres/"
    f"{POSTGRES_VERSION}/src/include/catalog/pg_proc.dat"
)
POSTGRES_PG_OPERATOR_URL = (
    f"https://raw.githubusercontent.com/postgres/postgres/"
    f"{POSTGRES_VERSION}/src/include/catalog/pg_operator.dat"
)
POSTGRES_PG_CAST_URL = (
    f"https://raw.githubusercontent.com/postgres/postgres/"
    f"{POSTGRES_VERSION}/src/include/catalog/pg_cast.dat"
)

XS = "{http://www.w3.org/2001/XMLSchema}"


# =========================================================================== #
# Authority labels                                                            #
# =========================================================================== #

SOURCE_AUTHORITY: dict[str, str] = {
    "json_schema_2020_12":   "IETF draft (standards-track) — current dialect meta-schema",
    "xsd_1_1":               "W3C Recommendation (2012-04-05)",
    "shacl_core":            "W3C Recommendation (2017-07-20)",
    "shacl_compact_syntax":  (
        f"W3C Community Group draft — NOT a Recommendation. "
        f"Pinned to w3c/shacl commit {SHACL_COMPACT_SYNTAX_COMMIT[:7]} (2025-01-27)."
    ),
    "json_ld_1_1":           "W3C Recommendation (2020-07-16)",
    "typescript_grammar":    (
        f"Community grammar (tree-sitter-typescript {TYPESCRIPT_TREE_SITTER_VERSION}) "
        "— answers 'what does this parser emit' rather than 'what does the "
        "TypeScript compiler recognize'. For an authoritative TypeScript keyword "
        "inventory the compiler's SyntaxKind enum (src/compiler/types.ts) is "
        "closer to the truth; the two surfaces can disagree."
    ),
    "typescript_lib":        (
        f"Reference implementation (Microsoft TypeScript {TYPESCRIPT_VERSION}) — "
        "no normative EBNF exists for TypeScript; lib.*.d.ts IS the definition "
        "of the intrinsic types it declares."
    ),
    "zod_v3":                f"Published npm distribution (zod@{ZOD_V3_VERSION}) — library API, no formal spec",
    "zod_v4":                f"Published npm distribution (zod@{ZOD_V4_VERSION}) — library API, no formal spec",
    "linkml":                (
        f"Community specification (linkml/linkml-model {LINKML_MODEL_VERSION}) — "
        "NOT a W3C/IETF standard. The metamodel is self-describing (meta.yaml "
        "is itself a LinkML schema). Adopted in biomedical data modeling "
        "(NIH/CD2H, NCATS, Monarch Initiative). Governance: open-source "
        "maintainers under the `linkml` GitHub org."
    ),
    "python":                (
        f"Reference implementation (CPython {PYTHON_VERSION}) — Python is "
        "governed by PEPs / the Steering Council; CPython is the reference "
        "implementation. Lib/keyword.py is auto-generated from the canonical "
        "grammar (Grammar/python.gram), so its lists ARE the language's "
        "reserved-word surface. The built-in functions/classes/exceptions "
        "scraped from Doc/library/*.rst are the documented surface as "
        "shipped with this CPython tag; dunders are deliberately omitted "
        "(not deterministically enumerable from a single file)."
    ),
    "protobuf":              (
        f"Reference implementation (protocolbuffers/protobuf {PROTOBUF_VERSION}) — "
        "Protobuf is governed by Google; the protobuf monorepo is the "
        "canonical reference. descriptor.proto is self-describing — it "
        "defines the message types that describe all other messages, and "
        "contains the FieldDescriptorProto.Type enum which IS the scalar-"
        "type inventory. The well-known types are documented at "
        "protobuf.dev/reference/protobuf/google.protobuf and shipped as "
        ".proto files under src/google/protobuf/. Language keywords are "
        "deliberately omitted: no machine-readable grammar artifact exists "
        "in the protobuf repo (the EBNF lives in prose form in the spec "
        "docs at a separate repo, protocolbuffers.github.io). Built-in "
        "functions are n/a — Protobuf is a schema language, not a runtime."
    ),
    "postgres":              (
        f"Reference implementation (postgres/postgres {POSTGRES_VERSION}) — "
        "PostgreSQL is governed by the PostgreSQL Global Development Group; "
        "the postgres monorepo is the canonical reference. The kwlist.h "
        "PG_KEYWORD macros are consumed by gram.y at build time, so they "
        "ARE the language's reserved-word surface (no looser definition "
        "exists). The .dat files under src/include/catalog/ are compiled "
        "by genbki.pl into the initial template1 database — they ARE the "
        "built-in catalog. PG 18 also implements parts of the SQL:2023 "
        "standard, but where the implementation diverges from the standard "
        "(or extends it: jsonb operators, range types, system catalogs), "
        "this lexicon reflects what PG ships, not what SQL:2023 mandates."
    ),
}

# Single source of truth for the exact pinned version of each source.
# Emitted into the output's metadata.pinned_versions so consumers can
# detect drift even when the top-level key (e.g. "zod_v3") is stable.
PINNED_VERSIONS: dict[str, str] = {
    "json_schema":          "draft/2020-12",
    "xsd":                  "1.1",
    "shacl_core":           "2017-07-20 (REC)",
    "shacl_compact_syntax": f"w3c/shacl@{SHACL_COMPACT_SYNTAX_COMMIT}",
    "json_ld":              "1.1",
    "tree_sitter_typescript": TYPESCRIPT_TREE_SITTER_VERSION,
    "typescript":           TYPESCRIPT_VERSION,
    "zod_v3":               ZOD_V3_VERSION,
    "zod_v4":               ZOD_V4_VERSION,
    "linkml_model":         LINKML_MODEL_VERSION,
    "python":               PYTHON_VERSION,
    "protobuf":             PROTOBUF_VERSION,
    "postgres":             POSTGRES_VERSION,
}


# =========================================================================== #
# Fetching with provenance                                                    #
# =========================================================================== #

@dataclass(frozen=True)
class FetchedSource:
    """One fetched document with content-addressable provenance."""
    url: str
    content: bytes
    sha256: str
    byte_length: int

    @property
    def text(self) -> str:
        return self.content.decode("utf-8", errors="replace")


# Global registry of every URL fetched in this run. Populated by `fetch()`,
# emitted into the output's `metadata.source_provenance`.
_PROVENANCE_REGISTRY: dict[str, FetchedSource] = {}


def _cache_key(url: str) -> str:
    """Filesystem-safe cache key. Slugify for readability, then append a
    short hash of the *original* URL to guarantee collision-freedom — two
    distinct URLs that slugify to the same string still get distinct files.
    """
    slug = re.sub(r"[^A-Za-z0-9_.-]", "_", url)
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:8]
    return f"{slug}.{digest}"


def fetch(url: str, cache_dir: Path) -> FetchedSource:
    """Fetch a URL with on-disk caching and SHA-256 verification.

    Cache key is a slugified URL plus an 8-char hash of the original URL,
    so distinct URLs cannot collide on the same cache file. A FetchedSource
    with sha256 and byte_length is returned and registered for provenance.
    """
    if url in _PROVENANCE_REGISTRY:
        return _PROVENANCE_REGISTRY[url]

    cache_dir.mkdir(parents=True, exist_ok=True)
    cached = cache_dir / _cache_key(url)

    if cached.exists() and cached.stat().st_size > 0:
        body = cached.read_bytes()
    else:
        req = urllib.request.Request(
            url, headers={"User-Agent": "scrape-lexicons/2.1"}
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read()
        except urllib.error.HTTPError as e:
            raise RuntimeError(
                f"HTTP {e.code} fetching {url}: {e.reason}"
            ) from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"network error fetching {url}: {e.reason}") from e
        cached.write_bytes(body)

    fs = FetchedSource(
        url=url,
        content=body,
        sha256=hashlib.sha256(body).hexdigest(),
        byte_length=len(body),
    )
    _PROVENANCE_REGISTRY[url] = fs
    return fs


# =========================================================================== #
# Helpers                                                                     #
# =========================================================================== #

def _strip_tags_to_text(html_fragment: str) -> str:
    """Last-resort tag stripping for already-localised text blocks. Prefer
    lxml-based extraction at the parent level; this is only used inside
    blocks already structurally selected."""
    import html as html_mod
    s = re.sub(r"<[^>]+>", " ", html_fragment)
    s = html_mod.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


# =========================================================================== #
# JSON Schema 2020-12 — vocabulary keywords                                   #
# =========================================================================== #

def scrape_json_schema_keywords(cache_dir: Path) -> list[dict]:
    """One entry per (keyword, vocabulary) pair, preserving each keyword's
    value-constraint schema (the JSON Schema that constrains its value)."""
    out: list[dict] = []
    for vocab, url in JSON_SCHEMA_VOCABULARIES.items():
        fs = fetch(url, cache_dir)
        doc = json.loads(fs.text)
        for kw, value_schema in (doc.get("properties") or {}).items():
            out.append({
                "name": kw,
                "vocabulary": vocab,
                "vocabulary_url": url,
                "value_constraint_schema": value_schema,
                "comment": (
                    value_schema.get("$comment")
                    if isinstance(value_schema, dict) else None
                ),
                "authority_status": "ietf-draft",
            })
    return out


def scrape_json_schema_shared_defs(cache_dir: Path) -> dict[str, Any]:
    """Collect every `$defs` definition from the 2020-12 vocabulary
    meta-schemas. Eight definitions exist across `core`, `applicator`,
    and `validation`; the rest of the dialect references them via
    `#/$defs/<name>` in keyword value-constraint schemas. Capturing them
    inline makes the lexicon self-contained for downstream emitters."""
    shared: dict[str, Any] = {}
    for vocab, url in JSON_SCHEMA_VOCABULARIES.items():
        fs = fetch(url, cache_dir)
        doc = json.loads(fs.text)
        for def_name, def_schema in (doc.get("$defs") or {}).items():
            shared[def_name] = {
                "schema": def_schema,
                "defined_in_vocabulary": vocab,
                "defined_in_url": url,
            }
    return shared


# =========================================================================== #
# XSD 1.1 — schema-for-schemas (XML, ElementTree)                             #
# =========================================================================== #

def _xsd_local(tag: str) -> str:
    """Strip the XSD namespace prefix from a Clark-notation tag."""
    return tag[len(XS):] if tag.startswith(XS) else tag


def _xsd_step(node: ET.Element) -> str:
    """One path step: `xs:tag` or `xs:tag[@name='X']` if the node is itself a
    named declaration. Disambiguates sibling positions inside the schema."""
    local = _xsd_local(node.tag)
    name = node.get("name")
    return f"xs:{local}[@name='{name}']" if name else f"xs:{local}"


def _walk_xsd_named(
    parent: ET.Element,
    target_localname: str,
    parent_path: str,
) -> list[tuple[ET.Element, str]]:
    """Recursively collect all descendants whose local-name is `target_localname`
    and which have a `name` attribute, paired with their XPath-like ancestry."""
    found: list[tuple[ET.Element, str]] = []
    for child in parent:
        child_path = f"{parent_path}/{_xsd_step(child)}"
        if _xsd_local(child.tag) == target_localname and child.get("name"):
            found.append((child, child_path))
        found.extend(_walk_xsd_named(child, target_localname, child_path))
    return found


def scrape_xsd_elements_and_attributes(
    cache_dir: Path,
) -> tuple[list[dict], list[dict]]:
    """Collect every named element and attribute declaration from both
    schema-for-schemas (Part 1 structural, Part 2 datatype).

    Each entry carries a `parent_path` field: an XPath-like ancestry from the
    document root, including `[@name='X']` predicates on intermediate named
    nodes. This disambiguates sibling declarations of the same name appearing
    in different contexts (e.g. <xs:element name='simpleType'/> inside
    multiple parent definitions in XMLSchema.xsd).
    """
    elements: list[dict] = []
    attributes: list[dict] = []
    for label, url in [("part-1-structures", XSD_PART1_XSD_URL),
                       ("part-2-datatypes",  XSD_PART2_XSD_URL)]:
        fs = fetch(url, cache_dir)
        root = ET.fromstring(fs.content)
        root_path = _xsd_step(root)
        for e, path in _walk_xsd_named(root, "element", root_path):
            ann = e.find(XS + "annotation")
            doc_text = None
            if ann is not None:
                d = ann.find(XS + "documentation")
                if d is not None and (d.text or "").strip():
                    doc_text = " ".join((d.text or "").split())
            elements.append({
                "name": e.get("name"),
                "source": label,
                "source_url": url,
                "parent_path": path,
                "type": e.get("type"),
                "substitution_group": e.get("substitutionGroup"),
                "abstract": e.get("abstract") == "true",
                "documentation": doc_text,
                "authority_status": "recommendation",
            })
        for a, path in _walk_xsd_named(root, "attribute", root_path):
            attributes.append({
                "name": a.get("name"),
                "source": label,
                "source_url": url,
                "parent_path": path,
                "type": a.get("type"),
                "default": a.get("default"),
                "fixed": a.get("fixed"),
                # XSD attribute cardinality and namespace-qualification.
                # `use`  ∈ {required, optional, prohibited}   (default: optional)
                # `form` ∈ {qualified, unqualified}            (default: schema's attributeFormDefault)
                # Recorded as the raw attribute-string when present; None
                # when omitted (consumer should apply the spec defaults).
                "use":  a.get("use"),
                "form": a.get("form"),
                "authority_status": "recommendation",
            })
    return elements, attributes


# =========================================================================== #
# XSD 1.1 Part 2 — datatype headings (lxml-based)                             #
# =========================================================================== #

def scrape_xsd_datatypes(cache_dir: Path) -> list[dict]:
    """Extract built-in datatype names from XSD 1.1 Part 2 §3.2–3.4 headings.

    Each datatype is introduced by an <h4> whose first child is an empty
    anchor <a id="NAME" name="NAME"></a> followed by section text
    "3.X.Y NAME". We find these structurally with lxml rather than
    regexing raw HTML — a W3C HTML refresh shifts whitespace and
    attribute order in ways regex can't survive.
    """
    if not _HAS_LXML:
        raise RuntimeError(
            "lxml is required for HTML parsing (XSD 1.1 Part 2 datatype "
            "headings). Install with: pip install lxml"
        )
    fs = fetch(XSD_PART2_HTML_URL, cache_dir)
    tree = lxml.html.fromstring(fs.content)

    out: list[dict] = []
    for h4 in tree.iter("h4"):
        anchor = h4.find(".//a[@id]")
        if anchor is None:
            continue
        name = anchor.get("id")
        if not name:
            continue
        text = " ".join(h4.text_content().split())
        m = re.match(rf"(3\.[234](?:\.\d+)*)\s+{re.escape(name)}\s*$", text)
        if not m:
            continue

        # Prose excerpt = text content of the next block-level sibling.
        prose = ""
        for sib in h4.itersiblings():
            blob = " ".join(sib.text_content().split())
            if blob:
                prose = blob[:400]
                break

        out.append({
            "name": name,
            "section": m.group(1),
            "source_url": XSD_PART2_HTML_URL,
            "prose_excerpt": prose,
            "authority_status": "recommendation",
        })
    return out


# =========================================================================== #
# XSD 1.1 Part 2 — EBNF productions                                           #
# =========================================================================== #
#
# 97 numbered productions across the Part 2 datatype lexical mappings and the
# Appendix G regex grammar. Two markup conventions are used:
#   - Part 2 main: nested <div>s ending with </div></div>
#   - Appendix G:  <table><tr><td>[N]</td><td>name</td><td>::=</td><td>RHS</td>
#
# We let lxml parse the document, then run the boundary-aware regex on the
# lxml-serialised tree. That gives us lxml's tag-soup recovery on input
# while keeping the proven terminators in the extraction.

def scrape_xsd_part2_productions(cache_dir: Path) -> list[dict]:
    """Scrape `[N] name ::= rhs` productions from XSD 1.1 Part 2 HTML."""
    if not _HAS_LXML:
        raise RuntimeError("lxml is required for HTML parsing (XSD productions)")

    fs = fetch(XSD_PART2_HTML_URL, cache_dir)
    tree = lxml.html.fromstring(fs.content)
    # Re-serialise so the markup is consistent regardless of any tag-soup
    # quirks in the raw bytes; this is the lxml-hardening step.
    normalized = lxml.html.tostring(tree, encoding="unicode")

    prod_re = re.compile(
        r"\[\s*(\d+)\s*\](.*?)(?=</div>\s*</div>|</td>\s*</tr>|\[\s*\d+\s*\])",
        re.DOTALL,
    )
    out: list[dict] = []
    for m in prod_re.finditer(normalized):
        text = _strip_tags_to_text(m.group(2))
        # Hyphen permitted: XSD 1.1 Part 2 production [39] is
        # `Canonical-base64Binary ::= ...`.
        nm = re.match(r"([A-Za-z][A-Za-z0-9_-]*)\s+::=\s+(.*)", text, re.DOTALL)
        if not nm:
            continue
        out.append({
            "production_number": int(m.group(1)),
            "name": nm.group(1),
            "rhs": nm.group(2).strip(),
            "source_url": XSD_PART2_HTML_URL,
            "authority_status": "recommendation",
        })
    return out


# =========================================================================== #
# SHACL Core — Turtle ontology                                                #
# =========================================================================== #

def _extract_quoted_lang_string(block: str, predicate: str) -> str | None:
    m = re.search(
        rf'\b{re.escape(predicate)}\s+"((?:[^"\\]|\\.)*)"@?[a-zA-Z-]*',
        block,
    )
    return m.group(1) if m else None


def _extract_object_iri(block: str, predicate: str) -> str | None:
    m = re.search(rf"\b{re.escape(predicate)}\s+([A-Za-z][A-Za-z0-9_:-]*)", block)
    return m.group(1) if m else None


def _extract_integer_object(block: str, predicate: str) -> int | None:
    """Read an integer-valued predicate (e.g. `sh:minCount 1 ;`)."""
    m = re.search(rf"\b{re.escape(predicate)}\s+(-?\d+)\b", block)
    return int(m.group(1)) if m else None


# Predicates surfaced as `shacl_constraints` for each term. Subset of the
# SHACL Core constraint vocabulary meaningful at the term level (especially
# for sh:Parameter and sh:PropertyShape subjects):
#   sh:path/class/datatype/nodeKind  → IRI values
#   sh:minCount/maxCount             → integers
#   sh:name                          → literal (human-readable parameter name)
_SHACL_IRI_CONSTRAINTS = ("sh:path", "sh:class", "sh:datatype", "sh:nodeKind")
_SHACL_INT_CONSTRAINTS = ("sh:minCount", "sh:maxCount")
_SHACL_STR_CONSTRAINTS = ("sh:name",)


def _extract_shacl_constraints(block: str) -> dict[str, Any] | None:
    """Read SHACL-namespaced constraint predicates from a term's block.
    Returns None when none are present so terms without constraints don't
    carry an empty dict."""
    out: dict[str, Any] = {}
    for pred in _SHACL_IRI_CONSTRAINTS:
        v = _extract_object_iri(block, pred)
        if v is not None:
            out[pred.split(":", 1)[1]] = v
    for pred in _SHACL_INT_CONSTRAINTS:
        v = _extract_integer_object(block, pred)
        if v is not None:
            out[pred.split(":", 1)[1]] = v
    for pred in _SHACL_STR_CONSTRAINTS:
        v = _extract_quoted_lang_string(block, pred)
        if v is not None:
            out[pred.split(":", 1)[1]] = v
    return out or None


def scrape_shacl_core_vocabulary(cache_dir: Path) -> list[dict]:
    """Every top-level `^sh:Name` block in the Turtle ontology, with
    rdf:type / rdfs:label / rdfs:comment / domain / range / subClassOf,
    plus SHACL-namespaced constraint predicates (sh:path, sh:class, …)
    surfaced as `shacl_constraints` for terms that carry them (notably
    sh:Parameter subjects)."""
    fs = fetch(SHACL_VOCAB_TTL_URL, cache_dir)
    ttl = fs.text
    # Hyphen permitted: SHACL parameter subjects are declared with names
    # like `sh:AndConstraintComponent-and`. Without `-` in the name pattern,
    # they collapse onto their parent ConstraintComponent (38 hyphenated
    # subjects → 32 collision groups) — same defect class as XSD #39.
    block_re = re.compile(
        r"^sh:([A-Za-z][A-Za-z0-9_-]*)\b(.*?)(?=^sh:[A-Za-z]|\Z)",
        re.DOTALL | re.MULTILINE,
    )
    out: list[dict] = []
    for m in block_re.finditer(ttl):
        name = m.group(1)
        block = m.group(2)
        type_m = re.search(r"\ba\s+([A-Za-z][A-Za-z0-9_:-]*)", block)
        out.append({
            "name": name,
            "rdf_type": type_m.group(1) if type_m else None,
            "label":       _extract_quoted_lang_string(block, "rdfs:label"),
            "comment":     _extract_quoted_lang_string(block, "rdfs:comment"),
            "domain":      _extract_object_iri(block, "rdfs:domain"),
            "range":       _extract_object_iri(block, "rdfs:range"),
            "subclass_of": _extract_object_iri(block, "rdfs:subClassOf"),
            "shacl_constraints": _extract_shacl_constraints(block),
            "source_url":  SHACL_VOCAB_TTL_URL,
            "authority_status": "recommendation",
        })
    return out


# =========================================================================== #
# SHACL Compact Syntax — ANTLR grammar (lxml + targeted regex)                #
# =========================================================================== #

def scrape_shacl_compact_syntax_grammar(cache_dir: Path) -> list[dict]:
    """The SHACL-C ANTLR grammar lives inside a single `<pre>` element
    starting `grammar SHACLC;`. Find that element structurally with lxml,
    then split its text into `name : body ;` rules."""
    if not _HAS_LXML:
        raise RuntimeError("lxml is required for HTML parsing (SHACL-C grammar)")

    fs = fetch(SHACL_COMPACT_SYNTAX_URL, cache_dir)
    tree = lxml.html.fromstring(fs.content)

    grammar_text: str | None = None
    for pre in tree.iter("pre"):
        body = pre.text_content()
        if "grammar SHACLC" in body:
            after = re.split(r"grammar\s+SHACLC\s*;", body, maxsplit=1)
            if len(after) == 2:
                grammar_text = after[1]
                break
    if grammar_text is None:
        return []

    out: list[dict] = []
    rule_re = re.compile(
        r"^\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.+?)\s*;",
        re.DOTALL | re.MULTILINE,
    )
    for rm in rule_re.finditer(grammar_text):
        name = rm.group(1)
        rhs = re.sub(r"\s+", " ", rm.group(2)).strip()
        kind = "lexer_token" if name[0].isupper() else "parser_rule"
        out.append({
            "name": name,
            "kind": kind,
            "rhs": rhs,
            "source_url": SHACL_COMPACT_SYNTAX_URL,
            "authority_status": "community-draft",
        })
    return out


# =========================================================================== #
# JSON-LD 1.1 — syntax tokens and keywords (lxml-based)                       #
# =========================================================================== #

def scrape_json_ld_keywords(cache_dir: Path) -> list[dict]:
    """Extract the @-keywords from JSON-LD 1.1 §1.7 'Syntax Tokens and
    Keywords'. The section contains a single <dl> whose <dt>/<dd> pairs are
    the keyword and its prose definition. We select the section structurally
    by id and walk the <dl> children — same approach as XSD datatype headings.
    """
    if not _HAS_LXML:
        raise RuntimeError(
            "lxml is required for HTML parsing (JSON-LD 1.1 keywords). "
            "Install with: pip install lxml"
        )
    fs = fetch(JSON_LD_1_1_HTML_URL, cache_dir)
    tree = lxml.html.fromstring(fs.content)

    sections = tree.xpath('//section[@id="syntax-tokens-and-keywords"]')
    if not sections:
        return []
    dls = sections[0].xpath(".//dl")
    if not dls:
        return []

    out: list[dict] = []
    children = [c for c in dls[0] if c.tag in ("dt", "dd")]
    i = 0
    while i < len(children):
        if children[i].tag != "dt":
            i += 1
            continue
        name = " ".join(children[i].text_content().split())
        # Filter to actual @-keywords; the section also lists ':' as an
        # aliasing separator, which is not a keyword.
        if not name.startswith("@"):
            i += 1
            continue
        description = ""
        if i + 1 < len(children) and children[i + 1].tag == "dd":
            description = " ".join(children[i + 1].text_content().split())
        out.append({
            "name": name,
            "description": description,
            "source_url": JSON_LD_1_1_HTML_URL,
            "authority_status": "recommendation",
        })
        i += 1
    return out


# =========================================================================== #
# TypeScript — tree-sitter grammar + lib.es5.d.ts intrinsics                  #
# =========================================================================== #

def scrape_typescript_syntactic_constructs(cache_dir: Path) -> list[dict]:
    fs = fetch(TYPESCRIPT_TREE_SITTER_NODE_TYPES_URL, cache_dir)
    nodes = json.loads(fs.text)
    out: list[dict] = []
    for n in nodes:
        name = n.get("type")
        if not name or name.startswith("_"):
            continue
        if not n.get("named", False):
            continue
        out.append({
            "name": name,
            "subtypes": [s["type"] for s in n.get("subtypes", [])],
            "has_fields": bool(n.get("fields")),
            "source_url": TYPESCRIPT_TREE_SITTER_NODE_TYPES_URL,
            "authority_status": "community-grammar",
        })
    return out


def scrape_typescript_intrinsic_types(cache_dir: Path) -> list[dict]:
    fs = fetch(TYPESCRIPT_LIB_ES5_DTS_URL, cache_dir)
    src = fs.text
    out: list[dict] = []
    for m in re.finditer(r"^interface\s+([A-Z][A-Za-z0-9_]*)\b", src, re.MULTILINE):
        out.append({"name": m.group(1), "kind": "interface",
                    "source_url": TYPESCRIPT_LIB_ES5_DTS_URL,
                    "authority_status": "reference-implementation"})
    for m in re.finditer(r"^type\s+([A-Z][A-Za-z0-9_]*)\b", src, re.MULTILINE):
        out.append({"name": m.group(1), "kind": "type_alias",
                    "source_url": TYPESCRIPT_LIB_ES5_DTS_URL,
                    "authority_status": "reference-implementation"})
    seen: set[tuple[str, str]] = set()
    deduped: list[dict] = []
    for it in out:
        key = (it["name"], it["kind"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(it)
    return deduped


# =========================================================================== #
# Zod v3 / v4 — published .d.ts distributions                                 #
# =========================================================================== #

ZOD_EXPORT_RE = re.compile(
    r"^export\s+(?:declare\s+)?"
    r"(class|interface|type|function|const|enum)\s+"
    r"([A-Za-z_][\w$]*)",
    re.MULTILINE,
)
ZOD_REEXPORT_BLOCK_RE = re.compile(
    r"^export\s+(type\s+)?\{([^}]+)\}\s+from\s+",
    re.MULTILINE,
)
ZOD_REEXPORT_ITEM_RE = re.compile(
    r"(?:type\s+)?([A-Za-z_][\w$]*)(?:\s+as\s+([A-Za-z_][\w$]*))?"
)


def scrape_zod_distribution(urls: tuple[str, ...], version_label: str,
                            cache_dir: Path) -> list[dict]:
    """Direct declarations + named re-exports across one or more .d.ts files.

    Dedup policy:
      - Direct declarations: unique by (kind, name) so e.g. a `type Foo` and
        `const Foo` from the same package both survive.
      - Re-exports: unique by name, and suppressed entirely when any direct
        declaration of that name already exists in the distribution.
    """
    direct: list[dict] = []
    reexports: list[dict] = []
    for url in urls:
        fs = fetch(url, cache_dir)
        src = fs.text
        for m in ZOD_EXPORT_RE.finditer(src):
            direct.append({
                "name": m.group(2),
                "kind": m.group(1),
                "version": version_label,
                "source_url": url,
                "authority_status": "library-distribution",
            })
        for bm in ZOD_REEXPORT_BLOCK_RE.finditer(src):
            block = bm.group(2)
            for im in ZOD_REEXPORT_ITEM_RE.finditer(block):
                reexports.append({
                    "name": im.group(2) or im.group(1),
                    "kind": "reexport",
                    "version": version_label,
                    "source_url": url,
                    "authority_status": "library-distribution",
                })

    direct_seen: set[tuple[str, str]] = set()
    deduped: list[dict] = []
    for it in direct:
        key = (it["kind"], it["name"])
        if key in direct_seen:
            continue
        direct_seen.add(key)
        deduped.append(it)

    direct_names = {it["name"] for it in deduped}
    reexport_seen: set[str] = set()
    for it in reexports:
        if it["name"] in direct_names or it["name"] in reexport_seen:
            continue
        reexport_seen.add(it["name"])
        deduped.append(it)
    return deduped


# =========================================================================== #
# LinkML — meta-model classes, slots, and built-in types                      #
# =========================================================================== #
#
# linkml-model is *self-describing*: meta.yaml is itself a LinkML schema that
# defines the vocabulary used to write LinkML schemas. We extract three buckets
# from the root metamodel:
#   - classes (e.g. SchemaDefinition, ClassDefinition, SlotDefinition)
#   - slots   (the metaslots writable in any LinkML schema: range, required,
#              multivalued, pattern, mixins, …)
#   - types   (the 19 built-in scalar types defined in types.yaml)
#
# Note: meta.yaml `imports` companion modules (annotations, mappings, etc.).
# We deliberately scrape only the root file plus types.yaml — those are the
# canonical *root* declarations, and companion-module slots can be recovered
# by following the `imports:` field which we record in metadata.

def _linkml_first_line(s: str | None) -> str | None:
    """LinkML descriptions are often multi-paragraph. Keep the first
    non-empty line as a compact excerpt."""
    if not isinstance(s, str):
        return None
    for line in s.splitlines():
        line = line.strip()
        if line:
            return line
    return None


def scrape_linkml_metamodel(cache_dir: Path) -> dict[str, list[dict]]:
    """Extract LinkML metamodel vocabulary from meta.yaml + types.yaml.

    Returns a dict with three lists keyed `classes`, `slots`, `types`.
    Each entry carries `name`, `source_url`, `authority_status`, plus
    bucket-specific fields (e.g. `is_a`, `mixins`, `range` for slots).
    """
    if not _HAS_YAML:
        raise RuntimeError(
            "PyYAML is required for LinkML extraction. "
            "Install with: pip install PyYAML"
        )

    meta = yaml.safe_load(fetch(LINKML_META_URL, cache_dir).text) or {}
    types_doc = yaml.safe_load(fetch(LINKML_TYPES_URL, cache_dir).text) or {}

    out_classes: list[dict] = []
    for name, body in (meta.get("classes") or {}).items():
        body = body or {}
        out_classes.append({
            "name":             name,
            "source_url":       LINKML_META_URL,
            "authority_status": "community-spec",
            "description":      _linkml_first_line(body.get("description")),
            "is_a":             body.get("is_a"),
            "mixins":           list(body.get("mixins") or []),
            "abstract":         bool(body.get("abstract", False)),
        })

    out_slots: list[dict] = []
    for name, body in (meta.get("slots") or {}).items():
        body = body or {}
        out_slots.append({
            "name":             name,
            "source_url":       LINKML_META_URL,
            "authority_status": "community-spec",
            "description":      _linkml_first_line(body.get("description")),
            "domain":           body.get("domain"),
            "range":            body.get("range"),
            "required":         bool(body.get("required", False)),
            "multivalued":      bool(body.get("multivalued", False)),
            "is_a":             body.get("is_a"),
        })

    out_types: list[dict] = []
    for name, body in (types_doc.get("types") or {}).items():
        body = body or {}
        out_types.append({
            "name":             name,
            "source_url":       LINKML_TYPES_URL,
            "authority_status": "community-spec",
            "description":      _linkml_first_line(body.get("description")),
            "uri":              body.get("uri"),
            "base":             body.get("base"),
            "repr":             body.get("repr"),
        })

    # Box imports as uniform records so a generic walker iterating linkml.*
    # and accessing `.name` on each entry works on `imports` too. The bare
    # URI string is preserved as `name` (it IS the linkml-prefixed import
    # reference, not a human label).
    #
    # `source_url` is the *declaration site* (meta.yaml — where the
    # `imports:` directive appears). `resolves_to` is the actual file the
    # `linkml:<X>` prefix refers to in the upstream repo. The two are
    # always different and serve distinct purposes for downstream consumers.
    linkml_prefix = (
        f"https://raw.githubusercontent.com/linkml/linkml-model/"
        f"{LINKML_MODEL_VERSION}/linkml_model/model/schema/"
    )
    def _resolves_to(imp: str) -> str | None:
        # `linkml:<X>` → `<repo>/.../schema/<X>.yaml`. Anything not in that
        # prefix-form we leave unresolved.
        if imp.startswith("linkml:"):
            return f"{linkml_prefix}{imp.split(':', 1)[1]}.yaml"
        return None

    imports_boxed = [
        {
            "name": imp,
            "kind": "import",
            "source_url": LINKML_META_URL,
            "resolves_to": _resolves_to(imp),
            "authority_status": "community-spec",
        }
        for imp in (meta.get("imports") or [])
    ]
    return {
        "classes": out_classes,
        "slots":   out_slots,
        "types":   out_types,
        "imports": imports_boxed,
    }


# =========================================================================== #
# Python 3.12 — keywords, soft keywords, built-in surface                     #
# =========================================================================== #
#
# Three deterministic extractions per the brief:
#   - kwlist + softkwlist from Lib/keyword.py (auto-generated from the
#     canonical Grammar/python.gram in cpython)
#   - .. function:: and .. class:: directives from Doc/library/functions.rst
#     (49 functions, 19 type constructors as of v3.12.13)
#   - .. exception:: directives from Doc/library/exceptions.rst (70 as of
#     v3.12.13, the full built-in exception hierarchy)
#
# Dunders deliberately omitted: not deterministically enumerable from a
# single source-of-truth file. See PYTHON_VERSION docstring above.

_PY_LIST_LITERAL_RE = re.compile(
    r"^(?P<name>\w+)\s*=\s*\[(?P<body>.*?)\]",
    re.MULTILINE | re.DOTALL,
)
_PY_STRING_LITERAL_RE = re.compile(r"['\"](\w+)['\"]")
_PY_RST_DIRECTIVE_RE = re.compile(
    r"^\.\. (function|class|exception)::\s+(\w+)",
    re.MULTILINE,
)


def _extract_python_list(src: str, list_name: str) -> list[str]:
    """Extract string literals from a `<list_name> = [ ... ]` module-level
    assignment. Used for kwlist and softkwlist in cpython's keyword.py."""
    for m in _PY_LIST_LITERAL_RE.finditer(src):
        if m.group("name") == list_name:
            return _PY_STRING_LITERAL_RE.findall(m.group("body"))
    return []


def scrape_python_lexicon(cache_dir: Path) -> dict[str, list[dict]]:
    """Extract Python 3.12's reserved-word surface and documented built-ins.

    Returns four buckets:
      - `keywords`        — 35 reserved words from keyword.kwlist
      - `soft_keywords`   — 4 soft-reserved words (match, case, type, _)
      - `builtin_functions` — `.. function::` directives in functions.rst
      - `builtin_classes`   — `.. class::` directives in functions.rst
                              (the built-in type constructors: int, str, …)
      - `builtin_exceptions` — `.. exception::` directives in exceptions.rst
    """
    kw_src = fetch(PYTHON_KEYWORD_PY_URL, cache_dir).text
    fn_src = fetch(PYTHON_FUNCTIONS_RST_URL, cache_dir).text
    ex_src = fetch(PYTHON_EXCEPTIONS_RST_URL, cache_dir).text

    keywords = [
        {
            "name":             name,
            "kind":             "keyword",
            "source_url":       PYTHON_KEYWORD_PY_URL,
            "authority_status": "reference-implementation",
        }
        for name in _extract_python_list(kw_src, "kwlist")
    ]
    soft_keywords = [
        {
            "name":             name,
            "kind":             "soft_keyword",
            "source_url":       PYTHON_KEYWORD_PY_URL,
            "authority_status": "reference-implementation",
        }
        for name in _extract_python_list(kw_src, "softkwlist")
    ]

    builtin_functions: list[dict] = []
    builtin_classes:   list[dict] = []
    for directive, name in _PY_RST_DIRECTIVE_RE.findall(fn_src):
        entry = {
            "name":             name,
            "kind":             directive,
            "source_url":       PYTHON_FUNCTIONS_RST_URL,
            "authority_status": "reference-implementation",
        }
        if directive == "function":
            builtin_functions.append(entry)
        elif directive == "class":
            builtin_classes.append(entry)

    builtin_exceptions = [
        {
            "name":             name,
            "kind":             "exception",
            "source_url":       PYTHON_EXCEPTIONS_RST_URL,
            "authority_status": "reference-implementation",
        }
        for directive, name in _PY_RST_DIRECTIVE_RE.findall(ex_src)
        if directive == "exception"
    ]

    return {
        "keywords":           keywords,
        "soft_keywords":      soft_keywords,
        "builtin_functions":  builtin_functions,
        "builtin_classes":    builtin_classes,
        "builtin_exceptions": builtin_exceptions,
    }


# =========================================================================== #
# Protobuf v34.1 — scalar types, well-known types, field options              #
# =========================================================================== #
#
# Three deterministic extractions from raw .proto source:
#   - scalar_types: the FieldDescriptorProto.Type enum in descriptor.proto.
#     18 TYPE_* values; 3 (TYPE_GROUP, TYPE_MESSAGE, TYPE_ENUM) are category
#     markers (the type is determined by a separate type_name field), not
#     scalars. We emit all 18 with `kind: "scalar" | "composite"` so
#     consumers see the full enum.
#   - well_known_types: a closed allowlist of 10 .proto files. For each,
#     extract every top-level `message X` / `enum X` declaration and emit
#     `google.protobuf.X` as the fully-qualified name.
#   - field_options: optional/repeated fields of the FieldOptions message
#     in descriptor.proto. As of v34.1: ctype, packed, jstype, lazy,
#     deprecated, weak, retention, targets, features, edition_defaults,
#     feature_support, uninterpreted_option, plus several edition-specific
#     fields (edition_introduced, edition_deprecated, …).
#
# Language keywords are deliberately NOT scraped — no machine-readable
# grammar exists in the protobuf repo. See PROTOBUF_VERSION docstring above.

_PROTO_TYPE_ENUM_RE = re.compile(
    r"message\s+FieldDescriptorProto\s*\{.*?enum\s+Type\s*\{(.*?)\}",
    re.DOTALL,
)
_PROTO_TYPE_VALUE_RE = re.compile(
    r"^\s*(TYPE_[A-Z0-9]+)\s*=\s*(\d+);",
    re.MULTILINE,
)
_PROTO_FIELD_OPTIONS_RE = re.compile(
    r"message\s+FieldOptions\s*\{(.*?)^\}",
    re.DOTALL | re.MULTILINE,
)
_PROTO_FIELD_OPTION_NAME_RE = re.compile(
    r"^\s*(?:optional|repeated)\s+\S+\s+(\w+)\s*=\s*\d+",
    re.MULTILINE,
)


def _strip_proto_nested_blocks(src: str) -> str:
    """Remove `message X { ... }` and `enum X { ... }` blocks (with proper
    brace balancing) from a Protobuf source fragment, so a field-name
    regex applied afterwards sees only direct (non-nested) field
    declarations of the enclosing message. Regex alone can't do this
    because nested messages may themselves contain `{...}` (e.g. nested
    enums for default values)."""
    out: list[str] = []
    i, n = 0, len(src)
    while i < n:
        m = re.search(r"\b(?:message|enum)\s+\w+\s*\{", src[i:])
        if not m:
            out.append(src[i:])
            break
        out.append(src[i:i + m.start()])
        # Walk balanced braces from the opening `{`.
        depth = 1
        j = i + m.end()
        while j < n and depth > 0:
            if src[j] == "{":
                depth += 1
            elif src[j] == "}":
                depth -= 1
            j += 1
        i = j  # skip past the closing `}`
    return "".join(out)
_PROTO_MESSAGE_OR_ENUM_RE = re.compile(
    r"^(message|enum)\s+(\w+)",
    re.MULTILINE,
)

# TYPE_* enum values that name categories (the actual type is carried in
# FieldDescriptorProto.type_name) rather than scalar types.
_PROTO_TYPE_CATEGORIES: frozenset[str] = frozenset(
    {"TYPE_GROUP", "TYPE_MESSAGE", "TYPE_ENUM"}
)


def scrape_protobuf_lexicon(cache_dir: Path) -> dict[str, list[dict]]:
    """Extract Protobuf's scalar-type, well-known-type, and field-option
    vocabularies from pinned reference sources.

    Returns three buckets:
      - `scalar_types`     — all 18 FieldDescriptorProto.Type values,
                             tagged `kind: scalar | composite`
      - `well_known_types` — `google.protobuf.<Name>` from each of the 10
                             allowlisted WKT .proto files
      - `field_options`    — the 21 optional/repeated fields of FieldOptions
    """
    desc_src = fetch(PROTOBUF_DESCRIPTOR_URL, cache_dir).text

    scalar_types: list[dict] = []
    m = _PROTO_TYPE_ENUM_RE.search(desc_src)
    if m:
        for enum_name, wire_value in _PROTO_TYPE_VALUE_RE.findall(m.group(1)):
            is_category = enum_name in _PROTO_TYPE_CATEGORIES
            scalar_types.append({
                "name":             enum_name,
                "wire_value":       int(wire_value),
                "kind":             "composite" if is_category else "scalar",
                "source_url":       PROTOBUF_DESCRIPTOR_URL,
                "authority_status": "reference-implementation",
            })

    field_options: list[dict] = []
    fo = _PROTO_FIELD_OPTIONS_RE.search(desc_src)
    if fo:
        # Strip nested `message X { ... }` and `enum X { ... }` blocks before
        # scanning for field-name declarations. Without this, fields of
        # FeatureSupport / EditionDefault (nested inside FieldOptions) leak
        # into the field_options list as if they were direct FieldOptions
        # fields — 21 entries become 14 once nesting is respected.
        body = _strip_proto_nested_blocks(fo.group(1))
        for opt_name in _PROTO_FIELD_OPTION_NAME_RE.findall(body):
            field_options.append({
                "name":             opt_name,
                "source_url":       PROTOBUF_DESCRIPTOR_URL,
                "authority_status": "reference-implementation",
            })

    well_known_types: list[dict] = []
    for filename in PROTOBUF_WELL_KNOWN_TYPE_FILES:
        url = PROTOBUF_WKT_URL_TEMPLATE.format(filename=filename)
        wkt_src = fetch(url, cache_dir).text
        for decl_kind, decl_name in _PROTO_MESSAGE_OR_ENUM_RE.findall(wkt_src):
            well_known_types.append({
                "name":             f"google.protobuf.{decl_name}",
                "kind":             decl_kind,
                "source_url":       url,
                "source_file":      filename,
                "authority_status": "reference-implementation",
            })

    return {
        "scalar_types":     scalar_types,
        "well_known_types": well_known_types,
        "field_options":    field_options,
    }


# =========================================================================== #
# PostgreSQL 18 — keywords, types, functions, operators, casts                #
# =========================================================================== #
#
# Five deterministic extractions from pinned cpython-style upstream files:
#   - keywords: PG_KEYWORD("name", token, CATEGORY, BARE_LABEL) macros in
#     kwlist.h. The four categories are RESERVED_KEYWORD,
#     UNRESERVED_KEYWORD, COL_NAME_KEYWORD, TYPE_FUNC_NAME_KEYWORD.
#   - types: every `typname => 'name'` in pg_type.dat (Perl-hash format).
#   - functions: every `proname => 'name'` in pg_proc.dat, deduped to
#     unique names. The collapse factor (number of overloaded signatures
#     per name) is preserved as `overload_count`.
#   - operators: every `oprname => 'symbol'` in pg_operator.dat, deduped
#     to unique symbols. The 74 unique operators ARE the wire-level
#     surface; the 799 source entries are overload-by-operand-type.
#   - casts: every (castsource, casttarget) pair from pg_cast.dat — the
#     built-in cast graph between types.
#
# The .dat files are plain Perl-hash literals (one `[ { ... }, { ... }, ]`
# list of hashes per file). We don't need full Perl-hash parsing; the
# canonical names live in single fields (typname/proname/oprname) that
# we can extract with line-anchored single-quote regexes. The .dat files
# are compiled by genbki.pl into the initial template1 database — they
# ARE the catalog.

_PG_KEYWORD_RE = re.compile(
    r'PG_KEYWORD\("(\w+)",\s*\w+,\s*(\w+),\s*(\w+)\)'
)
_PG_TYPE_NAME_RE     = re.compile(r"typname\s*=>\s*'([^']+)'")
_PG_PROC_NAME_RE     = re.compile(r"proname\s*=>\s*'([^']+)'")
_PG_OPERATOR_NAME_RE = re.compile(r"oprname\s*=>\s*'([^']+)'")
_PG_CAST_PAIR_RE     = re.compile(
    r"castsource\s*=>\s*'([^']+)',\s*casttarget\s*=>\s*'([^']+)'"
)

# Per-entry Perl-hash parser. Each .dat file has a top-level Perl list of
# `{ key => 'value', ... }` records; this regex captures the body of each
# top-level `{...}` (one record at a time), and `_PG_HASH_FIELD_RE` then
# extracts individual `key => 'value'` pairs within it. We use this to
# attach record-scoped fields like castcontext to the right cast row.
_PG_HASH_ENTRY_RE = re.compile(r"\{([^{}]*)\}", re.DOTALL)
_PG_HASH_FIELD_RE = re.compile(r"(\w+)\s*=>\s*'([^']*)'")


def _parse_pg_hash_entries(src: str) -> list[dict[str, str]]:
    """Parse a PostgreSQL .dat file as a list of Perl-hash entries.
    Each entry becomes a {field_name: string_value} dict. Field values
    are kept as raw strings (Postgres uses single-character codes for
    enums like castcontext='a', typcategory='B', typtype='b' — the
    interpretation belongs to the consumer)."""
    return [
        {k: v for k, v in _PG_HASH_FIELD_RE.findall(body)}
        for body in _PG_HASH_ENTRY_RE.findall(src)
    ]


# Decoded labels for the single-character enum codes used in pg_cast and
# pg_type. The lexicon surfaces both the raw code (faithful to source) and
# the decoded label (consumer-friendly). Codes are stable across Postgres
# versions; documented in src/include/catalog/pg_{cast,type}.h.
_PG_CAST_CONTEXT_LABELS = {"e": "explicit", "a": "assignment", "i": "implicit"}
_PG_CAST_METHOD_LABELS  = {"f": "function", "i": "inout", "b": "binary-coercible"}
_PG_TYPTYPE_LABELS      = {
    "b": "base", "c": "composite", "d": "domain", "e": "enum",
    "p": "pseudo", "r": "range", "m": "multirange",
}

_PG_KEYWORD_CATEGORIES: frozenset[str] = frozenset({
    "RESERVED_KEYWORD",
    "UNRESERVED_KEYWORD",
    "COL_NAME_KEYWORD",
    "TYPE_FUNC_NAME_KEYWORD",
})


def scrape_postgres_lexicon(cache_dir: Path) -> dict[str, list[dict]]:
    """Extract PostgreSQL 18's keyword + catalog surface from five pinned
    upstream files.

    Returns five buckets:
      - `keywords`         — 494 entries, tagged `category` and `bare_label`
      - `types`            — 112 built-in types from pg_type.dat
      - `functions`        — 2782 unique proname values (with overload_count)
      - `operators`        — 74 unique oprname symbols
      - `casts`            — 235 (source_type, target_type) pairs
    """
    kw_src   = fetch(POSTGRES_KWLIST_URL,      cache_dir).text
    type_src = fetch(POSTGRES_PG_TYPE_URL,     cache_dir).text
    proc_src = fetch(POSTGRES_PG_PROC_URL,     cache_dir).text
    op_src   = fetch(POSTGRES_PG_OPERATOR_URL, cache_dir).text
    cast_src = fetch(POSTGRES_PG_CAST_URL,     cache_dir).text

    keywords = [
        {
            "name":             name,
            "category":         category,
            "bare_label":       bare_label,
            "source_url":       POSTGRES_KWLIST_URL,
            "authority_status": "reference-implementation",
        }
        for name, category, bare_label in _PG_KEYWORD_RE.findall(kw_src)
    ]

    # Parse each pg_type.dat entry as a Perl-hash record so we can attach
    # `typcategory` (always present, single-char category like B=boolean,
    # N=numeric, S=string, U=user-defined) and `typtype` (b=base, c=composite,
    # d=domain, e=enum, p=pseudo, r=range, m=multirange — defaults to 'b'
    # when omitted in source). Both are surfaced raw AND decoded so consumers
    # can choose source-faithful or human-readable.
    types: list[dict] = []
    for entry in _parse_pg_hash_entries(type_src):
        name = entry.get("typname")
        if not name:
            continue
        typcategory = entry.get("typcategory")
        typtype = entry.get("typtype", "b")  # default per pg_type catalog
        types.append({
            "name":             name,
            "typcategory":      typcategory,
            "typtype":          typtype,
            "typtype_label":    _PG_TYPTYPE_LABELS.get(typtype),
            "source_url":       POSTGRES_PG_TYPE_URL,
            "authority_status": "reference-implementation",
        })

    # Functions: collapse overloads by name, count them. The first source
    # entry wins as the canonical representative; downstream consumers
    # who care about full signatures should consult pg_proc.dat directly.
    proc_names_in_order = _PG_PROC_NAME_RE.findall(proc_src)
    overload_counts: dict[str, int] = {}
    for n in proc_names_in_order:
        overload_counts[n] = overload_counts.get(n, 0) + 1
    seen_procs: set[str] = set()
    functions: list[dict] = []
    for name in proc_names_in_order:
        if name in seen_procs:
            continue
        seen_procs.add(name)
        functions.append({
            "name":             name,
            "overload_count":   overload_counts[name],
            "source_url":       POSTGRES_PG_PROC_URL,
            "authority_status": "reference-implementation",
        })

    # Operators: dedup to unique symbols. Each operator's overload-by-
    # operand-type is implementation detail, not lexicon.
    op_names_in_order = _PG_OPERATOR_NAME_RE.findall(op_src)
    op_overload_counts: dict[str, int] = {}
    for n in op_names_in_order:
        op_overload_counts[n] = op_overload_counts.get(n, 0) + 1
    seen_ops: set[str] = set()
    operators: list[dict] = []
    for name in op_names_in_order:
        if name in seen_ops:
            continue
        seen_ops.add(name)
        operators.append({
            "name":             name,
            "overload_count":   op_overload_counts[name],
            "source_url":       POSTGRES_PG_OPERATOR_URL,
            "authority_status": "reference-implementation",
        })

    # Per-entry parse so we can attach castcontext (i/a/e — implicit,
    # assignment, explicit) and castmethod (f/i/b — function, inout,
    # binary-coercible) to each cast row. Both columns are single-character
    # codes in pg_cast; we surface raw + decoded labels.
    casts: list[dict] = []
    for entry in _parse_pg_hash_entries(cast_src):
        src_t = entry.get("castsource")
        tgt_t = entry.get("casttarget")
        if not src_t or not tgt_t:
            continue
        ctx = entry.get("castcontext")
        method = entry.get("castmethod")
        casts.append({
            "source_type":         src_t,
            "target_type":         tgt_t,
            "castcontext":         ctx,
            "castcontext_label":   _PG_CAST_CONTEXT_LABELS.get(ctx),
            "castmethod":          method,
            "castmethod_label":    _PG_CAST_METHOD_LABELS.get(method),
            "source_url":          POSTGRES_PG_CAST_URL,
            "authority_status":    "reference-implementation",
        })

    return {
        "keywords":  keywords,
        "types":     types,
        "functions": functions,
        "operators": operators,
        "casts":     casts,
    }


# =========================================================================== #
# Output JSON Schema (2020-12)                                                #
# =========================================================================== #
#
# Reasonably strict on the OUTPUT structure, deliberately lenient on item
# field VALUES — `value_constraint_schema` IS a JSON Schema, so its type is
# intentionally unconstrained (lesson from the upstream review's note about
# universal_extractor's output schema being too strict).

_XSD_DECL_ITEM_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["name", "source", "source_url", "parent_path"],
    "properties": {
        "name":        {"type": "string"},
        "source":      {"type": "string"},
        "parent_path": {"type": "string"},
        "type":        {"type": ["string", "null"]},
    },
    "additionalProperties": True,
}

OUTPUT_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://example.org/scrape-lexicons/v2.1/lexicons.schema.json",
    "title": "Cross-language schema/type lexicons (scrape_lexicons v2.1 output)",
    "type": "object",
    "required": ["notice", "metadata", "summary"],
    "additionalProperties": True,
    "properties": {
        "notice": {"type": "string"},
        "metadata": {
            "type": "object",
            "required": [
                "fetched_at", "tool", "sources", "pinned_versions",
                "source_provenance", "source_authority",
                "extraction_rules", "disclaimer",
            ],
            "properties": {
                "fetched_at":      {"type": "string"},
                "tool":            {"type": "string"},
                "sources":         {"type": "object"},
                "pinned_versions": {
                    "type": "object",
                    "additionalProperties": {"type": "string"},
                },
                "source_provenance": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["url", "sha256", "byte_length"],
                        "properties": {
                            "url":         {"type": "string"},
                            "sha256":      {"type": "string",
                                            "pattern": "^[0-9a-f]{64}$"},
                            "byte_length": {"type": "integer", "minimum": 0},
                        },
                    },
                },
                "source_authority": {"type": "object"},
                "logical_sources":  {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "extraction_rules": {"type": "object"},
                "disclaimer":       {"type": "string"},
            },
        },
        "json_schema_2020_12": {
            "type": "object",
            "properties": {
                "keywords": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["name", "vocabulary", "vocabulary_url"],
                        "properties": {
                            "name":           {"type": "string"},
                            "vocabulary":     {"type": "string"},
                            "vocabulary_url": {"type": "string"},
                            # JSON Schema's value_constraint_schema IS itself
                            # a JSON Schema; allow any value.
                            "value_constraint_schema": True,
                            "comment": {"type": ["string", "null"]},
                        },
                    },
                },
                # The eight `$defs` definitions referenced by `$ref`s inside
                # keyword value_constraint_schemas. Captured inline so the
                # lexicon is self-contained for downstream consumers.
                "shared_defs": {
                    "type": "object",
                    "additionalProperties": {
                        "type": "object",
                        "required": ["schema", "defined_in_vocabulary", "defined_in_url"],
                        "properties": {
                            "schema": True,
                            "defined_in_vocabulary": {"type": "string"},
                            "defined_in_url":        {"type": "string"},
                        },
                    },
                },
            },
        },
        "xsd_1_1": {
            "type": "object",
            "properties": {
                "elements":   {"type": "array", "items": _XSD_DECL_ITEM_SCHEMA},
                "attributes": {"type": "array", "items": _XSD_DECL_ITEM_SCHEMA},
                "datatypes":  {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "section", "source_url"],
                    "properties": {
                        "name":    {"type": "string"},
                        "section": {"type": "string"},
                    },
                    "additionalProperties": True,
                }},
                "datatype_productions": {"type": "array", "items": {
                    "type": "object",
                    "required": ["production_number", "name", "rhs"],
                    "properties": {
                        "production_number": {"type": "integer"},
                        "name":              {"type": "string"},
                        "rhs":               {"type": "string"},
                    },
                    "additionalProperties": True,
                }},
            },
        },
        "shacl": {
            "type": "object",
            "properties": {
                "core_vocabulary": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "source_url"],
                    "properties": {
                        "name":     {"type": "string"},
                        "rdf_type": {"type": ["string", "null"]},
                    },
                    "additionalProperties": True,
                }},
                "compact_syntax_grammar": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "kind", "rhs"],
                    "properties": {
                        "name": {"type": "string"},
                        "kind": {"enum": ["lexer_token", "parser_rule"]},
                        "rhs":  {"type": "string"},
                    },
                    "additionalProperties": True,
                }},
            },
        },
        "json_ld_1_1": {
            "type": "object",
            "properties": {
                "keywords": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["name", "source_url"],
                        "properties": {
                            "name":        {"type": "string",
                                            "pattern": "^@[A-Za-z]+$"},
                            "description": {"type": "string"},
                        },
                        "additionalProperties": True,
                    },
                },
            },
        },
        "typescript": {
            "type": "object",
            "properties": {
                "syntactic_constructs": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "source_url"],
                    "properties": {"name": {"type": "string"}},
                    "additionalProperties": True,
                }},
                "intrinsic_types_es5": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "kind", "source_url"],
                    "properties": {
                        "name": {"type": "string"},
                        "kind": {"enum": ["interface", "type_alias"]},
                    },
                    "additionalProperties": True,
                }},
            },
        },
        "zod_v3": {
            "type": "object",
            "properties": {"exports": {"type": "array", "items": {
                "type": "object",
                "required": ["name", "kind", "version", "source_url"],
                "properties": {
                    "name":    {"type": "string"},
                    "kind":    {"type": "string"},
                    "version": {"const": "v3"},
                },
                "additionalProperties": True,
            }}},
        },
        "zod_v4": {
            "type": "object",
            "properties": {"exports": {"type": "array", "items": {
                "type": "object",
                "required": ["name", "kind", "version", "source_url"],
                "properties": {
                    "name":    {"type": "string"},
                    "kind":    {"type": "string"},
                    "version": {"const": "v4"},
                },
                "additionalProperties": True,
            }}},
        },
        "zod_v3_v4_delta": {
            "type": "object",
            "required": ["added_in_v4", "removed_in_v4", "common", "note"],
            "properties": {
                "added_in_v4":   {"type": "array",
                                  "items": {"type": "string"}},
                "removed_in_v4": {"type": "array",
                                  "items": {"type": "string"}},
                "common":        {"type": "array",
                                  "items": {"type": "string"}},
                "note":          {"type": "string"},
            },
            "additionalProperties": False,
        },
        "linkml": {
            "type": "object",
            "required": ["classes", "slots", "types", "imports"],
            "properties": {
                "classes": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "source_url", "authority_status"],
                    "properties": {
                        "name":             {"type": "string"},
                        "authority_status": {"const": "community-spec"},
                        "is_a":             {"type": ["string", "null"]},
                        "mixins":           {"type": "array",
                                              "items": {"type": "string"}},
                        "abstract":         {"type": "boolean"},
                    },
                    "additionalProperties": True,
                }},
                "slots": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "source_url", "authority_status"],
                    "properties": {
                        "name":             {"type": "string"},
                        "authority_status": {"const": "community-spec"},
                        "domain":           {"type": ["string", "null"]},
                        "range":            {"type": ["string", "null"]},
                        "required":         {"type": "boolean"},
                        "multivalued":      {"type": "boolean"},
                        "is_a":             {"type": ["string", "null"]},
                    },
                    "additionalProperties": True,
                }},
                "types": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "source_url", "authority_status"],
                    "properties": {
                        "name":             {"type": "string"},
                        "authority_status": {"const": "community-spec"},
                        "uri":              {"type": ["string", "null"]},
                        "base":             {"type": ["string", "null"]},
                    },
                    "additionalProperties": True,
                }},
                "imports": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "kind", "source_url"],
                    "properties": {
                        "name":             {"type": "string"},
                        "kind":             {"const": "import"},
                        "source_url":       {"type": "string"},
                        "authority_status": {"const": "community-spec"},
                    },
                    "additionalProperties": True,
                }},
            },
            "additionalProperties": True,
        },
        "python_3_12": {
            "type": "object",
            "required": [
                "keywords", "soft_keywords",
                "builtin_functions", "builtin_classes", "builtin_exceptions",
            ],
            "properties": {
                "keywords": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "kind", "source_url", "authority_status"],
                    "properties": {
                        "name":             {"type": "string"},
                        "kind":             {"const": "keyword"},
                        "authority_status": {"const": "reference-implementation"},
                    },
                    "additionalProperties": True,
                }},
                "soft_keywords": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "kind", "source_url", "authority_status"],
                    "properties": {
                        "name":             {"type": "string"},
                        "kind":             {"const": "soft_keyword"},
                        "authority_status": {"const": "reference-implementation"},
                    },
                    "additionalProperties": True,
                }},
                "builtin_functions": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "kind", "source_url", "authority_status"],
                    "properties": {
                        "name":             {"type": "string"},
                        "kind":             {"const": "function"},
                        "authority_status": {"const": "reference-implementation"},
                    },
                    "additionalProperties": True,
                }},
                "builtin_classes": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "kind", "source_url", "authority_status"],
                    "properties": {
                        "name":             {"type": "string"},
                        "kind":             {"const": "class"},
                        "authority_status": {"const": "reference-implementation"},
                    },
                    "additionalProperties": True,
                }},
                "builtin_exceptions": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "kind", "source_url", "authority_status"],
                    "properties": {
                        "name":             {"type": "string"},
                        "kind":             {"const": "exception"},
                        "authority_status": {"const": "reference-implementation"},
                    },
                    "additionalProperties": True,
                }},
            },
            "additionalProperties": True,
        },
        "protobuf": {
            "type": "object",
            "required": ["scalar_types", "well_known_types", "field_options"],
            "properties": {
                "scalar_types": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "kind", "wire_value",
                                 "source_url", "authority_status"],
                    "properties": {
                        "name":             {"type": "string",
                                              "pattern": "^TYPE_[A-Z0-9]+$"},
                        "kind":             {"enum": ["scalar", "composite"]},
                        "wire_value":       {"type": "integer", "minimum": 1},
                        "authority_status": {"const": "reference-implementation"},
                    },
                    "additionalProperties": True,
                }},
                "well_known_types": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "kind", "source_url",
                                 "source_file", "authority_status"],
                    "properties": {
                        "name":             {"type": "string",
                                              "pattern": "^google\\.protobuf\\."},
                        "kind":             {"enum": ["message", "enum"]},
                        "source_file":      {"type": "string"},
                        "authority_status": {"const": "reference-implementation"},
                    },
                    "additionalProperties": True,
                }},
                "field_options": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "source_url", "authority_status"],
                    "properties": {
                        "name":             {"type": "string"},
                        "authority_status": {"const": "reference-implementation"},
                    },
                    "additionalProperties": True,
                }},
            },
            "additionalProperties": True,
        },
        "postgres_18": {
            "type": "object",
            "required": ["keywords", "types", "functions", "operators", "casts"],
            "properties": {
                "keywords": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "category", "bare_label",
                                 "source_url", "authority_status"],
                    "properties": {
                        "name":             {"type": "string"},
                        "category":         {"enum": [
                            "RESERVED_KEYWORD",
                            "UNRESERVED_KEYWORD",
                            "COL_NAME_KEYWORD",
                            "TYPE_FUNC_NAME_KEYWORD",
                        ]},
                        "bare_label":       {"enum": ["BARE_LABEL", "AS_LABEL"]},
                        "authority_status": {"const": "reference-implementation"},
                    },
                    "additionalProperties": True,
                }},
                "types": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "source_url", "authority_status"],
                    "properties": {
                        "name":             {"type": "string"},
                        "authority_status": {"const": "reference-implementation"},
                    },
                    "additionalProperties": True,
                }},
                "functions": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "overload_count",
                                 "source_url", "authority_status"],
                    "properties": {
                        "name":             {"type": "string"},
                        "overload_count":   {"type": "integer", "minimum": 1},
                        "authority_status": {"const": "reference-implementation"},
                    },
                    "additionalProperties": True,
                }},
                "operators": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "overload_count",
                                 "source_url", "authority_status"],
                    "properties": {
                        "name":             {"type": "string"},
                        "overload_count":   {"type": "integer", "minimum": 1},
                        "authority_status": {"const": "reference-implementation"},
                    },
                    "additionalProperties": True,
                }},
                "casts": {"type": "array", "items": {
                    "type": "object",
                    "required": ["source_type", "target_type",
                                 "source_url", "authority_status"],
                    "properties": {
                        "source_type":      {"type": "string"},
                        "target_type":      {"type": "string"},
                        "authority_status": {"const": "reference-implementation"},
                    },
                    "additionalProperties": True,
                }},
            },
            "additionalProperties": True,
        },
        "summary": {
            "type": "object",
            "additionalProperties": {"type": "integer"},
        },
        # Name → sorted list of "<section>.<sub>" locations. Asserts no
        # semantic equivalence; just same-string presence across lexicons.
        "cross_language_index": {
            "type": "object",
            "additionalProperties": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 2,
            },
        },
    },
}


def validate_output(payload: dict, schema: dict) -> list[str]:
    """Return a list of human-readable validation errors (empty == OK).
    Returns an empty list if jsonschema is not installed (with a warning)."""
    if not _HAS_JSONSCHEMA:
        print("[warn] jsonschema not installed; skipping output validation",
              file=sys.stderr)
        return []
    Draft202012Validator.check_schema(schema)
    errs = sorted(Draft202012Validator(schema).iter_errors(payload),
                  key=lambda e: list(e.absolute_path))
    return [f"at {list(e.absolute_path) or '/'}: {e.message}" for e in errs]


# =========================================================================== #
# Assembly                                                                    #
# =========================================================================== #

EXTRACTION_RULES: dict[str, str] = {
    "json_schema_keywords": (
        "Keys of the top-level 'properties' object in each 2020-12 "
        "vocabulary meta-schema; the value is preserved as the keyword's "
        "value-constraint schema. The `format` keyword appears twice — once "
        "in the format-annotation vocabulary, once in format-assertion — "
        "and is disambiguated by the `vocabulary` field. Note that `format` "
        "admits a string enumeration of values (date-time, uuid, ipv4, …) "
        "which is NOT enumerated here; see JSON Schema 2020-12 Validation "
        "§7.3 for the value set. "
        "The `comment` field captures any `$comment` string sibling of the "
        "keyword's value-constraint schema. As of draft 2020-12 only one "
        "such comment exists across all 8 vocabularies (on `$id` in the "
        "core vocabulary); the field's low occupancy reflects the source, "
        "not extractor loss."
    ),
    "xsd_elements": (
        "Every <xs:element name='...'/> declaration (top-level + nested) "
        "in the schema-for-schemas. Each entry carries `parent_path`, an "
        "XPath-like ancestry that disambiguates sibling declarations of "
        "the same name (e.g. <xs:element name='simpleType'/> appears in "
        "multiple parent definitions inside XMLSchema.xsd). "
        "Uniqueness key: (source, name, parent_path). (name, parent_path) "
        "alone is NOT unique — Part 1 and Part 2 schema-for-schemas reuse "
        "the same paths for the same names; consumers must include `source` "
        "(or `source_url`) when indexing. "
        "The `documentation` field captures the text of any direct "
        "<xs:annotation><xs:documentation> child. Only 2 elements carry one "
        "in the W3C schema-for-schemas (Part 1 `facet`, Part 2 `facetElement`); "
        "low occupancy reflects the source, not extractor loss."
    ),
    "xsd_attributes": (
        "Every <xs:attribute name='...'/> declaration (top-level + nested) "
        "in the schema-for-schemas. Each entry carries `parent_path` "
        "(same semantics as for xsd_elements). Uniqueness key: "
        "(source, name, parent_path). "
        "Each entry also carries `use` ∈ {required, optional, prohibited} "
        "(default: optional) and `form` ∈ {qualified, unqualified} (default: "
        "the schema's attributeFormDefault). Both are recorded as the raw "
        "attribute value when present in source, or None when omitted "
        "(consumer applies the spec defaults)."
    ),
    "xsd_datatypes": (
        "lxml: every <h4> with a child <a id='NAME'> in XSD 1.1 Part 2, "
        "filtered to those whose section number is §3.2–3.4."
    ),
    "xsd_datatype_productions": (
        "Numbered EBNF productions [N] name ::= rhs from XSD 1.1 Part 2 HTML, "
        "extracted from the lxml-normalised serialisation. Terminator is "
        "</div></div> (Part 2 main) or </td></tr> (Appendix G regex grammar)."
    ),
    "shacl_core_vocabulary": (
        "Every block beginning ^sh:Name at column 0 in the Turtle ontology, "
        "terminated by the next ^sh: or EOF."
    ),
    "shacl_compact_syntax_grammar": (
        "lxml: locate the <pre> element containing 'grammar SHACLC;', then "
        "parse 'name : body ;' rules from its text content."
    ),
    "json_ld_keywords": (
        "lxml: section[@id='syntax-tokens-and-keywords'] in the JSON-LD 1.1 "
        "Recommendation; walk the <dl>'s <dt>/<dd> pairs, keeping entries "
        "whose <dt> begins with '@'. "
        "Scope note: the @-prefix filter excludes non-@ syntactic tokens that "
        "the same section also lists (e.g. ':' as the compact-IRI separator) "
        "and excludes @version *values* like '1.0'/'1.1' which are not "
        "keywords themselves. Consumers needing those should consult §1.7 "
        "directly."
    ),
    "typescript_syntactic_constructs": (
        "Named, non-internal node types in tree-sitter-typescript's "
        "node-types.json."
    ),
    "typescript_intrinsic_types_es5": (
        "Every ^interface Name and ^type Name declaration in TypeScript's "
        "lib.es5.d.ts. Scope is es5 only — modern intrinsic types defined "
        "in lib.es2015.d.ts … lib.es2024.d.ts, lib.dom.d.ts, etc. (Promise, "
        "Map, Set, WeakRef, …) are NOT covered."
    ),
    "zod_distribution_exports": (
        "Every ^export (declare )?(class|interface|type|function|const|enum) "
        "Name in each Zod .d.ts distribution file, plus named re-exports "
        "^export [type] { ... } from. Direct declarations win over "
        "re-exports of the same name."
    ),
    "linkml_metamodel": (
        "Three buckets from the self-describing LinkML metamodel: "
        "(classes) keys of meta.yaml's `classes:` block; "
        "(slots) keys of meta.yaml's `slots:` block — the metaslots "
        "writable in any LinkML schema; "
        "(types) keys of types.yaml's `types:` block — the 19 built-in "
        "scalar types. The root meta.yaml also `imports:` companion modules "
        "(annotations, mappings, extensions, units) which define additional "
        "slots not captured here; the imports list is preserved in the "
        "extracted payload for downstream resolution. "
        "Imports records: `source_url` is the declaration site (meta.yaml — "
        "where the `imports:` directive appears, NOT the file the directive "
        "resolves to). `resolves_to` is the target file in the linkml-model "
        "repo (or None when the `linkml:<X>` prefix-convention does not apply)."
    ),
    "cross_language_index": (
        "Computed at payload-build time, not scraped. Walks every "
        "list-of-records lexicon section and indexes entry names by "
        "(section, sub_key). Result: name → sorted list of "
        "`<section>.<sub_key>` locations, filtered to names appearing in "
        "≥ 2 *distinct* sub-keys (not just multiple times within one "
        "section). Asserts NO semantic equivalence — same-string presence "
        "only. Consumers must validate any actual cross-language mapping "
        "themselves; the top-level `notice` is the relevant disclaimer. "
        "Derived artifact: cross_language_index has NO source_authority "
        "entry because it is not an external source — its authority is "
        "the SHA-256 provenance of every section it indexes."
    ),
    "python_lexicon": (
        "Five buckets from CPython's source: (keywords, soft_keywords) "
        "extracted as string literals from the `kwlist = [...]` and "
        "`softkwlist = [...]` module-level assignments in Lib/keyword.py "
        "(which is auto-generated from Grammar/python.gram). "
        "(builtin_functions, builtin_classes) from `.. function::` and "
        "`.. class::` rst directives in Doc/library/functions.rst — the "
        "19 class-directives ARE the built-in type-constructor inventory. "
        "(builtin_exceptions) from `.. exception::` directives in "
        "Doc/library/exceptions.rst. Dunder methods are deliberately "
        "OMITTED: they are not deterministically enumerable from any "
        "single source-of-truth file in cpython (only ~46 of ~100+ real "
        "dunders are documented as rst directives; the rest live in prose "
        "tables across multiple files)."
    ),
    "protobuf_lexicon": (
        "Three buckets extracted with line-oriented regex against pinned "
        ".proto source: (scalar_types) the 18 TYPE_* values from "
        "FieldDescriptorProto.Type in descriptor.proto, tagged `kind: "
        "scalar` (15) or `kind: composite` (3 — TYPE_GROUP, TYPE_MESSAGE, "
        "TYPE_ENUM, whose actual type is carried in a separate type_name "
        "field). (well_known_types) every top-level `message X` or `enum "
        "X` declaration from a CLOSED ALLOWLIST of 10 canonical WKT files "
        "(any.proto, api.proto, duration.proto, empty.proto, "
        "field_mask.proto, source_context.proto, struct.proto, "
        "timestamp.proto, type.proto, wrappers.proto), emitted as "
        "fully-qualified `google.protobuf.<Name>`. The allowlist is "
        "mandatory: src/google/protobuf/ also contains ~62 unittest "
        "fixtures, internal helpers, and edition-features files that are "
        "NOT part of the WKT surface. (field_options) optional/repeated "
        "field names from the FieldOptions message in descriptor.proto. "
        "Language keywords are deliberately OMITTED — no machine-readable "
        "grammar artifact exists in the protobuf repo (the EBNF lives in "
        "prose form in the spec docs at a separate repo, "
        "protocolbuffers.github.io)."
    ),
    "postgres_lexicon": (
        "Five buckets from pinned PostgreSQL sources. (keywords) every "
        "`PG_KEYWORD(name, token, category, bare_label)` macro in "
        "src/include/parser/kwlist.h; the four categories — "
        "RESERVED_KEYWORD, UNRESERVED_KEYWORD, COL_NAME_KEYWORD, "
        "TYPE_FUNC_NAME_KEYWORD — are preserved as a per-entry field. "
        "(types) every `typname` in pg_type.dat — the 112 built-in types, "
        "each carrying `typcategory` (single-character pg category code) "
        "and `typtype` (b=base, c=composite, d=domain, e=enum, p=pseudo, "
        "r=range, m=multirange; defaults to 'b' when omitted in source). "
        "Both raw codes and decoded `*_label` strings are emitted. "
        "(functions) every `proname` in pg_proc.dat, deduplicated by name; "
        "the 615 names that have multiple signatures retain their "
        "multiplicity in an `overload_count` field (so the 3397 source "
        "entries collapse to 2782 unique names without losing the "
        "overload-pressure signal). NAME ROSTER, NOT SIGNATURE CATALOG: "
        "argument-types and return-type are deliberately NOT surfaced — "
        "for signatures, consult pg_proc.dat directly via source_url. "
        "(operators) every `oprname` in pg_operator.dat, same dedup-with-"
        "overload-count strategy (74 unique symbols from 799 source "
        "entries — overload-by-operand-type is implementation detail, not "
        "lexicon). (casts) every `(castsource, casttarget)` pair in "
        "pg_cast.dat — the 235 built-in cast edges between types, each "
        "carrying `castcontext` (i=implicit, a=assignment, e=explicit) "
        "and `castmethod` (f=function, i=inout, b=binary-coercible), "
        "raw + decoded `*_label` strings. The castcontext distinction is "
        "load-bearing for emitters: implicit ≠ assignment ≠ explicit. "
        "These files compile into the initial template1 database via "
        "genbki.pl; they ARE the catalog."
    ),
}


def _compute_zod_delta(v3: list[dict], v4: list[dict]) -> dict:
    """Pure same-language inventory delta of public export *names* between
    Zod v3 and v4. 'Renamed' is not detectable from public surface alone
    (no semantic equivalence signal), so this only reports added/removed —
    explicit per CLAUDE.md Rule 2 (don't claim what you can't verify)."""
    v3_names = {e["name"] for e in v3}
    v4_names = {e["name"] for e in v4}
    return {
        "added_in_v4":   sorted(v4_names - v3_names),
        "removed_in_v4": sorted(v3_names - v4_names),
        "common":        sorted(v3_names & v4_names),
        "note": (
            "Pure set difference on export names. Renames cannot be detected "
            "from the public surface alone, so 'added' may include renamed "
            "v3 entries and vice versa. The `common` set is by exact name "
            "match; semantically-equivalent exports under different names "
            "appear as one removal + one addition."
        ),
    }


def _compute_cross_language_index(
    payload_subset: dict[str, Any],
    min_lexicon_count: int = 2,
) -> dict[str, list[str]]:
    """Walk every list-of-records lexicon section in `payload_subset` and
    index entry names by (section_key, sub_key). Returns name → sorted
    list of `<section>.<sub>` locations, filtered to names appearing in
    at least `min_lexicon_count` *distinct* sub-keys (not just multiple
    times within the same section).

    Asserts no semantic equivalence — only that the same identifier
    string appears across lexicons. Consumers must validate any actual
    cross-language mapping themselves; the lexicon's top-level `notice`
    field is the relevant disclaimer.
    """
    from collections import defaultdict
    by_name: dict[str, set[str]] = defaultdict(set)
    skip_top = {"metadata", "summary", "notice", "zod_v3_v4_delta",
                "cross_language_index"}
    for section_key, section in payload_subset.items():
        if section_key in skip_top or not isinstance(section, dict):
            continue
        for sub_key, sub in section.items():
            if not isinstance(sub, list):
                continue
            for item in sub:
                if isinstance(item, dict) and isinstance(item.get("name"), str):
                    by_name[item["name"]].add(f"{section_key}.{sub_key}")
    return {
        name: sorted(locs)
        for name, locs in by_name.items()
        if len(locs) >= min_lexicon_count
    }


def build_payload(cache_dir: Path) -> dict:
    # Fetch the dialect meta-schema for provenance even though we don't
    # parse properties from it — it identifies the dialect that the eight
    # vocabulary meta-schemas compose, and its SHA-256 belongs in the
    # provenance record alongside the rest.
    fetch(JSON_SCHEMA_DIALECT_URL, cache_dir)
    keywords        = scrape_json_schema_keywords(cache_dir)
    shared_defs     = scrape_json_schema_shared_defs(cache_dir)
    elements, attrs = scrape_xsd_elements_and_attributes(cache_dir)
    datatypes       = scrape_xsd_datatypes(cache_dir)
    productions     = scrape_xsd_part2_productions(cache_dir)
    shacl_vocab     = scrape_shacl_core_vocabulary(cache_dir)
    shaclc_grammar  = scrape_shacl_compact_syntax_grammar(cache_dir)
    jsonld_kw       = scrape_json_ld_keywords(cache_dir)
    ts_syntactic    = scrape_typescript_syntactic_constructs(cache_dir)
    ts_intrinsic    = scrape_typescript_intrinsic_types(cache_dir)
    zod_v3          = scrape_zod_distribution(ZOD_V3_DTS_URLS, "v3", cache_dir)
    zod_v4          = scrape_zod_distribution(ZOD_V4_DTS_URLS, "v4", cache_dir)
    zod_delta       = _compute_zod_delta(zod_v3, zod_v4)
    linkml          = scrape_linkml_metamodel(cache_dir)
    python_lex      = scrape_python_lexicon(cache_dir)
    protobuf_lex    = scrape_protobuf_lexicon(cache_dir)
    postgres_lex    = scrape_postgres_lexicon(cache_dir)

    provenance = [
        {"url": fs.url, "sha256": fs.sha256, "byte_length": fs.byte_length}
        for fs in sorted(_PROVENANCE_REGISTRY.values(), key=lambda x: x.url)
    ]

    payload = {
        "notice": (
            "No cross-language mapping is asserted by this file — only the "
            "lexicon of each side. Authority per source is in "
            "metadata.source_authority; some entries (SHACL Compact Syntax, "
            "tree-sitter TypeScript) carry a per-entry `authority_status` "
            "field marking them as community-draft / community-grammar."
        ),
        "metadata": {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "tool": "scrape_lexicons.py v2.1",
            "sources": {
                "json_schema_dialect": JSON_SCHEMA_DIALECT_URL,
                "json_schema_vocabularies": JSON_SCHEMA_VOCABULARIES,
                "xsd_1_1_part_1_xsd": XSD_PART1_XSD_URL,
                "xsd_1_1_part_2_xsd": XSD_PART2_XSD_URL,
                "xsd_1_1_part_2_html": XSD_PART2_HTML_URL,
                "shacl_core_ttl": SHACL_VOCAB_TTL_URL,
                "shacl_compact_syntax_html": SHACL_COMPACT_SYNTAX_URL,
                "json_ld_1_1_html": JSON_LD_1_1_HTML_URL,
                "typescript_tree_sitter_node_types":
                    TYPESCRIPT_TREE_SITTER_NODE_TYPES_URL,
                "typescript_lib_es5_dts": TYPESCRIPT_LIB_ES5_DTS_URL,
                "zod_v3_dts": list(ZOD_V3_DTS_URLS),
                "zod_v4_dts": list(ZOD_V4_DTS_URLS),
                "linkml_meta_yaml":  LINKML_META_URL,
                "linkml_types_yaml": LINKML_TYPES_URL,
                "python_keyword_py":     PYTHON_KEYWORD_PY_URL,
                "python_functions_rst":  PYTHON_FUNCTIONS_RST_URL,
                "python_exceptions_rst": PYTHON_EXCEPTIONS_RST_URL,
                "protobuf_descriptor": PROTOBUF_DESCRIPTOR_URL,
                "protobuf_well_known_type_files": [
                    PROTOBUF_WKT_URL_TEMPLATE.format(filename=f)
                    for f in PROTOBUF_WELL_KNOWN_TYPE_FILES
                ],
                "postgres_kwlist":      POSTGRES_KWLIST_URL,
                "postgres_pg_type":     POSTGRES_PG_TYPE_URL,
                "postgres_pg_proc":     POSTGRES_PG_PROC_URL,
                "postgres_pg_operator": POSTGRES_PG_OPERATOR_URL,
                "postgres_pg_cast":     POSTGRES_PG_CAST_URL,
            },
            "pinned_versions":   PINNED_VERSIONS,
            "source_provenance": provenance,
            "source_authority":  SOURCE_AUTHORITY,
            # The enumeration matching summary.logical_source_count.
            # `len(logical_sources) == summary.logical_source_count` is
            # a hard integrity invariant (locked by regression test).
            "logical_sources":   sorted(SOURCE_AUTHORITY.keys()),
            "extraction_rules":  EXTRACTION_RULES,
            "disclaimer": (
                "All entries are scraped from authoritative or "
                "authority-equivalent sources. Authority level per lexicon "
                "is recorded in source_authority; SHA-256 + byte_length per "
                "fetched URL is recorded in source_provenance for "
                "reproducibility. No cross-language mapping is asserted by "
                "this file — only the lexicon of each side."
            ),
        },
        "json_schema_2020_12": {
            "keywords":    keywords,
            "shared_defs": shared_defs,
        },
        "xsd_1_1": {
            "elements": elements,
            "attributes": attrs,
            "datatypes": datatypes,
            "datatype_productions": productions,
        },
        "shacl": {
            "core_vocabulary": shacl_vocab,
            "compact_syntax_grammar": shaclc_grammar,
        },
        "json_ld_1_1": {"keywords": jsonld_kw},
        "typescript": {
            "syntactic_constructs": ts_syntactic,
            "intrinsic_types_es5": ts_intrinsic,
        },
        "zod_v3": {"exports": zod_v3},
        "zod_v4": {"exports": zod_v4},
        "zod_v3_v4_delta": zod_delta,
        "linkml": {
            "classes": linkml["classes"],
            "slots":   linkml["slots"],
            "types":   linkml["types"],
            "imports": linkml["imports"],
        },
        "python_3_12": {
            "keywords":           python_lex["keywords"],
            "soft_keywords":      python_lex["soft_keywords"],
            "builtin_functions":  python_lex["builtin_functions"],
            "builtin_classes":    python_lex["builtin_classes"],
            "builtin_exceptions": python_lex["builtin_exceptions"],
        },
        "protobuf": {
            "scalar_types":     protobuf_lex["scalar_types"],
            "well_known_types": protobuf_lex["well_known_types"],
            "field_options":    protobuf_lex["field_options"],
        },
        "postgres_18": {
            "keywords":  postgres_lex["keywords"],
            "types":     postgres_lex["types"],
            "functions": postgres_lex["functions"],
            "operators": postgres_lex["operators"],
            "casts":     postgres_lex["casts"],
        },
        "summary": {
            "json_schema_keyword_count":             len(keywords),
            "json_schema_vocabulary_count":          len(JSON_SCHEMA_VOCABULARIES),
            "xsd_element_count":                     len(elements),
            "xsd_attribute_count":                   len(attrs),
            "xsd_datatype_count":                    len(datatypes),
            "xsd_datatype_production_count":         len(productions),
            "shacl_core_term_count":                 len(shacl_vocab),
            "shacl_compact_grammar_rule_count":      len(shaclc_grammar),
            "json_ld_keyword_count":                 len(jsonld_kw),
            "typescript_syntactic_construct_count":  len(ts_syntactic),
            "typescript_intrinsic_type_es5_count":   len(ts_intrinsic),
            "zod_v3_export_count":                   len(zod_v3),
            "zod_v4_export_count":                   len(zod_v4),
            "zod_v4_added_count":                    len(zod_delta["added_in_v4"]),
            "zod_v4_removed_count":                  len(zod_delta["removed_in_v4"]),
            "zod_v3_v4_common_count":                len(zod_delta["common"]),
            "linkml_class_count":                    len(linkml["classes"]),
            "linkml_slot_count":                     len(linkml["slots"]),
            "linkml_type_count":                     len(linkml["types"]),
            "python_keyword_count":                  len(python_lex["keywords"]),
            "python_soft_keyword_count":             len(python_lex["soft_keywords"]),
            "python_builtin_function_count":         len(python_lex["builtin_functions"]),
            "python_builtin_class_count":            len(python_lex["builtin_classes"]),
            "python_builtin_exception_count":        len(python_lex["builtin_exceptions"]),
            "protobuf_scalar_type_count":            len(protobuf_lex["scalar_types"]),
            "protobuf_well_known_type_count":        len(protobuf_lex["well_known_types"]),
            "protobuf_field_option_count":           len(protobuf_lex["field_options"]),
            "postgres_keyword_count":                len(postgres_lex["keywords"]),
            "postgres_type_count":                   len(postgres_lex["types"]),
            "postgres_function_count":               len(postgres_lex["functions"]),
            "postgres_operator_count":               len(postgres_lex["operators"]),
            "postgres_cast_count":                   len(postgres_lex["casts"]),
            "fetched_url_count":                     len(provenance),
            # Derived from SOURCE_AUTHORITY rather than hardcoded so the
            # count stays in sync with the set of distinct logical sources
            # the lexicon declares (each key in source_authority is a
            # distinct logical source). The enumeration itself is surfaced
            # in metadata.logical_sources for audit-trail.
            "logical_source_count":                  len(SOURCE_AUTHORITY),
        },
    }
    # Cross-language name index: which lexicon sections each name appears
    # in. Asserts no semantic equivalence — see top-level `notice`. Surfaced
    # so consumers can find the same identifier across lexicons at a glance.
    cross_index = _compute_cross_language_index(payload, min_lexicon_count=2)
    payload["cross_language_index"] = cross_index
    # Point-of-use disclaimer (sibling field, not embedded in the index
    # itself, so the index stays a clean name→locations dict). Many of
    # the matches are homographs across unrelated domains: SHACL `sh:path`
    # vs Postgres geometric `path`, SQL keyword `class` vs Python `class`,
    # JSON Schema `pattern` vs SHACL constraint `pattern`. The index
    # records that the strings coincide, NOT that the concepts do.
    payload["cross_language_index_meta"] = {
        "caveat": (
            "Entries record same-string occurrence across lexicons. "
            "MANY are homographs across unrelated domains (e.g. SHACL "
            "`path` is property-path navigation; Postgres `path` is "
            "geometric polyline; Python `class` is the keyword; SHACL "
            "`class` is rdf:type constraint). No semantic correspondence "
            "is asserted — see top-level `notice` and "
            "extraction_rules.cross_language_index."
        ),
        "min_lexicon_count": 2,
        "size": len(cross_index),
    }
    payload["summary"]["cross_language_index_size"] = len(cross_index)
    return payload


# =========================================================================== #
# Entry point                                                                 #
# =========================================================================== #

def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(
        description="Scrape authoritative cross-language schema/type lexicons.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--cache-dir", default=str(here / "_spec_cache"),
                    help="Where to cache fetched spec documents.")
    ap.add_argument("--out", default=str(here / "lexicons.json"),
                    help="Output path for the lexicons JSON.")
    ap.add_argument("--schema-out", default=str(here / "lexicons.schema.json"),
                    help="Output path for the lexicons output schema.")
    ap.add_argument("--no-validate", action="store_true",
                    help="Skip self-validation against the emitted schema.")
    args = ap.parse_args(argv)

    if not _HAS_LXML:
        print("[error] lxml is required (pip install lxml)", file=sys.stderr)
        return 2
    if not _HAS_YAML:
        print("[error] PyYAML is required (pip install PyYAML)", file=sys.stderr)
        return 2

    cache_dir = Path(args.cache_dir)

    # Always emit the schema — it's data, not a side-effect of validation.
    schema_path = Path(args.schema_out)
    schema_path.write_text(
        json.dumps(OUTPUT_SCHEMA, indent=2) + "\n", encoding="utf-8"
    )
    print(f"[info] wrote schema: {schema_path}", file=sys.stderr)

    payload = build_payload(cache_dir)

    if not args.no_validate:
        errs = validate_output(payload, OUTPUT_SCHEMA)
        if errs:
            print("[error] output failed self-validation against schema:",
                  file=sys.stderr)
            for e in errs[:20]:
                print(f"  - {e}", file=sys.stderr)
            if len(errs) > 20:
                print(f"  ...and {len(errs)-20} more", file=sys.stderr)
            return 1
        if _HAS_JSONSCHEMA:
            print("[info] output validation: OK", file=sys.stderr)

    out_path = Path(args.out)
    out_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    s = payload["summary"]
    pv = PINNED_VERSIONS
    print(
        f"[ok] wrote {out_path}:\n"
        f"     JSON Schema {pv['json_schema']}  : {s['json_schema_keyword_count']} keywords\n"
        f"     XSD {pv['xsd']}             : {s['xsd_element_count']} elements, "
        f"{s['xsd_attribute_count']} attributes, "
        f"{s['xsd_datatype_count']} datatypes, "
        f"{s['xsd_datatype_production_count']} productions\n"
        f"     SHACL Core {pv['shacl_core']}  : {s['shacl_core_term_count']} core terms\n"
        f"     SHACL-C @{SHACL_COMPACT_SYNTAX_COMMIT[:7]} : "
        f"{s['shacl_compact_grammar_rule_count']} compact-syntax rules\n"
        f"     JSON-LD {pv['json_ld']}         : {s['json_ld_keyword_count']} keywords\n"
        f"     TypeScript {pv['typescript']}     : "
        f"{s['typescript_intrinsic_type_es5_count']} intrinsic types (es5)\n"
        f"     tree-sitter-ts {pv['tree_sitter_typescript']} : "
        f"{s['typescript_syntactic_construct_count']} syntactic constructs\n"
        f"     Zod {pv['zod_v3']}           : {s['zod_v3_export_count']} public exports\n"
        f"     Zod {pv['zod_v4']}            : {s['zod_v4_export_count']} public exports\n"
        f"     LinkML {pv['linkml_model']}        : "
        f"{s['linkml_class_count']} classes, "
        f"{s['linkml_slot_count']} slots, "
        f"{s['linkml_type_count']} built-in types\n"
        f"     Python {pv['python']}        : "
        f"{s['python_keyword_count']} keywords + "
        f"{s['python_soft_keyword_count']} soft, "
        f"{s['python_builtin_function_count']} functions, "
        f"{s['python_builtin_class_count']} classes, "
        f"{s['python_builtin_exception_count']} exceptions\n"
        f"     Protobuf {pv['protobuf']}      : "
        f"{s['protobuf_scalar_type_count']} TYPE_* values, "
        f"{s['protobuf_well_known_type_count']} well-known types, "
        f"{s['protobuf_field_option_count']} field options\n"
        f"     Postgres {pv['postgres']}     : "
        f"{s['postgres_keyword_count']} keywords, "
        f"{s['postgres_type_count']} types, "
        f"{s['postgres_function_count']} functions, "
        f"{s['postgres_operator_count']} operators, "
        f"{s['postgres_cast_count']} casts\n"
        f"     provenance          : {s['fetched_url_count']} URLs hashed "
        f"across {s['logical_source_count']} logical sources",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
