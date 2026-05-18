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

SHACL_VOCAB_TTL_URL      = "https://www.w3.org/ns/shacl.ttl"
SHACL_COMPACT_SYNTAX_URL = "https://w3c.github.io/shacl/shacl-compact-syntax/"

TYPESCRIPT_TREE_SITTER_NODE_TYPES_URL = (
    "https://raw.githubusercontent.com/tree-sitter/tree-sitter-typescript/"
    "master/typescript/src/node-types.json"
)
TYPESCRIPT_LIB_ES5_DTS_URL = (
    "https://raw.githubusercontent.com/microsoft/TypeScript/"
    "main/src/lib/es5.d.ts"
)

ZOD_V3_DTS_URLS: tuple[str, ...] = (
    "https://cdn.jsdelivr.net/npm/zod@3/lib/types.d.ts",
)
ZOD_V4_DTS_URLS: tuple[str, ...] = (
    "https://cdn.jsdelivr.net/npm/zod@4/v4/classic/schemas.d.ts",
    "https://cdn.jsdelivr.net/npm/zod@4/v4/classic/checks.d.ts",
    "https://cdn.jsdelivr.net/npm/zod@4/v4/classic/iso.d.ts",
    "https://cdn.jsdelivr.net/npm/zod@4/v4/classic/coerce.d.ts",
    "https://cdn.jsdelivr.net/npm/zod@4/v4/classic/errors.d.ts",
    "https://cdn.jsdelivr.net/npm/zod@4/v4/classic/parse.d.ts",
    "https://cdn.jsdelivr.net/npm/zod@4/v4/classic/compat.d.ts",
    "https://cdn.jsdelivr.net/npm/zod@4/v4/classic/external.d.ts",
)

XS = "{http://www.w3.org/2001/XMLSchema}"


# =========================================================================== #
# Authority labels                                                            #
# =========================================================================== #

SOURCE_AUTHORITY: dict[str, str] = {
    "json_schema_2020_12":   "IETF draft (standards-track) — current dialect meta-schema",
    "xsd_1_1":               "W3C Recommendation (2012-04-05)",
    "shacl_core":            "W3C Recommendation (2017-07-20)",
    "shacl_compact_syntax":  "W3C Community Group draft — NOT a Recommendation",
    "typescript_grammar":    (
        "Community grammar (tree-sitter) — answers 'what does this parser "
        "emit' rather than 'what does the TypeScript compiler recognize'. "
        "For an authoritative TypeScript keyword inventory the compiler's "
        "SyntaxKind enum (src/compiler/types.ts) is closer to the truth; "
        "the two surfaces can disagree."
    ),
    "typescript_lib":        (
        "Reference implementation (Microsoft) — no normative EBNF exists for "
        "TypeScript; lib.*.d.ts IS the definition of the intrinsic types it "
        "declares."
    ),
    "zod_v3":                "Published npm distribution (zod@3) — library API, no formal spec",
    "zod_v4":                "Published npm distribution (zod@4) — library API, no formal spec",
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


def fetch(url: str, cache_dir: Path) -> FetchedSource:
    """Fetch a URL with on-disk caching and SHA-256 verification.

    Cache key is the URL (slugified for filesystem safety). If the cache
    file exists and is non-empty, its bytes are read directly. Either
    way, a FetchedSource with sha256 and byte_length is returned and
    registered for provenance.
    """
    if url in _PROVENANCE_REGISTRY:
        return _PROVENANCE_REGISTRY[url]

    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_key = re.sub(r"[^A-Za-z0-9_.-]", "_", url)
    cached = cache_dir / cache_key

    if cached.exists() and cached.stat().st_size > 0:
        body = cached.read_bytes()
    else:
        req = urllib.request.Request(
            url, headers={"User-Agent": "scrape-lexicons/2.0"}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read()
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
            })
    return out


# =========================================================================== #
# XSD 1.1 — schema-for-schemas (XML, ElementTree)                             #
# =========================================================================== #

def scrape_xsd_elements_and_attributes(
    cache_dir: Path,
) -> tuple[list[dict], list[dict]]:
    """Collect every named element and attribute declaration from both
    schema-for-schemas (Part 1 structural, Part 2 datatype)."""
    elements: list[dict] = []
    attributes: list[dict] = []
    for label, url in [("part-1-structures", XSD_PART1_XSD_URL),
                       ("part-2-datatypes",  XSD_PART2_XSD_URL)]:
        fs = fetch(url, cache_dir)
        root = ET.fromstring(fs.content)
        for e in root.iter(XS + "element"):
            name = e.get("name")
            if not name:
                continue
            ann = e.find(XS + "annotation")
            doc_text = None
            if ann is not None:
                d = ann.find(XS + "documentation")
                if d is not None and (d.text or "").strip():
                    doc_text = " ".join((d.text or "").split())
            elements.append({
                "name": name,
                "source": label,
                "source_url": url,
                "type": e.get("type"),
                "substitution_group": e.get("substitutionGroup"),
                "abstract": e.get("abstract") == "true",
                "documentation": doc_text,
            })
        for a in root.iter(XS + "attribute"):
            name = a.get("name")
            if not name:
                continue
            attributes.append({
                "name": name,
                "source": label,
                "source_url": url,
                "type": a.get("type"),
                "default": a.get("default"),
                "fixed": a.get("fixed"),
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
        nm = re.match(r"([A-Za-z][A-Za-z0-9_]*)\s+::=\s+(.*)", text, re.DOTALL)
        if not nm:
            continue
        out.append({
            "production_number": int(m.group(1)),
            "name": nm.group(1),
            "rhs": nm.group(2).strip(),
            "source_url": XSD_PART2_HTML_URL,
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


def scrape_shacl_core_vocabulary(cache_dir: Path) -> list[dict]:
    """Every top-level `^sh:Name` block in the Turtle ontology, with
    rdf:type / rdfs:label / rdfs:comment / domain / range / subClassOf."""
    fs = fetch(SHACL_VOCAB_TTL_URL, cache_dir)
    ttl = fs.text
    block_re = re.compile(
        r"^sh:([A-Za-z][A-Za-z0-9_]*)\b(.*?)(?=^sh:[A-Za-z]|\Z)",
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
            "source_url":  SHACL_VOCAB_TTL_URL,
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
        })
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
        })
    return out


def scrape_typescript_intrinsic_types(cache_dir: Path) -> list[dict]:
    fs = fetch(TYPESCRIPT_LIB_ES5_DTS_URL, cache_dir)
    src = fs.text
    out: list[dict] = []
    for m in re.finditer(r"^interface\s+([A-Z][A-Za-z0-9_]*)\b", src, re.MULTILINE):
        out.append({"name": m.group(1), "kind": "interface",
                    "source_url": TYPESCRIPT_LIB_ES5_DTS_URL})
    for m in re.finditer(r"^type\s+([A-Z][A-Za-z0-9_]*)\b", src, re.MULTILINE):
        out.append({"name": m.group(1), "kind": "type_alias",
                    "source_url": TYPESCRIPT_LIB_ES5_DTS_URL})
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
    """Direct declarations + named re-exports across one or more .d.ts files."""
    out: list[dict] = []
    for url in urls:
        fs = fetch(url, cache_dir)
        src = fs.text
        for m in ZOD_EXPORT_RE.finditer(src):
            out.append({
                "name": m.group(2),
                "kind": m.group(1),
                "version": version_label,
                "source_url": url,
            })
        for bm in ZOD_REEXPORT_BLOCK_RE.finditer(src):
            block = bm.group(2)
            for im in ZOD_REEXPORT_ITEM_RE.finditer(block):
                exported = im.group(2) or im.group(1)
                out.append({
                    "name": exported,
                    "kind": "reexport",
                    "version": version_label,
                    "source_url": url,
                })
    # Direct declarations win over re-exports of the same name.
    seen: set[tuple[str, str]] = set()
    deduped: list[dict] = []
    for it in out:
        if it["kind"] == "reexport":
            continue
        key = (it["kind"], it["name"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(it)
    direct_names = {it["name"] for it in deduped}
    for it in out:
        if it["kind"] != "reexport":
            continue
        if it["name"] in direct_names:
            continue
        key = (it["kind"], it["name"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(it)
    return deduped


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
    "required": ["name", "source", "source_url"],
    "properties": {
        "name":   {"type": "string"},
        "source": {"type": "string"},
        "type":   {"type": ["string", "null"]},
    },
    "additionalProperties": True,
}

OUTPUT_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://example.org/scrape-lexicons/v2/lexicons.schema.json",
    "title": "Cross-language schema/type lexicons (scrape_lexicons v2 output)",
    "type": "object",
    "required": ["metadata", "summary"],
    "additionalProperties": True,
    "properties": {
        "metadata": {
            "type": "object",
            "required": [
                "fetched_at", "tool", "sources", "source_provenance",
                "source_authority", "extraction_rules", "disclaimer",
            ],
            "properties": {
                "fetched_at": {"type": "string"},
                "tool":       {"type": "string"},
                "sources":    {"type": "object"},
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
        "typescript": {
            "type": "object",
            "properties": {
                "syntactic_constructs": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "source_url"],
                    "properties": {"name": {"type": "string"}},
                    "additionalProperties": True,
                }},
                "intrinsic_types": {"type": "array", "items": {
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
        "summary": {
            "type": "object",
            "additionalProperties": {"type": "integer"},
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
        "value-constraint schema."
    ),
    "xsd_elements": (
        "Every <xs:element name='...'/> declaration (top-level + nested) "
        "in the schema-for-schemas."
    ),
    "xsd_attributes": (
        "Every <xs:attribute name='...'/> declaration (top-level + nested) "
        "in the schema-for-schemas."
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
    "typescript_syntactic_constructs": (
        "Named, non-internal node types in tree-sitter-typescript's "
        "node-types.json."
    ),
    "typescript_intrinsic_types": (
        "Every ^interface Name and ^type Name declaration in TypeScript's "
        "lib.es5.d.ts."
    ),
    "zod_distribution_exports": (
        "Every ^export (declare )?(class|interface|type|function|const|enum) "
        "Name in each Zod .d.ts distribution file, plus named re-exports "
        "^export [type] { ... } from. Direct declarations win over "
        "re-exports of the same name."
    ),
}


def build_payload(cache_dir: Path) -> dict:
    keywords        = scrape_json_schema_keywords(cache_dir)
    elements, attrs = scrape_xsd_elements_and_attributes(cache_dir)
    datatypes       = scrape_xsd_datatypes(cache_dir)
    productions     = scrape_xsd_part2_productions(cache_dir)
    shacl_vocab     = scrape_shacl_core_vocabulary(cache_dir)
    shaclc_grammar  = scrape_shacl_compact_syntax_grammar(cache_dir)
    ts_syntactic    = scrape_typescript_syntactic_constructs(cache_dir)
    ts_intrinsic    = scrape_typescript_intrinsic_types(cache_dir)
    zod_v3          = scrape_zod_distribution(ZOD_V3_DTS_URLS, "v3", cache_dir)
    zod_v4          = scrape_zod_distribution(ZOD_V4_DTS_URLS, "v4", cache_dir)

    provenance = [
        {"url": fs.url, "sha256": fs.sha256, "byte_length": fs.byte_length}
        for fs in sorted(_PROVENANCE_REGISTRY.values(), key=lambda x: x.url)
    ]

    return {
        "metadata": {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "tool": "scrape_lexicons.py v2",
            "sources": {
                "json_schema_dialect": JSON_SCHEMA_DIALECT_URL,
                "json_schema_vocabularies": JSON_SCHEMA_VOCABULARIES,
                "xsd_1_1_part_1_xsd": XSD_PART1_XSD_URL,
                "xsd_1_1_part_2_xsd": XSD_PART2_XSD_URL,
                "xsd_1_1_part_2_html": XSD_PART2_HTML_URL,
                "shacl_core_ttl": SHACL_VOCAB_TTL_URL,
                "shacl_compact_syntax_html": SHACL_COMPACT_SYNTAX_URL,
                "typescript_tree_sitter_node_types":
                    TYPESCRIPT_TREE_SITTER_NODE_TYPES_URL,
                "typescript_lib_es5_dts": TYPESCRIPT_LIB_ES5_DTS_URL,
                "zod_v3_dts": list(ZOD_V3_DTS_URLS),
                "zod_v4_dts": list(ZOD_V4_DTS_URLS),
            },
            "source_provenance": provenance,
            "source_authority":  SOURCE_AUTHORITY,
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
        "json_schema_2020_12": {"keywords": keywords},
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
        "typescript": {
            "syntactic_constructs": ts_syntactic,
            "intrinsic_types": ts_intrinsic,
        },
        "zod_v3": {"exports": zod_v3},
        "zod_v4": {"exports": zod_v4},
        "summary": {
            "json_schema_keyword_count":             len(keywords),
            "json_schema_vocabulary_count":          len(JSON_SCHEMA_VOCABULARIES),
            "xsd_element_count":                     len(elements),
            "xsd_attribute_count":                   len(attrs),
            "xsd_datatype_count":                    len(datatypes),
            "xsd_datatype_production_count":         len(productions),
            "shacl_core_term_count":                 len(shacl_vocab),
            "shacl_compact_grammar_rule_count":      len(shaclc_grammar),
            "typescript_syntactic_construct_count":  len(ts_syntactic),
            "typescript_intrinsic_type_count":       len(ts_intrinsic),
            "zod_v3_export_count":                   len(zod_v3),
            "zod_v4_export_count":                   len(zod_v4),
            "source_count":                          len(provenance),
        },
    }


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
    print(
        f"[ok] wrote {out_path}:\n"
        f"     JSON Schema 2020-12 : {s['json_schema_keyword_count']} keywords\n"
        f"     XSD 1.1             : {s['xsd_element_count']} elements, "
        f"{s['xsd_attribute_count']} attributes, "
        f"{s['xsd_datatype_count']} datatypes, "
        f"{s['xsd_datatype_production_count']} productions\n"
        f"     SHACL               : {s['shacl_core_term_count']} core terms, "
        f"{s['shacl_compact_grammar_rule_count']} compact-syntax rules\n"
        f"     TypeScript          : {s['typescript_syntactic_construct_count']} "
        f"syntactic constructs, {s['typescript_intrinsic_type_count']} intrinsic types\n"
        f"     Zod v3              : {s['zod_v3_export_count']} public exports\n"
        f"     Zod v4              : {s['zod_v4_export_count']} public exports\n"
        f"     provenance          : {s['source_count']} sources hashed",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
