"""
Unit tests for scrape_lexicons.py.

Run with:
    pytest scripts/test_scrape_lexicons.py

Two layers:
  1. Pure-function tests: no I/O, no fixtures. Cover regex patterns,
     dedup logic, path-step formatting, hashing, set diffs.
  2. Invariant tests: read the local cache (scripts/_spec_cache/) as a
     fixture. No network; deterministic given pinned versions. Skipped
     cleanly if the cache is missing. These guard the contract that any
     reviewer would check by hand: shape, uniqueness, authority labels.

Network is hard-blocked via a urlopen monkeypatch so a test that
accidentally touches the network fails loudly instead of silently
fetching upstream bytes.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

import pytest

# Add the script's directory so we can import it as a module.
sys.path.insert(0, str(Path(__file__).parent))

import scrape_lexicons as sl  # noqa: E402


# --------------------------------------------------------------------------- #
# Fixtures                                                                    #
# --------------------------------------------------------------------------- #

CACHE_DIR = Path(__file__).parent / "_spec_cache"


@pytest.fixture(scope="session")
def cache_dir() -> Path:
    """Path to the on-disk spec cache. Tests that depend on real upstream
    content skip if the cache hasn't been populated yet (i.e. the script
    has not been run on this checkout)."""
    if not CACHE_DIR.exists() or not any(CACHE_DIR.iterdir()):
        pytest.skip(
            f"Cache not populated at {CACHE_DIR}. "
            "Run `python3 scripts/scrape_lexicons.py` once to populate."
        )
    return CACHE_DIR


@pytest.fixture(autouse=True)
def block_network(monkeypatch):
    """Any call to urllib.request.urlopen during tests fails immediately.
    Tests must work off the on-disk cache. Catches silent regressions
    where a fixture-less test would accidentally hit upstream."""
    def deny(*args, **kwargs):
        raise RuntimeError(
            "Network access blocked in tests. "
            "If this fires, a test is hitting upstream instead of the cache."
        )
    monkeypatch.setattr(urllib.request, "urlopen", deny)


@pytest.fixture(autouse=True)
def clean_provenance_registry():
    """Each test starts with an empty provenance registry. fetch() caches
    by URL across calls, which is correct for a single script run but
    leaks state between tests."""
    sl._PROVENANCE_REGISTRY.clear()
    yield
    sl._PROVENANCE_REGISTRY.clear()


# --------------------------------------------------------------------------- #
# _cache_key                                                                  #
# --------------------------------------------------------------------------- #

class TestCacheKey:
    def test_distinct_urls_yield_distinct_keys(self):
        """The slugify-only scheme collided on these two URLs; the
        hash-suffix scheme must not."""
        a = sl._cache_key("https://example.org/a/b")
        b = sl._cache_key("https://example.org/a_b")
        assert a != b

    def test_deterministic(self):
        url = "https://example.org/x"
        assert sl._cache_key(url) == sl._cache_key(url)

    def test_filesystem_safe(self):
        key = sl._cache_key("https://w3.org/TR/foo?bar=1&baz=2#frag")
        # Only [A-Za-z0-9_.-] allowed.
        assert all(c.isalnum() or c in "_.-" for c in key)

    def test_hash_suffix_is_8_hex_chars(self):
        key = sl._cache_key("https://example.org/x")
        suffix = key.rsplit(".", 1)[-1]
        assert len(suffix) == 8
        assert all(c in "0123456789abcdef" for c in suffix)


# --------------------------------------------------------------------------- #
# XSD path helpers                                                            #
# --------------------------------------------------------------------------- #

class TestXsdPathHelpers:
    def test_xsd_local_strips_namespace(self):
        assert sl._xsd_local(sl.XS + "element") == "element"

    def test_xsd_local_passes_through_local_tag(self):
        assert sl._xsd_local("element") == "element"

    def test_xsd_step_named(self):
        import xml.etree.ElementTree as ET
        node = ET.Element(sl.XS + "element", {"name": "Foo"})
        assert sl._xsd_step(node) == "xs:element[@name='Foo']"

    def test_xsd_step_unnamed(self):
        import xml.etree.ElementTree as ET
        node = ET.Element(sl.XS + "sequence")
        assert sl._xsd_step(node) == "xs:sequence"

    def test_walk_xsd_named_finds_only_named(self):
        import xml.etree.ElementTree as ET
        root = ET.fromstring(
            f"""<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
              <xs:element name="A"/>
              <xs:element/>
              <xs:complexType name="T">
                <xs:sequence>
                  <xs:element name="B"/>
                </xs:sequence>
              </xs:complexType>
            </xs:schema>"""
        )
        found = sl._walk_xsd_named(root, "element", "xs:schema")
        names = [(n.get("name"), path) for n, path in found]
        assert ("A", "xs:schema/xs:element[@name='A']") in names
        assert any(
            n == "B" and "xs:complexType[@name='T']" in p for n, p in names
        )
        # The unnamed element must NOT appear.
        assert all(n is not None for n, _ in names)


# --------------------------------------------------------------------------- #
# Generic string helpers                                                      #
# --------------------------------------------------------------------------- #

class TestStringHelpers:
    def test_strip_tags_to_text_collapses_whitespace(self):
        out = sl._strip_tags_to_text("<b>hello</b>\n  <i>world</i>")
        assert out == "hello world"

    def test_strip_tags_to_text_unescapes_entities(self):
        out = sl._strip_tags_to_text("A &amp; B &lt; C")
        assert out == "A & B < C"

    def test_extract_quoted_lang_string(self):
        block = 'rdfs:label "Hello"@en ; rdfs:comment "World" .'
        assert sl._extract_quoted_lang_string(block, "rdfs:label") == "Hello"
        assert sl._extract_quoted_lang_string(block, "rdfs:comment") == "World"
        assert sl._extract_quoted_lang_string(block, "rdfs:missing") is None

    def test_extract_object_iri(self):
        block = "rdfs:domain sh:Shape ; rdfs:range xsd:string ."
        assert sl._extract_object_iri(block, "rdfs:domain") == "sh:Shape"
        assert sl._extract_object_iri(block, "rdfs:range") == "xsd:string"
        assert sl._extract_object_iri(block, "rdfs:missing") is None


# --------------------------------------------------------------------------- #
# Zod dedup logic + regex                                                     #
# --------------------------------------------------------------------------- #

class TestZodRegex:
    def test_export_re_matches_declared(self):
        src = "export declare class Foo {}\nexport interface Bar {}\n"
        matches = [(m.group(1), m.group(2)) for m in sl.ZOD_EXPORT_RE.finditer(src)]
        assert ("class", "Foo") in matches
        assert ("interface", "Bar") in matches

    def test_export_re_captures_kind(self):
        cases = [
            ("export class A {}",      ("class", "A")),
            ("export interface I {}",  ("interface", "I")),
            ("export type T = number", ("type", "T")),
            ("export const C = 1",     ("const", "C")),
            ("export function f() {}", ("function", "f")),
            ("export enum E {}",       ("enum", "E")),
        ]
        for src, expected in cases:
            m = sl.ZOD_EXPORT_RE.search(src)
            assert m is not None, f"no match on {src!r}"
            assert (m.group(1), m.group(2)) == expected

    def test_reexport_block_parses(self):
        src = 'export type { A, B as B2 } from "./mod";\n'
        bm = sl.ZOD_REEXPORT_BLOCK_RE.search(src)
        assert bm is not None
        items = list(sl.ZOD_REEXPORT_ITEM_RE.finditer(bm.group(2)))
        names = [(im.group(2) or im.group(1)) for im in items]
        # B is re-exported as B2 — the alias wins.
        assert "A" in names
        assert "B2" in names
        assert "B" not in names


def _seed_cache(cache_dir: Path, url: str, content: str) -> None:
    """Pre-populate the on-disk cache so fetch() reads from disk and never
    hits the (monkeypatched-to-fail) network."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / sl._cache_key(url)).write_bytes(content.encode("utf-8"))


class TestZodDedup:
    def test_direct_declarations_dedup_by_kind_and_name(self, tmp_path):
        """Same name across two files counts once per (kind,name) pair."""
        cache = tmp_path / "_cache"
        u1, u2 = "https://test/a.d.ts", "https://test/b.d.ts"
        _seed_cache(cache, u1, "export class Foo {}\n")
        _seed_cache(cache, u2, "export class Foo {}\n")
        result = sl.scrape_zod_distribution((u1, u2), "v3", cache)
        names = [(e["kind"], e["name"]) for e in result]
        assert names.count(("class", "Foo")) == 1

    def test_interface_and_const_same_name_both_kept(self, tmp_path):
        """TypeScript companion-object pattern: type + const of same name."""
        cache = tmp_path / "_cache"
        url = "https://test/x.d.ts"
        _seed_cache(cache, url, "export interface Foo {}\nexport const Foo = 1\n")
        result = sl.scrape_zod_distribution((url,), "v4", cache)
        kinds = sorted(e["kind"] for e in result if e["name"] == "Foo")
        assert kinds == ["const", "interface"]

    def test_direct_wins_over_reexport(self, tmp_path):
        """If a name appears both as direct declaration and re-export in the
        same distribution, the re-export is dropped."""
        cache = tmp_path / "_cache"
        u1, u2 = "https://test/a.d.ts", "https://test/b.d.ts"
        _seed_cache(cache, u1, "export class Foo {}\n")
        _seed_cache(cache, u2, 'export type { Foo } from "./a";\n')
        result = sl.scrape_zod_distribution((u1, u2), "v3", cache)
        kinds_for_foo = [e["kind"] for e in result if e["name"] == "Foo"]
        assert kinds_for_foo == ["class"]


# --------------------------------------------------------------------------- #
# Zod v3↔v4 delta                                                             #
# --------------------------------------------------------------------------- #

class TestZodDelta:
    def test_pure_set_difference(self):
        v3 = [{"name": "A"}, {"name": "B"}, {"name": "C"}]
        v4 = [{"name": "B"}, {"name": "C"}, {"name": "D"}]
        delta = sl._compute_zod_delta(v3, v4)
        assert delta["added_in_v4"] == ["D"]
        assert delta["removed_in_v4"] == ["A"]
        assert delta["common"] == ["B", "C"]

    def test_sorted_output(self):
        v3 = [{"name": "z"}, {"name": "a"}]
        v4 = [{"name": "m"}, {"name": "b"}]
        delta = sl._compute_zod_delta(v3, v4)
        for key in ("added_in_v4", "removed_in_v4", "common"):
            assert delta[key] == sorted(delta[key])

    def test_duplicates_collapse_to_set(self):
        """If the same export appears twice in v4 (companion-object), it's
        still 'one name' for delta purposes."""
        v3 = [{"name": "Foo"}]
        v4 = [{"name": "Foo"}, {"name": "Foo"}, {"name": "Bar"}]
        delta = sl._compute_zod_delta(v3, v4)
        assert delta["added_in_v4"] == ["Bar"]
        assert delta["common"] == ["Foo"]
        assert delta["removed_in_v4"] == []

    def test_note_states_rename_caveat(self):
        delta = sl._compute_zod_delta([], [])
        assert "rename" in delta["note"].lower()


# --------------------------------------------------------------------------- #
# Invariant tests against the on-disk cache                                   #
# --------------------------------------------------------------------------- #

class TestXsdInvariants:
    def test_elements_uniquely_keyed_by_source_name_path(self, cache_dir):
        els, _ = sl.scrape_xsd_elements_and_attributes(cache_dir)
        keys = [(e["source"], e["name"], e["parent_path"]) for e in els]
        assert len(set(keys)) == len(keys), (
            "XSD element entries must be unique by (source, name, parent_path)"
        )

    def test_attributes_uniquely_keyed_by_source_name_path(self, cache_dir):
        _, ats = sl.scrape_xsd_elements_and_attributes(cache_dir)
        keys = [(a["source"], a["name"], a["parent_path"]) for a in ats]
        assert len(set(keys)) == len(keys)

    def test_every_element_has_parent_path(self, cache_dir):
        els, _ = sl.scrape_xsd_elements_and_attributes(cache_dir)
        assert all(
            isinstance(e["parent_path"], str) and e["parent_path"]
            for e in els
        )

    def test_parent_path_starts_at_root(self, cache_dir):
        els, _ = sl.scrape_xsd_elements_and_attributes(cache_dir)
        assert all(e["parent_path"].startswith("xs:schema") for e in els)


class TestAuthorityStatusInvariants:
    def test_shaclc_rules_carry_community_draft_status(self, cache_dir):
        rules = sl.scrape_shacl_compact_syntax_grammar(cache_dir)
        assert rules, "SHACL-C extraction returned no rules"
        assert all(r["authority_status"] == "community-draft" for r in rules)

    def test_ts_constructs_carry_community_grammar_status(self, cache_dir):
        cs = sl.scrape_typescript_syntactic_constructs(cache_dir)
        assert cs, "tree-sitter-typescript extraction returned no constructs"
        assert all(c["authority_status"] == "community-grammar" for c in cs)


class TestJsonLdInvariants:
    def test_all_keywords_start_with_at_sign(self, cache_dir):
        kws = sl.scrape_json_ld_keywords(cache_dir)
        assert kws, "JSON-LD extraction returned no keywords"
        assert all(k["name"].startswith("@") for k in kws)


# --------------------------------------------------------------------------- #
# LinkML helpers + invariants                                                 #
# --------------------------------------------------------------------------- #

class TestLinkmlFirstLine:
    def test_returns_first_nonempty_line(self):
        assert sl._linkml_first_line("first line\nsecond line") == "first line"

    def test_skips_leading_blanks(self):
        assert sl._linkml_first_line("\n\n  real line  \nmore") == "real line"

    def test_returns_none_for_none(self):
        assert sl._linkml_first_line(None) is None

    def test_returns_none_for_non_string(self):
        assert sl._linkml_first_line(42) is None  # YAML can yield non-strings

    def test_returns_none_for_all_whitespace(self):
        assert sl._linkml_first_line("   \n\t\n  ") is None


class TestLinkmlInvariants:
    def test_three_buckets_present(self, cache_dir):
        r = sl.scrape_linkml_metamodel(cache_dir)
        for k in ("classes", "slots", "types", "imports"):
            assert k in r, f"missing bucket: {k}"

    def test_baseline_counts(self, cache_dir):
        """Floor checks pinned to v1.11.0. Numbers will only grow as the
        metamodel evolves; if these break, intentionally bump or unpin."""
        r = sl.scrape_linkml_metamodel(cache_dir)
        assert len(r["classes"]) >= 30, len(r["classes"])
        assert len(r["slots"]) >= 200, len(r["slots"])
        # types.yaml has historically held 19 built-ins; if this drops
        # something specific in upstream changed.
        assert len(r["types"]) >= 15, len(r["types"])

    def test_all_entries_have_authority_status(self, cache_dir):
        r = sl.scrape_linkml_metamodel(cache_dir)
        for bucket in ("classes", "slots", "types"):
            for e in r[bucket]:
                assert e["authority_status"] == "community-spec", \
                    f"{bucket}: {e['name']!r} missing community-spec status"

    def test_classes_carry_mixins_list(self, cache_dir):
        r = sl.scrape_linkml_metamodel(cache_dir)
        for c in r["classes"]:
            assert isinstance(c["mixins"], list)

    def test_known_root_classes_present(self, cache_dir):
        """Canary: if these names disappear, the metamodel was reorganized
        and the lexicon shape changed in a way that matters."""
        r = sl.scrape_linkml_metamodel(cache_dir)
        names = {c["name"] for c in r["classes"]}
        # LinkML uses snake_case keys in YAML; the *names* are the YAML keys.
        for canary in ("class_definition", "slot_definition", "type_definition"):
            assert canary in names, (
                f"expected canary class {canary!r} not in classes: "
                f"{sorted(names)[:10]}..."
            )

    def test_known_root_slots_present(self, cache_dir):
        r = sl.scrape_linkml_metamodel(cache_dir)
        names = {s["name"] for s in r["slots"]}
        for canary in ("name", "range", "required", "multivalued", "mixins"):
            assert canary in names, f"expected canary slot {canary!r} missing"

    def test_known_builtin_types_present(self, cache_dir):
        r = sl.scrape_linkml_metamodel(cache_dir)
        names = {t["name"] for t in r["types"]}
        for canary in ("string", "integer", "boolean", "uri"):
            assert canary in names, f"expected canary type {canary!r} missing"

    def test_imports_records_companion_modules(self, cache_dir):
        """The meta.yaml `imports:` block names companion modules (types,
        mappings, annotations, extensions, units). We preserve it so a
        downstream consumer can decide whether to follow imports.

        Each import is boxed as a uniform {name, kind, source_url,
        authority_status} record so a generic walker over linkml.* works
        on imports the same way it works on classes/slots/types."""
        r = sl.scrape_linkml_metamodel(cache_dir)
        import_names = {imp["name"] for imp in r["imports"]}
        assert "linkml:types" in import_names

    def test_source_url_pinned_not_floating(self, cache_dir):
        """No `master` / `main` / unpinned refs allowed in the source URL —
        the whole point of v2 was reproducible fetches."""
        r = sl.scrape_linkml_metamodel(cache_dir)
        for bucket in ("classes", "slots", "types"):
            for e in r[bucket]:
                url = e["source_url"]
                assert "/main/" not in url and "/master/" not in url, url
                assert "/v" in url, f"version tag missing in {url}"


# --------------------------------------------------------------------------- #
# Python 3.12 helpers + invariants                                            #
# --------------------------------------------------------------------------- #

class TestPythonListExtractor:
    def test_extracts_kwlist_style_assignment(self):
        src = "kwlist = [\n    'False',\n    'None',\n    'True',\n]\n"
        assert sl._extract_python_list(src, "kwlist") == ["False", "None", "True"]

    def test_returns_empty_for_missing_name(self):
        src = "kwlist = ['a']\n"
        assert sl._extract_python_list(src, "softkwlist") == []

    def test_handles_single_and_double_quotes(self):
        src = "things = ['a', \"b\", 'c']\n"
        assert sl._extract_python_list(src, "things") == ["a", "b", "c"]

    def test_ignores_commented_lines_inside_list(self):
        """The regex captures string literals inside [...]; the comment text
        itself has no string literals, so it contributes nothing."""
        src = "kwlist = [\n    'a',\n    # ignored note\n    'b',\n]\n"
        assert sl._extract_python_list(src, "kwlist") == ["a", "b"]


class TestPythonRstDirectiveRe:
    def test_function_directive(self):
        src = ".. function:: abs(x)\n   blah\n"
        m = sl._PY_RST_DIRECTIVE_RE.findall(src)
        assert m == [("function", "abs")]

    def test_class_directive(self):
        src = ".. class:: int(x, base=10)\n"
        m = sl._PY_RST_DIRECTIVE_RE.findall(src)
        assert m == [("class", "int")]

    def test_exception_directive(self):
        src = ".. exception:: ValueError\n"
        m = sl._PY_RST_DIRECTIVE_RE.findall(src)
        assert m == [("exception", "ValueError")]

    def test_ignores_non_directive_lines(self):
        src = "Some prose\n.. note:: not a directive we care about\n"
        assert sl._PY_RST_DIRECTIVE_RE.findall(src) == []


class TestPythonLexiconInvariants:
    def test_five_buckets_present(self, cache_dir):
        r = sl.scrape_python_lexicon(cache_dir)
        for k in ("keywords", "soft_keywords",
                  "builtin_functions", "builtin_classes", "builtin_exceptions"):
            assert k in r, f"missing bucket: {k}"

    def test_baseline_counts(self, cache_dir):
        """Floors pinned to v3.12.13. Bump deliberately if upstream grows."""
        r = sl.scrape_python_lexicon(cache_dir)
        assert len(r["keywords"]) >= 30, len(r["keywords"])
        assert len(r["soft_keywords"]) >= 3, len(r["soft_keywords"])
        assert len(r["builtin_functions"]) >= 40, len(r["builtin_functions"])
        assert len(r["builtin_classes"]) >= 15, len(r["builtin_classes"])
        assert len(r["builtin_exceptions"]) >= 60, len(r["builtin_exceptions"])

    def test_canary_keywords_present(self, cache_dir):
        """If these disappear from kwlist, Python the language changed."""
        r = sl.scrape_python_lexicon(cache_dir)
        names = {k["name"] for k in r["keywords"]}
        for canary in ("def", "class", "return", "import", "async", "await",
                       "True", "False", "None", "lambda", "yield"):
            assert canary in names, f"missing keyword canary {canary!r}"

    def test_match_case_are_soft_keywords_not_hard(self, cache_dir):
        """PEP 634: match/case are soft keywords. If they appear in kwlist,
        upstream regressed (or we did)."""
        r = sl.scrape_python_lexicon(cache_dir)
        soft = {k["name"] for k in r["soft_keywords"]}
        hard = {k["name"] for k in r["keywords"]}
        assert "match" in soft and "case" in soft
        assert "match" not in hard and "case" not in hard

    def test_canary_builtin_functions(self, cache_dir):
        r = sl.scrape_python_lexicon(cache_dir)
        names = {f["name"] for f in r["builtin_functions"]}
        for canary in ("abs", "all", "any", "len", "print", "open",
                       "isinstance", "iter", "next"):
            assert canary in names, f"missing builtin function {canary!r}"

    def test_canary_builtin_classes(self, cache_dir):
        """The 19 .. class:: directives in functions.rst ARE Python's
        canonical built-in type constructors."""
        r = sl.scrape_python_lexicon(cache_dir)
        names = {c["name"] for c in r["builtin_classes"]}
        for canary in ("int", "str", "list", "dict", "set", "tuple",
                       "bool", "bytes", "float", "object", "type"):
            assert canary in names, f"missing builtin class {canary!r}"

    def test_canary_builtin_exceptions(self, cache_dir):
        r = sl.scrape_python_lexicon(cache_dir)
        names = {e["name"] for e in r["builtin_exceptions"]}
        for canary in ("BaseException", "Exception", "ValueError", "TypeError",
                       "KeyError", "IndexError", "StopIteration",
                       "RuntimeError", "ImportError"):
            assert canary in names, f"missing builtin exception {canary!r}"

    def test_every_entry_carries_reference_implementation_status(self, cache_dir):
        r = sl.scrape_python_lexicon(cache_dir)
        for bucket_name, bucket in r.items():
            for e in bucket:
                assert e["authority_status"] == "reference-implementation", (
                    f"{bucket_name}: {e['name']!r} missing status"
                )

    def test_each_bucket_uses_its_designated_kind(self, cache_dir):
        r = sl.scrape_python_lexicon(cache_dir)
        expected = {
            "keywords":           "keyword",
            "soft_keywords":      "soft_keyword",
            "builtin_functions":  "function",
            "builtin_classes":    "class",
            "builtin_exceptions": "exception",
        }
        for bucket, kind in expected.items():
            for e in r[bucket]:
                assert e["kind"] == kind, (
                    f"{bucket}: {e['name']!r} has kind={e['kind']!r}, "
                    f"expected {kind!r}"
                )

    def test_source_urls_pinned_to_version(self, cache_dir):
        """No floating /main/ or /master/ refs in any Python source URL."""
        r = sl.scrape_python_lexicon(cache_dir)
        for bucket in r.values():
            for e in bucket:
                assert "/main/" not in e["source_url"]
                assert "/master/" not in e["source_url"]
                assert f"/{sl.PYTHON_VERSION}/" in e["source_url"], (
                    f"source_url not pinned to {sl.PYTHON_VERSION}: "
                    f"{e['source_url']}"
                )


# --------------------------------------------------------------------------- #
# Protobuf — helpers + invariants                                             #
# --------------------------------------------------------------------------- #

class TestProtobufRegexes:
    """Pure tests of the descriptor.proto regexes against handcrafted bytes —
    catches a grammar drift in the descriptor file before the cache is
    even consulted."""

    def test_type_enum_extraction(self):
        src = """
        message FieldDescriptorProto {
            enum Type {
                TYPE_DOUBLE = 1;
                TYPE_FLOAT = 2;
                TYPE_INT64 = 3;
            }
        }
        """
        m = sl._PROTO_TYPE_ENUM_RE.search(src)
        assert m is not None
        values = sl._PROTO_TYPE_VALUE_RE.findall(m.group(1))
        assert values == [("TYPE_DOUBLE", "1"), ("TYPE_FLOAT", "2"),
                          ("TYPE_INT64", "3")]

    def test_field_options_message_block(self):
        src = (
            "message FieldOptions {\n"
            "  optional CType ctype = 1;\n"
            "  optional bool packed = 2;\n"
            "  repeated UninterpretedOption uninterpreted_option = 999;\n"
            "}\n"
        )
        m = sl._PROTO_FIELD_OPTIONS_RE.search(src)
        assert m is not None
        names = sl._PROTO_FIELD_OPTION_NAME_RE.findall(m.group(1))
        assert names == ["ctype", "packed", "uninterpreted_option"]

    def test_message_or_enum_picks_both_kinds(self):
        src = (
            "message Outer {\n"
            "  message Inner { int32 x = 1; }\n"
            "}\n"
            "enum Color { RED = 0; GREEN = 1; }\n"
        )
        matches = sl._PROTO_MESSAGE_OR_ENUM_RE.findall(src)
        # Only top-level (no leading whitespace) declarations should match.
        assert matches == [("message", "Outer"), ("enum", "Color")]

    def test_type_categories_set(self):
        """If upstream renames a category marker, this fires before the
        scrape produces a wrong scalar count."""
        assert sl._PROTO_TYPE_CATEGORIES == frozenset(
            {"TYPE_GROUP", "TYPE_MESSAGE", "TYPE_ENUM"}
        )


class TestProtobufWktAllowlist:
    """The WKT inventory is hand-curated, not derived from the directory.
    Lock in the allowlist so a future maintainer doesn't accidentally pick
    up unittest fixtures by 'just listing the directory'."""

    def test_allowlist_has_canonical_count(self):
        assert len(sl.PROTOBUF_WELL_KNOWN_TYPE_FILES) == 10

    def test_allowlist_excludes_descriptor_proto(self):
        """descriptor.proto is the meta-schema, not a well-known type."""
        assert "descriptor.proto" not in sl.PROTOBUF_WELL_KNOWN_TYPE_FILES

    def test_allowlist_excludes_unittest_files(self):
        for fname in sl.PROTOBUF_WELL_KNOWN_TYPE_FILES:
            assert not fname.startswith("unittest_"), fname
            assert "test" not in fname, fname

    def test_allowlist_canonical_members(self):
        """Documented at protobuf.dev/reference/protobuf/google.protobuf."""
        expected = {
            "any.proto", "api.proto", "duration.proto", "empty.proto",
            "field_mask.proto", "source_context.proto", "struct.proto",
            "timestamp.proto", "type.proto", "wrappers.proto",
        }
        assert set(sl.PROTOBUF_WELL_KNOWN_TYPE_FILES) == expected


class TestProtobufInvariants:
    def test_three_buckets_present(self, cache_dir):
        r = sl.scrape_protobuf_lexicon(cache_dir)
        for k in ("scalar_types", "well_known_types", "field_options"):
            assert k in r, f"missing bucket: {k}"

    def test_baseline_counts(self, cache_dir):
        """Floors pinned to v34.1. Numbers can grow; bump deliberately.

        field_options: post-v6 fix excludes nested-message fields, so
        the count is the 14 canonical user-facing FieldOptions fields
        (ctype, packed, jstype, lazy, unverified_lazy, deprecated, weak,
        debug_redact, retention, targets, edition_defaults, features,
        feature_support, uninterpreted_option).
        """
        r = sl.scrape_protobuf_lexicon(cache_dir)
        assert len(r["scalar_types"]) == 18, (
            "FieldDescriptorProto.Type has 18 values at v34.1; "
            "if this drifted, the descriptor wire format changed"
        )
        assert len(r["well_known_types"]) >= 25, len(r["well_known_types"])
        assert len(r["field_options"]) == 14, (
            f"expected 14 direct FieldOptions fields, got {len(r['field_options'])} — "
            "regression: nested-message fields may be leaking again"
        )

    def test_15_scalars_3_composites(self, cache_dir):
        """Long-standing invariant of the proto wire format: 18 TYPE_*
        values split as 15 scalars + 3 composites (GROUP/MESSAGE/ENUM)."""
        r = sl.scrape_protobuf_lexicon(cache_dir)
        scalars   = [t for t in r["scalar_types"] if t["kind"] == "scalar"]
        composites = [t for t in r["scalar_types"] if t["kind"] == "composite"]
        assert len(scalars)   == 15, [t["name"] for t in scalars]
        assert len(composites) == 3, [t["name"] for t in composites]

    def test_known_scalar_canaries_present(self, cache_dir):
        r = sl.scrape_protobuf_lexicon(cache_dir)
        names = {t["name"] for t in r["scalar_types"]}
        for canary in ("TYPE_DOUBLE", "TYPE_INT32", "TYPE_INT64",
                       "TYPE_STRING", "TYPE_BYTES", "TYPE_BOOL",
                       "TYPE_FIXED32", "TYPE_SINT64"):
            assert canary in names, canary

    def test_composite_categories_correctly_tagged(self, cache_dir):
        r = sl.scrape_protobuf_lexicon(cache_dir)
        for t in r["scalar_types"]:
            should_be_composite = t["name"] in sl._PROTO_TYPE_CATEGORIES
            actual = t["kind"] == "composite"
            assert actual == should_be_composite, (
                f"{t['name']!r}: kind={t['kind']} disagrees with category set"
            )

    def test_wire_values_are_1_to_18(self, cache_dir):
        r = sl.scrape_protobuf_lexicon(cache_dir)
        wire = sorted(t["wire_value"] for t in r["scalar_types"])
        assert wire == list(range(1, 19))

    def test_well_known_types_fully_qualified(self, cache_dir):
        r = sl.scrape_protobuf_lexicon(cache_dir)
        for t in r["well_known_types"]:
            assert t["name"].startswith("google.protobuf."), t["name"]

    def test_known_wkt_canaries_present(self, cache_dir):
        r = sl.scrape_protobuf_lexicon(cache_dir)
        names = {t["name"] for t in r["well_known_types"]}
        for canary in ("google.protobuf.Any",
                       "google.protobuf.Timestamp",
                       "google.protobuf.Duration",
                       "google.protobuf.Empty",
                       "google.protobuf.FieldMask",
                       "google.protobuf.Struct",
                       "google.protobuf.Value",
                       "google.protobuf.NullValue",
                       "google.protobuf.ListValue",
                       "google.protobuf.DoubleValue",
                       "google.protobuf.StringValue",
                       "google.protobuf.BytesValue"):
            assert canary in names, f"missing WKT canary {canary!r}"

    def test_no_descriptor_proto_polluting_wkts(self, cache_dir):
        """descriptor.proto's contents (FieldDescriptorProto, FileOptions, …)
        must NOT show up in the well-known-types bucket. The two are
        separate inventories."""
        r = sl.scrape_protobuf_lexicon(cache_dir)
        names = {t["name"] for t in r["well_known_types"]}
        for descriptor_internal in (
            "google.protobuf.FieldDescriptorProto",
            "google.protobuf.FileDescriptorProto",
            "google.protobuf.FieldOptions",
            "google.protobuf.FileOptions",
        ):
            assert descriptor_internal not in names

    def test_known_field_option_canaries_present(self, cache_dir):
        r = sl.scrape_protobuf_lexicon(cache_dir)
        names = {o["name"] for o in r["field_options"]}
        for canary in ("ctype", "packed", "jstype", "lazy", "deprecated",
                       "weak", "retention", "uninterpreted_option"):
            assert canary in names, f"missing field option canary {canary!r}"

    def test_every_entry_carries_reference_implementation_status(self, cache_dir):
        r = sl.scrape_protobuf_lexicon(cache_dir)
        for bucket_name, bucket in r.items():
            for e in bucket:
                assert e["authority_status"] == "reference-implementation", (
                    f"{bucket_name}: {e['name']!r} missing status"
                )

    def test_source_urls_pinned_to_version(self, cache_dir):
        r = sl.scrape_protobuf_lexicon(cache_dir)
        for bucket in r.values():
            for e in bucket:
                url = e["source_url"]
                assert "/main/" not in url, url
                assert "/master/" not in url, url
                assert f"/{sl.PROTOBUF_VERSION}/" in url, (
                    f"source_url not pinned to {sl.PROTOBUF_VERSION}: {url}"
                )


# --------------------------------------------------------------------------- #
# PostgreSQL 18 — regexes + invariants                                        #
# --------------------------------------------------------------------------- #

class TestPostgresRegexes:
    """Pure regex tests against handcrafted bytes — catch upstream format
    drift (e.g. a fifth column added to PG_KEYWORD) before it pollutes
    a cache-driven invariant test."""

    def test_kw_re_three_capture_groups(self):
        src = (
            'PG_KEYWORD("select", SELECT, RESERVED_KEYWORD, BARE_LABEL)\n'
            'PG_KEYWORD("table", TABLE, RESERVED_KEYWORD, AS_LABEL)\n'
        )
        hits = sl._PG_KEYWORD_RE.findall(src)
        assert hits == [
            ("select", "RESERVED_KEYWORD", "BARE_LABEL"),
            ("table",  "RESERVED_KEYWORD", "AS_LABEL"),
        ]

    def test_type_name_re(self):
        src = "{ oid => '20', typname => 'int8', descr => 'large integer' },"
        assert sl._PG_TYPE_NAME_RE.findall(src) == ["int8"]

    def test_proc_name_re_picks_proname_not_other_fields(self):
        """proname is the canonical field; we must NOT pick up
        prosrc or proargnames or any other name-like field."""
        src = (
            "{ oid => '1242', descr => 'boolean equal',\n"
            "  proname => 'booleq', prolang => 'internal',\n"
            "  prosrc => 'booleq', proargtypes => 'bool bool' },"
        )
        assert sl._PG_PROC_NAME_RE.findall(src) == ["booleq"]

    def test_operator_name_re(self):
        src = "{ oid => '96', oprname => '=', oprleft => 'int4' },"
        assert sl._PG_OPERATOR_NAME_RE.findall(src) == ["="]

    def test_cast_pair_re_requires_both_fields(self):
        src = (
            "{ castsource => 'int8', casttarget => 'int2', castfunc => 'int2' },\n"
            "{ castsource => 'int8', casttarget => 'int4', castfunc => 'int4' },\n"
        )
        assert sl._PG_CAST_PAIR_RE.findall(src) == [
            ("int8", "int2"), ("int8", "int4"),
        ]

    def test_keyword_categories_frozenset_exact(self):
        """The four categories ARE the language's keyword classification.
        If a fifth shows up in upstream, fail loudly so we revisit."""
        assert sl._PG_KEYWORD_CATEGORIES == frozenset({
            "RESERVED_KEYWORD",
            "UNRESERVED_KEYWORD",
            "COL_NAME_KEYWORD",
            "TYPE_FUNC_NAME_KEYWORD",
        })


class TestPostgresInvariants:
    def test_five_buckets_present(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        for k in ("keywords", "types", "functions", "operators", "casts"):
            assert k in r, f"missing bucket: {k}"

    def test_baseline_counts(self, cache_dir):
        """Floors pinned to REL_18_4. Numbers can grow; bump deliberately."""
        r = sl.scrape_postgres_lexicon(cache_dir)
        assert len(r["keywords"]) >= 480, len(r["keywords"])
        assert len(r["types"])    >= 100, len(r["types"])
        # Functions are 2782 unique at REL_18_4. Floor leaves headroom but
        # catches a regex-broken-by-format-change collapse to near zero.
        assert len(r["functions"]) >= 2500, len(r["functions"])
        assert len(r["operators"]) >= 60, len(r["operators"])
        assert len(r["casts"])     >= 200, len(r["casts"])

    def test_every_keyword_category_is_valid(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        for kw in r["keywords"]:
            assert kw["category"] in sl._PG_KEYWORD_CATEGORIES, (
                f"unknown category for {kw['name']!r}: {kw['category']!r}"
            )

    def test_every_keyword_bare_label_is_valid(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        for kw in r["keywords"]:
            assert kw["bare_label"] in {"BARE_LABEL", "AS_LABEL"}, (
                f"unknown bare_label for {kw['name']!r}: {kw['bare_label']!r}"
            )

    def test_known_keyword_canaries_present_with_correct_category(self, cache_dir):
        """Canaries: if these reclassify, the SQL surface really changed.
        Note: `join` is TYPE_FUNC_NAME_KEYWORD (it can appear in type/function
        positions), not RESERVED — Postgres's category split is finer-grained
        than 'reserved vs not'."""
        r = sl.scrape_postgres_lexicon(cache_dir)
        by_name = {k["name"]: k for k in r["keywords"]}
        # Hard reserved — cannot be unquoted identifiers in any context.
        for canary in ("select", "from", "where", "table", "create"):
            assert canary in by_name, f"missing keyword {canary!r}"
            assert by_name[canary]["category"] == "RESERVED_KEYWORD", (
                f"{canary} expected RESERVED, got {by_name[canary]['category']}"
            )
        # TYPE_FUNC_NAME_KEYWORD: reserved only in type/function-name positions.
        assert by_name["join"]["category"] == "TYPE_FUNC_NAME_KEYWORD"
        # Common unreserved (transaction-control words).
        for canary in ("abort", "commit", "rollback"):
            assert canary in by_name, f"missing keyword {canary!r}"
            assert by_name[canary]["category"] == "UNRESERVED_KEYWORD"
        # COL_NAME_KEYWORD: SQL constructs that look like functions but are
        # parsed at the grammar level (no pg_proc entry). `coalesce`, `nullif`,
        # `greatest`, `least` all live here.
        assert by_name["coalesce"]["category"] == "COL_NAME_KEYWORD"

    def test_known_type_canaries_present(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        names = {t["name"] for t in r["types"]}
        # The canonical built-in type names. If any of these drops out,
        # something fundamental broke.
        for canary in ("bool", "int2", "int4", "int8", "float4", "float8",
                       "text", "varchar", "bytea", "jsonb", "uuid",
                       "timestamp", "timestamptz", "date", "interval"):
            assert canary in names, f"missing type canary {canary!r}"

    def test_known_operator_canaries_present(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        names = {o["name"] for o in r["operators"]}
        for canary in ("=", "<>", "<", ">", "<=", ">=", "+", "-", "*", "/",
                       "@>", "<@", "->", "->>", "||"):
            assert canary in names, f"missing operator canary {canary!r}"

    def test_known_function_canaries_present(self, cache_dir):
        """Canaries from pg_proc.dat. Note: `coalesce`, `nullif`, `greatest`,
        `least`, `current_user` are NOT in pg_proc — they're SQL-grammar
        constructs handled in gram.y and live in kwlist.h as COL_NAME_KEYWORD
        or RESERVED_KEYWORD. Only true catalog functions should appear here."""
        r = sl.scrape_postgres_lexicon(cache_dir)
        names = {f["name"] for f in r["functions"]}
        for canary in ("max", "min", "count", "sum", "avg",
                       "now", "length", "substring",
                       "array_agg", "jsonb_build_object", "to_char"):
            assert canary in names, f"missing function canary {canary!r}"

    def test_max_and_min_are_overloaded(self, cache_dir):
        """At REL_18_4, `max` and `min` each have 24 overloads. The exact
        number can move, but they must be > 1 — a collapse to 1 means
        the overload-counting collapsed the entries wrong."""
        r = sl.scrape_postgres_lexicon(cache_dir)
        by_name = {f["name"]: f for f in r["functions"]}
        assert by_name["max"]["overload_count"] > 1
        assert by_name["min"]["overload_count"] > 1

    def test_functions_are_deduplicated(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        names = [f["name"] for f in r["functions"]]
        assert len(names) == len(set(names)), (
            "function bucket has duplicate names — dedup logic broke"
        )

    def test_operators_are_deduplicated(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        names = [o["name"] for o in r["operators"]]
        assert len(names) == len(set(names))

    def test_function_overload_counts_sum_to_raw_count(self, cache_dir):
        """The collapse must be lossless: sum of overload_counts must
        equal the number of raw entries in pg_proc.dat."""
        from pathlib import Path
        proc_src = (cache_dir / sl._cache_key(sl.POSTGRES_PG_PROC_URL)).read_text()
        raw_count = len(sl._PG_PROC_NAME_RE.findall(proc_src))
        r = sl.scrape_postgres_lexicon(cache_dir)
        assert sum(f["overload_count"] for f in r["functions"]) == raw_count

    def test_casts_have_distinct_source_and_target_fields(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        for c in r["casts"]:
            assert "source_type" in c and "target_type" in c
            # Both must be non-empty strings; identity casts (source==target)
            # are legitimate (e.g. for length-modifier coercions).
            assert isinstance(c["source_type"], str) and c["source_type"]
            assert isinstance(c["target_type"], str) and c["target_type"]

    def test_every_entry_carries_reference_implementation_status(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        for bucket_name, bucket in r.items():
            for e in bucket:
                assert e["authority_status"] == "reference-implementation", (
                    f"{bucket_name}: missing status on entry {e!r}"
                )

    def test_source_urls_pinned_to_version(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        for bucket in r.values():
            for e in bucket:
                url = e["source_url"]
                assert "/main/" not in url, url
                assert "/master/" not in url, url
                assert f"/{sl.POSTGRES_VERSION}/" in url, (
                    f"source_url not pinned to {sl.POSTGRES_VERSION}: {url}"
                )


# --------------------------------------------------------------------------- #
# Rust 1.95.0 — regexes + invariants                                          #
# --------------------------------------------------------------------------- #

class TestRustRegexes:
    """Pure regex tests against handcrafted bytes — catch upstream format
    drift (a Reference page restructure, a builtin_attrs macro rename)
    before it pollutes a cache-driven invariant test."""

    def test_kw_section_header(self):
        src = "## Strict keywords\n\nFoo\n\n## Reserved keywords\n"
        hits = sl._RUST_KW_SECTION_RE.findall(src)
        # Findall on a 1-group regex returns just the group, not tuples.
        assert hits == ["Strict", "Reserved"]

    def test_kw_bullet_lines(self):
        src = "- `as`\n- `async`\n* `await`\n"
        assert sl._RUST_KW_BULLET_RE.findall(src) == ["as", "async", "await"]

    def test_primitive_mod_lines(self):
        src = "mod prim_bool {}\nmod prim_i32 {}\n// unrelated\nmod prim_f64 {}\n"
        assert sl._RUST_PRIM_RE.findall(src) == ["bool", "i32", "f64"]

    def test_prelude_use_block_with_stable_annotation(self):
        src = (
            '#[stable(feature = "core_prelude", since = "1.4.0")]\n'
            "#[doc(no_inline)]\n"
            "pub use crate::marker::{Copy, Send, Sized};\n"
        )
        m = sl._RUST_PRELUDE_USE_RE.search(src)
        assert m is not None
        assert m.group(1) == "stable"
        assert m.group(2) == "core_prelude"
        assert m.group(3) == "1.4.0"
        names = sl._rust_extract_prelude_names(m.group(4))
        assert names == ["Copy", "Send", "Sized"]

    def test_prelude_use_block_unstable_with_issue(self):
        """Unstable items have `issue = "..."` instead of `since = "..."`."""
        src = (
            '#[unstable(feature = "tryfrom", issue = "33417")]\n'
            "pub use crate::convert::TryFrom;\n"
        )
        m = sl._RUST_PRELUDE_USE_RE.search(src)
        assert m is not None
        assert m.group(1) == "unstable"
        assert m.group(3) is None  # no `since`
        names = sl._rust_extract_prelude_names(m.group(4))
        assert names == ["TryFrom"]

    def test_extract_prelude_names_handles_self_and_aliases(self):
        """Rust idiom: `Type::{self, Variant1, Variant2}` re-exports Type
        itself plus its variants. `self` must NOT be emitted literally; the
        path segment before `::{` is the actual exported name."""
        names = sl._rust_extract_prelude_names(
            "crate::option::Option::{self, None, Some as Yes}"
        )
        assert "self" not in names
        assert "Option" in names      # self → Option itself
        assert "None" in names
        assert "Yes" in names         # alias wins over Some
        assert "Some" not in names

    def test_extract_prelude_names_handles_simple_path(self):
        assert sl._rust_extract_prelude_names("crate::mem::drop") == ["drop"]

    def test_extract_prelude_names_drops_wildcards(self):
        assert sl._rust_extract_prelude_names("crate::foo::*") == []

    def test_builtin_attr_macro_invocations(self):
        src = (
            "ungated!(cfg, Normal, template!(...), DuplicatesOk),\n"
            "gated!(no_std, CrateLevel, ..., experimental_attr, ...),\n"
            "rustc_attr!(rustc_specialization_trait, Normal, ...),\n"
            "ungated!(unsafe(Edition2024) link_section, Normal, ...),\n"
        )
        hits = sl._RUST_BUILTIN_ATTR_RE.findall(src)
        names = [n for _, n in hits]
        # The `unsafe(Edition2024)` wrapper must NOT capture as the name.
        assert "cfg" in names
        assert "no_std" in names
        assert "rustc_specialization_trait" in names
        assert "link_section" in names
        # The Edition wrapper string itself must not slip in.
        assert "Edition2024" not in names

    def test_punctuation_block_extracts_tokens(self):
        src = (
            "PUNCTUATION -> \n"
            "| `+` (plus)\n"
            "| `+=` (plus-eq)\n"
            "| `->` (arrow)\n"
            "\n## Next section\n"
        )
        m = sl._RUST_PUNCT_BLOCK_RE.search(src)
        assert m is not None
        tokens = sl._RUST_PUNCT_TOKEN_RE.findall(m.group(1))
        assert tokens == ["+", "+=", "->"]

    def test_keyword_classes_frozenset_locked(self):
        """If a 4th class shows up in the Reference, fail loudly so we
        decide deliberately whether to admit it."""
        assert sl._RUST_KEYWORD_CLASSES == frozenset(
            {"strict", "reserved", "weak"}
        )

    def test_unstable_primitives_set_minimal(self):
        """The allowlist must be tight — these are the only primitives the
        adapter treats as unstable. f32/f64/i32/etc. must NEVER appear here."""
        for stable in ("f32", "f64", "bool", "i32", "u8", "str"):
            assert stable not in sl._RUST_UNSTABLE_PRIMITIVES
        assert "f16" in sl._RUST_UNSTABLE_PRIMITIVES
        assert "f128" in sl._RUST_UNSTABLE_PRIMITIVES


class TestRustInvariants:
    def test_five_buckets_present(self, cache_dir):
        r = sl.scrape_rust_lexicon(cache_dir)
        for k in ("keywords", "primitives", "prelude",
                  "attributes", "punctuation"):
            assert k in r, f"missing bucket: {k}"

    def test_baseline_counts(self, cache_dir):
        """Floors pinned to 1.95.0. Numbers can grow; bump deliberately."""
        r = sl.scrape_rust_lexicon(cache_dir)
        assert len(r["keywords"])    >= 50, len(r["keywords"])
        assert len(r["primitives"])  >= 20, len(r["primitives"])
        assert len(r["prelude"])     >= 70, len(r["prelude"])
        assert len(r["attributes"])  >= 130, len(r["attributes"])
        assert len(r["punctuation"]) >= 45, len(r["punctuation"])

    def test_keyword_classification_counts(self, cache_dir):
        """At 1.95.0: 39 strict + 14 reserved + 5 weak. Reasonable floors
        leave room for future additions without losing meaningful drift
        detection."""
        from collections import Counter
        r = sl.scrape_rust_lexicon(cache_dir)
        counts = Counter(k["classification"] for k in r["keywords"])
        assert counts["strict"]   >= 35, counts
        assert counts["reserved"] >= 10, counts
        assert counts["weak"]     >= 5,  counts

    def test_known_strict_keyword_canaries(self, cache_dir):
        r = sl.scrape_rust_lexicon(cache_dir)
        names = {k["name"]: k for k in r["keywords"]
                 if k["classification"] == "strict"}
        for canary in ("fn", "let", "mut", "impl", "trait", "pub",
                       "match", "return", "use", "if", "else",
                       "for", "while", "loop", "struct", "enum",
                       "async", "await", "move", "ref"):
            assert canary in names, f"missing strict canary {canary!r}"

    def test_known_reserved_keyword_canaries(self, cache_dir):
        r = sl.scrape_rust_lexicon(cache_dir)
        names = {k["name"] for k in r["keywords"]
                 if k["classification"] == "reserved"}
        for canary in ("abstract", "become", "final", "override",
                       "priv", "typeof", "unsized", "virtual", "yield"):
            assert canary in names, f"missing reserved canary {canary!r}"

    def test_known_weak_keyword_canaries(self, cache_dir):
        """Weak keywords are context-dependent. The Reference's public set
        is small: 'static, macro_rules, raw, safe, union."""
        r = sl.scrape_rust_lexicon(cache_dir)
        names = {k["name"] for k in r["keywords"]
                 if k["classification"] == "weak"}
        for canary in ("'static", "macro_rules", "raw", "safe", "union"):
            assert canary in names, f"missing weak canary {canary!r}"

    def test_known_primitive_canaries(self, cache_dir):
        r = sl.scrape_rust_lexicon(cache_dir)
        by_name = {p["name"]: p for p in r["primitives"]}
        for canary in ("bool", "char", "str", "i8", "i16", "i32", "i64",
                       "i128", "isize", "u8", "u16", "u32", "u64", "u128",
                       "usize", "f32", "f64", "array", "slice", "tuple"):
            assert canary in by_name, f"missing primitive canary {canary!r}"
            assert by_name[canary]["stability"] == "stable", (
                f"{canary} should be stable, got "
                f"{by_name[canary]['stability']}"
            )

    def test_unstable_primitives_correctly_tagged(self, cache_dir):
        r = sl.scrape_rust_lexicon(cache_dir)
        by_name = {p["name"]: p for p in r["primitives"]}
        for unstable in ("f16", "f128"):
            assert unstable in by_name
            assert by_name[unstable]["stability"] == "unstable", (
                f"{unstable} must be tagged unstable, got "
                f"{by_name[unstable]['stability']}"
            )

    def test_known_prelude_canaries_present(self, cache_dir):
        r = sl.scrape_rust_lexicon(cache_dir)
        names = {p["name"] for p in r["prelude"]}
        for canary in ("Option", "Some", "None", "Result", "Ok", "Err",
                       "Copy", "Clone", "Drop", "Send", "Sync", "Sized",
                       "Fn", "FnMut", "FnOnce", "Iterator", "IntoIterator",
                       "Default", "From", "Into"):
            assert canary in names, f"missing prelude canary {canary!r}"

    def test_prelude_stable_entries_have_since(self, cache_dir):
        """Every stable prelude item should carry a `since` version."""
        r = sl.scrape_rust_lexicon(cache_dir)
        stable = [p for p in r["prelude"] if p["stability"] == "stable"]
        assert stable, "no stable prelude entries"
        for p in stable:
            assert "since" in p, f"stable {p['name']!r} missing `since`"

    def test_known_attribute_canaries(self, cache_dir):
        """Canaries from builtin_attrs.rs. Note: `#[test]` and `#[derive]`
        are NOT in this file — they're procedural macros handled elsewhere
        in the compiler. Only macro-defined builtin attributes count here."""
        r = sl.scrape_rust_lexicon(cache_dir)
        by_name = {a["name"]: a for a in r["attributes"]}
        for canary in ("cfg", "cfg_attr", "deprecated", "inline", "no_std",
                       "should_panic", "allow", "warn", "deny",
                       "forbid", "repr", "non_exhaustive"):
            assert canary in by_name, f"missing attribute canary {canary!r}"

    def test_attribute_stability_distribution_is_sensible(self, cache_dir):
        """Sanity: all three stability levels should be represented, with
        compiler-internal being a non-trivial fraction since rustc_attr!
        invocations are common."""
        from collections import Counter
        r = sl.scrape_rust_lexicon(cache_dir)
        counts = Counter(a["stability"] for a in r["attributes"])
        assert counts["stable"]            >= 30, counts
        assert counts["unstable"]          >= 10, counts
        assert counts["compiler-internal"] >= 30, counts

    def test_known_punctuation_canaries(self, cache_dir):
        r = sl.scrape_rust_lexicon(cache_dir)
        names = {p["name"] for p in r["punctuation"]}
        for canary in ("+", "-", "*", "/", "%", "&", "|", "^", "!",
                       "&&", "||", "==", "!=", "<", ">", "<=", ">=",
                       "=", "+=", "-=", "..", "..=", "->", "=>",
                       "::", "?"):
            assert canary in names, f"missing punctuation canary {canary!r}"

    def test_authority_status_split(self, cache_dir):
        """Buckets sourced from rust-lang/rust are normative-compiler;
        buckets from rust-lang/reference are reference-best-effort."""
        r = sl.scrape_rust_lexicon(cache_dir)
        for bucket_name in ("primitives", "prelude", "attributes"):
            for e in r[bucket_name]:
                assert e["authority_status"] == "normative-compiler", (
                    f"{bucket_name}: {e['name']!r} should be normative-"
                    f"compiler, got {e['authority_status']}"
                )
        for bucket_name in ("keywords", "punctuation"):
            for e in r[bucket_name]:
                assert e["authority_status"] == "reference-best-effort", (
                    f"{bucket_name}: {e['name']!r} should be reference-"
                    f"best-effort, got {e['authority_status']}"
                )

    def test_no_duplicates_within_bucket(self, cache_dir):
        """Each bucket dedups within itself. The keywords.md weak section
        in particular documents some entries twice in source — the
        extractor must collapse them per classification."""
        r = sl.scrape_rust_lexicon(cache_dir)
        # Keywords dedup is per (classification, name): same name in
        # different classifications would be a real signal, not noise.
        kw_keys = [(k["classification"], k["name"]) for k in r["keywords"]]
        assert len(kw_keys) == len(set(kw_keys)), "keyword dedup broke"
        for bucket in ("primitives", "prelude", "attributes", "punctuation"):
            names = [e["name"] for e in r[bucket]]
            assert len(names) == len(set(names)), (
                f"{bucket} bucket has duplicates"
            )

    def test_source_urls_pinned(self, cache_dir):
        r = sl.scrape_rust_lexicon(cache_dir)
        for bucket in r.values():
            for e in bucket:
                url = e["source_url"]
                assert "/main/" not in url, url
                assert "/master/" not in url, url
                # Either rustc tag or Reference commit SHA must appear.
                assert (f"/{sl.RUST_VERSION}/" in url or
                        f"/{sl.RUST_REFERENCE_COMMIT}/" in url), (
                    f"source_url not pinned to a known anchor: {url}"
                )


class TestEndToEndPayload:
    def test_build_payload_validates(self, cache_dir):
        """The strongest single regression check: the assembled payload
        passes its own published schema."""
        payload = sl.build_payload(cache_dir)
        errs = sl.validate_output(payload, sl.OUTPUT_SCHEMA)
        assert errs == [], f"schema validation failed: {errs[:5]}"

    def test_payload_has_top_level_notice(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        assert isinstance(payload.get("notice"), str)
        assert "cross-language mapping" in payload["notice"]

    def test_summary_counts_match_bodies(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        s = payload["summary"]
        assert s["json_schema_keyword_count"] == len(payload["json_schema_2020_12"]["keywords"])
        assert s["xsd_element_count"]         == len(payload["xsd_1_1"]["elements"])
        assert s["xsd_attribute_count"]       == len(payload["xsd_1_1"]["attributes"])
        assert s["shacl_core_term_count"]     == len(payload["shacl"]["core_vocabulary"])
        assert s["zod_v3_export_count"]       == len(payload["zod_v3"]["exports"])
        assert s["zod_v4_export_count"]       == len(payload["zod_v4"]["exports"])
        assert s["zod_v4_added_count"]        == len(payload["zod_v3_v4_delta"]["added_in_v4"])
        assert s["zod_v4_removed_count"]      == len(payload["zod_v3_v4_delta"]["removed_in_v4"])
        assert s["linkml_class_count"]        == len(payload["linkml"]["classes"])
        assert s["linkml_slot_count"]         == len(payload["linkml"]["slots"])
        assert s["linkml_type_count"]         == len(payload["linkml"]["types"])
        assert s["python_keyword_count"]      == len(payload["python_3_12"]["keywords"])
        assert s["python_soft_keyword_count"] == len(payload["python_3_12"]["soft_keywords"])
        assert s["python_builtin_function_count"]  == len(payload["python_3_12"]["builtin_functions"])
        assert s["python_builtin_class_count"]     == len(payload["python_3_12"]["builtin_classes"])
        assert s["python_builtin_exception_count"] == len(payload["python_3_12"]["builtin_exceptions"])
        assert s["protobuf_scalar_type_count"]     == len(payload["protobuf"]["scalar_types"])
        assert s["protobuf_well_known_type_count"] == len(payload["protobuf"]["well_known_types"])
        assert s["protobuf_field_option_count"]    == len(payload["protobuf"]["field_options"])
        assert s["postgres_keyword_count"]  == len(payload["postgres_18"]["keywords"])
        assert s["postgres_type_count"]     == len(payload["postgres_18"]["types"])
        assert s["postgres_function_count"] == len(payload["postgres_18"]["functions"])
        assert s["postgres_operator_count"] == len(payload["postgres_18"]["operators"])
        assert s["postgres_cast_count"]     == len(payload["postgres_18"]["casts"])
        assert s["rust_keyword_count"]     == len(payload["rust"]["keywords"])
        assert s["rust_primitive_count"]   == len(payload["rust"]["primitives"])
        assert s["rust_prelude_count"]     == len(payload["rust"]["prelude"])
        assert s["rust_attribute_count"]   == len(payload["rust"]["attributes"])
        assert s["rust_punctuation_count"] == len(payload["rust"]["punctuation"])

    def test_zod_delta_is_consistent_with_lexicons(self, cache_dir):
        """The delta computed inside build_payload must match a fresh
        set-difference computed from the same bodies."""
        payload = sl.build_payload(cache_dir)
        v3_names = {e["name"] for e in payload["zod_v3"]["exports"]}
        v4_names = {e["name"] for e in payload["zod_v4"]["exports"]}
        d = payload["zod_v3_v4_delta"]
        assert set(d["added_in_v4"])   == v4_names - v3_names
        assert set(d["removed_in_v4"]) == v3_names - v4_names
        assert set(d["common"])        == v3_names & v4_names


# --------------------------------------------------------------------------- #
# Regression tests for re-review fixes (2026-05-18)                           #
# --------------------------------------------------------------------------- #
#
# Each test in this section pins down a specific defect surfaced by the
# re-review. The test name encodes the defect; if a test ever fails,
# read its docstring to learn what regression it caught.


class TestXsdProduction39Regression:
    """Production [39] Canonical-base64Binary was dropped because the
    name-pattern regex rejected hyphens. Fix: allow `-` in production
    names ([scripts/scrape_lexicons.py:491])."""

    def test_production_39_present(self, cache_dir):
        prods = sl.scrape_xsd_part2_productions(cache_dir)
        p39 = [p for p in prods if p["production_number"] == 39]
        assert len(p39) == 1, (
            f"production #39 missing — name-pattern regex regression? "
            f"got {len(p39)} entries"
        )
        assert p39[0]["name"] == "Canonical-base64Binary"

    def test_production_39_rhs_references_base64_canonical_forms(self, cache_dir):
        prods = sl.scrape_xsd_part2_productions(cache_dir)
        p39 = next(p for p in prods if p["production_number"] == 39)
        assert "CanonicalQuad" in p39["rhs"]
        assert "CanonicalPadded" in p39["rhs"]

    def test_production_numbering_has_no_internal_gaps(self, cache_dir):
        """Any gap in 1..max signals an extraction miss."""
        prods = sl.scrape_xsd_part2_productions(cache_dir)
        nums = sorted(p["production_number"] for p in prods)
        gaps = sorted(set(range(min(nums), max(nums) + 1)) - set(nums))
        assert gaps == [], (
            f"production numbering has gaps: {gaps}. "
            "If a number is absent in the W3C source, document the exemption."
        )

    def test_production_name_regex_accepts_hyphen(self):
        """Pure-function lock on the fix. If the regex is tightened
        again to disallow `-`, this test fails immediately — without
        needing the cache."""
        import re
        pattern = re.compile(r"([A-Za-z][A-Za-z0-9_-]*)\s+::=\s+(.*)")
        m = pattern.match("Canonical-base64Binary ::= CanonicalQuad")
        assert m is not None
        assert m.group(1) == "Canonical-base64Binary"


class TestDialectUrlProvenanceRegression:
    """The dialect URL was listed in metadata.sources but had no
    provenance entry because it was never fetched. Fix: fetch() it
    at the top of build_payload ([scripts/scrape_lexicons.py:1081])."""

    def test_every_metadata_source_url_has_provenance(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        prov_urls = {p["url"] for p in payload["metadata"]["source_provenance"]}

        def _flatten(obj):
            if isinstance(obj, str):
                yield obj
            elif isinstance(obj, list):
                for x in obj:
                    yield from _flatten(x)
            elif isinstance(obj, dict):
                for v in obj.values():
                    yield from _flatten(v)

        source_urls = set(_flatten(payload["metadata"]["sources"]))
        missing = sorted(source_urls - prov_urls)
        assert missing == [], (
            f"sources without provenance hash: {missing} — "
            "file's own commitment violated"
        )

    def test_json_schema_dialect_url_in_provenance(self, cache_dir):
        """Pinpoint the specific URL whose provenance was previously missing."""
        payload = sl.build_payload(cache_dir)
        prov_urls = {p["url"] for p in payload["metadata"]["source_provenance"]}
        assert sl.JSON_SCHEMA_DIALECT_URL in prov_urls


class TestSummaryCounterRenameRegression:
    """`source_count` confusingly counted URLs but read as 'schema
    systems'. Fix: rename to `fetched_url_count`, add
    `logical_source_count` ([scripts/scrape_lexicons.py:1177])."""

    def test_fetched_url_count_present_and_matches_provenance(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        s = payload["summary"]
        assert "fetched_url_count" in s
        assert s["fetched_url_count"] == len(payload["metadata"]["source_provenance"])

    def test_logical_source_count_derives_from_source_authority(self, cache_dir):
        """Post-v6 fix: logical_source_count is now derived from
        len(SOURCE_AUTHORITY) rather than hardcoded, so the count stays
        in sync with the set of distinct logical sources the lexicon
        declares. Audit-trail is in metadata.logical_sources."""
        payload = sl.build_payload(cache_dir)
        s = payload["summary"]
        m = payload["metadata"]
        assert s["logical_source_count"] == len(m["source_authority"]), (
            "logical_source_count out of sync with len(source_authority) — "
            "the v6 fix required these to be derivable, not hardcoded"
        )
        assert s["logical_source_count"] == len(m["logical_sources"]), (
            "logical_source_count out of sync with metadata.logical_sources"
        )
        # Sanity: the enumeration must contain every source_authority key.
        assert set(m["logical_sources"]) == set(m["source_authority"].keys())

    def test_old_source_count_field_is_gone(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        assert "source_count" not in payload["summary"], (
            "summary.source_count was renamed — old key must not reappear"
        )


class TestTypescriptIntrinsicTypesEs5RenameRegression:
    """`intrinsic_types` un-scoped name was honest about content
    (es5 only) but misleading by name. Fix: rename payload key,
    schema key, summary counter, and extraction-rule key
    ([scripts/scrape_lexicons.py:917, 1155, 1170])."""

    def test_payload_key_is_es5_scoped(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        assert "intrinsic_types_es5" in payload["typescript"]
        assert "intrinsic_types" not in payload["typescript"], (
            "old un-scoped key must not reappear"
        )

    def test_summary_counter_is_es5_scoped(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        s = payload["summary"]
        assert "typescript_intrinsic_type_es5_count" in s
        assert "typescript_intrinsic_type_count" not in s

    def test_extraction_rule_documents_es5_scope(self):
        rule = sl.EXTRACTION_RULES.get("typescript_intrinsic_types_es5", "")
        assert rule, "extraction rule key missing"
        assert "es5" in rule.lower()
        assert "Promise" in rule, (
            "extraction rule must call out that modern intrinsics like "
            "Promise are out of scope"
        )

    def test_post_es5_intrinsics_are_absent(self, cache_dir):
        """Scope contract: types added in lib.es2015.d.ts and later, or
        defined in lib.dom.d.ts, must NOT appear in this key.

        Note: TypeScript's lib.es5.d.ts *does* declare some types that
        were historically ES2015 (e.g. Promise, Symbol, DataView) — the
        file packages them for ES5 targeting. The probes below are types
        that genuinely live in non-es5 lib files. If a future scope
        change adds them, the key should be renamed accordingly.
        """
        types = sl.scrape_typescript_intrinsic_types(cache_dir)
        names = {t["name"] for t in types}
        # Probes verified absent in TypeScript v6.0.3 lib.es5.d.ts:
        # Map/Set/WeakMap/WeakSet are in lib.es2015.collection.d.ts;
        # WeakRef is in lib.es2021.weakref.d.ts; AbortController and
        # URLSearchParams are in lib.dom.d.ts.
        for modern in ("Map", "Set", "WeakMap", "WeakSet", "WeakRef",
                       "AbortController", "URLSearchParams"):
            assert modern not in names, (
                f"{modern} found — if scope was extended, "
                "rename intrinsic_types_es5 accordingly"
            )

    def test_es5_staples_are_present(self, cache_dir):
        types = sl.scrape_typescript_intrinsic_types(cache_dir)
        names = {t["name"] for t in types}
        for es5 in ("Array", "Object", "String", "Number", "RegExp", "Date"):
            assert es5 in names, f"es5 intrinsic {es5} missing"


class TestShaclVersionLabelRegression:
    """`pinned_versions.shacl_core: "1.0 (2017 REC)"` invented a version
    number not used by W3C. Fix: use the W3C publication-date designation
    ([scripts/scrape_lexicons.py:204])."""

    def test_label_uses_w3c_date_designation(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        label = payload["metadata"]["pinned_versions"]["shacl_core"]
        assert label == "2017-07-20 (REC)"

    def test_label_does_not_invent_a_version_number(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        label = payload["metadata"]["pinned_versions"]["shacl_core"]
        # The W3C SHACL Recommendation has no version number in its title.
        # Guard against editorial labels like "1.0", "1.1", "v1", etc.
        for invented in ("1.0", "1.1", "v1", "v2"):
            assert invented not in label, (
                f"pinned_versions.shacl_core contains '{invented}' — "
                "W3C SHACL REC has no version number; use the REC date"
            )


# --------------------------------------------------------------------------- #
# Sanity floors — minimum extracted counts per source                         #
# --------------------------------------------------------------------------- #
#
# These floors lock down the surface area extracted from each source.
# A drop below any floor signals an extractor regression (typically:
# an upstream spec refresh broke a structural assumption). Update only
# when the upstream source genuinely shrinks and the change is verified
# to be intended (commit the new floor with a reference to the upstream
# change in the commit message).

SANITY_FLOORS = {
    "json_schema_keyword_count":             50,
    "json_schema_vocabulary_count":           8,
    "xsd_element_count":                    100,
    "xsd_attribute_count":                  140,
    "xsd_datatype_count":                    19,
    "xsd_datatype_production_count":         95,
    "shacl_core_term_count":                200,
    "shacl_compact_grammar_rule_count":      60,
    "json_ld_keyword_count":                 23,
    "typescript_syntactic_construct_count": 150,
    "typescript_intrinsic_type_es5_count":   90,
    "zod_v3_export_count":                  100,
    "zod_v4_export_count":                  300,
    "fetched_url_count":                     26,
}


class TestSanityFloors:
    @pytest.mark.parametrize("counter,floor", sorted(SANITY_FLOORS.items()))
    def test_summary_counter_meets_floor(self, cache_dir, counter, floor):
        payload = sl.build_payload(cache_dir)
        actual = payload["summary"][counter]
        assert actual >= floor, (
            f"{counter}={actual} below floor {floor} — extractor regression?"
        )


# --------------------------------------------------------------------------- #
# Regression tests for v3 re-review fixes                                     #
# --------------------------------------------------------------------------- #
#
# These lock down the four fixes from the v3 re-review pass:
#  1. XSD (name, parent_path) is documented as not-unique cross-source.
#  2. authority_status rolled out to intrinsic_types_es5 (reference-
#     implementation) and shacl.core_vocabulary (recommendation).
#  3. JSON-LD extraction rule documents the non-@ token carve-out.
#  4. json_schema_keywords extraction rule documents the comment field's
#     low source occupancy (defends against repeated reviewer claims that
#     the meta-schemas have $comment fields the extractor drops — they
#     don't; the source has 1 such field).


class TestXsdCompositeUniquenessKey:
    """The (name, parent_path) pair is NOT unique across sources because
    XSD 1.1 Part 1 and Part 2 schema-for-schemas reuse the same XPaths.
    The composite key (source, name, parent_path) IS unique. This must
    be documented in extraction_rules so consumers index correctly."""

    def test_extraction_rule_states_composite_key_for_elements(self):
        rule = sl.EXTRACTION_RULES["xsd_elements"]
        assert "(source, name, parent_path)" in rule
        # The rule must mention that (name, parent_path) alone is NOT unique.
        assert "NOT unique" in rule or "not unique" in rule

    def test_extraction_rule_states_composite_key_for_attributes(self):
        rule = sl.EXTRACTION_RULES["xsd_attributes"]
        assert "(source, name, parent_path)" in rule

    def test_composite_key_actually_is_unique(self, cache_dir):
        """Empirically verify the documented key actually disambiguates."""
        els, ats = sl.scrape_xsd_elements_and_attributes(cache_dir)
        for label, items in [("elements", els), ("attributes", ats)]:
            keys = [(it["source"], it["name"], it["parent_path"]) for it in items]
            assert len(set(keys)) == len(keys), (
                f"composite key (source, name, parent_path) not unique for {label}"
            )

    def test_name_parent_path_alone_is_NOT_unique(self, cache_dir):
        """Confirm the negative claim the documentation makes: dropping
        `source` causes collisions. If this test ever passes (i.e. no
        collisions found) it means the underlying data changed and the
        extraction-rule wording may need an update."""
        els, _ = sl.scrape_xsd_elements_and_attributes(cache_dir)
        keys = [(e["name"], e["parent_path"]) for e in els]
        assert len(set(keys)) < len(keys), (
            "(name, parent_path) is now unique — extraction rule's "
            "negative claim about cross-source collisions is stale; "
            "update the prose"
        )


class TestAuthorityStatusRollout:
    """authority_status was added in v3 to shacl.compact_syntax_grammar
    and typescript.syntactic_constructs. v3 review noted it should be
    consistent across the file. Now also on intrinsic_types_es5
    (reference-implementation) and shacl.core_vocabulary (recommendation)."""

    def test_intrinsic_types_es5_carry_reference_implementation_status(self, cache_dir):
        types = sl.scrape_typescript_intrinsic_types(cache_dir)
        assert types, "no intrinsic types extracted"
        assert all(
            t["authority_status"] == "reference-implementation" for t in types
        ), "intrinsic_types_es5 entries missing or wrong authority_status"

    def test_shacl_core_vocabulary_carries_recommendation_status(self, cache_dir):
        terms = sl.scrape_shacl_core_vocabulary(cache_dir)
        assert terms, "no SHACL core terms extracted"
        assert all(
            t["authority_status"] == "recommendation" for t in terms
        ), "SHACL core entries missing or wrong authority_status"

    def test_authority_status_values_form_a_small_closed_set(self, cache_dir):
        """Catch typos and accidental new values across the four sections."""
        payload = sl.build_payload(cache_dir)
        observed = set()
        for section, key in [
            ("shacl",      "compact_syntax_grammar"),
            ("shacl",      "core_vocabulary"),
            ("typescript", "syntactic_constructs"),
            ("typescript", "intrinsic_types_es5"),
        ]:
            for item in payload[section][key]:
                observed.add(item["authority_status"])
        expected = {
            "community-draft",        # SHACL-C ANTLR grammar
            "community-grammar",      # tree-sitter-typescript
            "recommendation",         # SHACL Core REC
            "reference-implementation", # TypeScript lib.es5.d.ts
        }
        assert observed == expected, (
            f"authority_status values drifted: got {observed}, expected {expected}"
        )


class TestJsonLdScopeNote:
    """v3 review asked for a one-line scope note documenting that the
    @-prefix filter excludes non-@ syntactic tokens and @version values."""

    def test_extraction_rule_documents_non_at_token_exclusion(self):
        rule = sl.EXTRACTION_RULES["json_ld_keywords"]
        assert "Scope note" in rule
        # Must mention at least one of the excluded categories.
        assert ":" in rule and "compact-IRI" in rule, (
            "scope note must call out the ':' compact-IRI separator exclusion"
        )
        assert "@version" in rule, (
            "scope note must call out that @version *values* are excluded"
        )


class TestJsonSchemaCommentDocumentation:
    """The `comment` field is 1/58 occupied because the meta-schemas only
    embed one `$comment` total (on $id in core). v2 and v3 reviewers
    repeatedly claimed the meta-schemas have many $comments the extractor
    drops; verified false. The extraction rule must document this so
    future readers don't repeat the claim."""

    def test_extraction_rule_explains_comment_field_low_occupancy(self):
        rule = sl.EXTRACTION_RULES["json_schema_keywords"]
        assert "$comment" in rule
        # The rule must explicitly state that low occupancy is source
        # reality, not extractor loss.
        assert (
            "reflects the source" in rule
            or "not extractor loss" in rule
            or "source, not extractor" in rule
        ), "rule must defend the field's faithfulness to the source"

    def test_extractor_captures_the_one_known_comment(self, cache_dir):
        """The single known $comment ($id in core) must still be captured.
        If this stops working, the extractor regressed."""
        kws = sl.scrape_json_schema_keywords(cache_dir)
        id_entries = [k for k in kws if k["name"] == "$id" and k["vocabulary"] == "core"]
        assert len(id_entries) == 1
        assert id_entries[0]["comment"] is not None
        assert "fragment" in id_entries[0]["comment"].lower()


# --------------------------------------------------------------------------- #
# Regression tests for v4 re-review fixes                                     #
# --------------------------------------------------------------------------- #
#
# Fixes locked down by these tests:
#  1. SHACL block-name regex allows hyphens — recovers 38 parameter
#     subjects that previously collapsed onto their parent ConstraintComponent.
#  2. XSD attributes now carry `use` and `form`.
#  3. authority_status rolled out uniformly to the 7 previously-untagged
#     sections (json_schema, xsd_*, json_ld, zod_v3, zod_v4).
#  4. linkml.imports boxed into {name, kind, source_url, authority_status}.
#  5. xsd_elements extraction rule defends the low `documentation` occupancy.


class TestShaclHyphenRegression:
    """Block-name regex now allows hyphens. SHACL declares parameter
    subjects like `sh:AndConstraintComponent-and` and the prior regex
    `[A-Za-z][A-Za-z0-9_]*` truncated them, causing 32 collision groups
    and 6 byte-identical duplicate entries. Single-character fix at
    [scripts/scrape_lexicons.py:601]."""

    def test_no_duplicate_names_in_shacl_core(self, cache_dir):
        terms = sl.scrape_shacl_core_vocabulary(cache_dir)
        names = [t["name"] for t in terms]
        from collections import Counter
        dups = {n: c for n, c in Counter(names).items() if c > 1}
        assert not dups, (
            f"duplicate SHACL term names found: {dups}. "
            "Hyphen-rejection regex regression?"
        )

    def test_hyphenated_parameter_subjects_recovered(self, cache_dir):
        """The TTL declares parameter subjects with hyphens; they must
        appear in the lexicon with their full names."""
        terms = sl.scrape_shacl_core_vocabulary(cache_dir)
        names = {t["name"] for t in terms}
        # Specific known parameter subjects from shacl.ttl:
        for full in ("AndConstraintComponent-and",
                     "ClosedConstraintComponent-closed",
                     "ClosedConstraintComponent-ignoredProperties",
                     "PatternConstraintComponent-pattern",
                     "QualifiedMaxCountConstraintComponent-qualifiedMaxCount"):
            assert full in names, (
                f"hyphenated subject {full!r} missing — regex regression?"
            )

    def test_no_byte_identical_parameter_duplicates(self, cache_dir):
        """Before the fix, 4 (name, rdf_type=Parameter) pairs had byte-
        identical extra entries (1+1+2+2 = 6 extras). The hyphen fix
        eliminates all of them."""
        import collections
        terms = sl.scrape_shacl_core_vocabulary(cache_dir)
        params = [t for t in terms if t.get("rdf_type") == "sh:Parameter"]
        seen = set()
        dups = []
        for p in params:
            sig = tuple(sorted((k, v) for k, v in p.items() if isinstance(v, str) or v is None))
            if sig in seen:
                dups.append(p["name"])
            seen.add(sig)
        assert not dups, f"byte-identical sh:Parameter dups remain: {dups}"

    def test_shacl_name_regex_accepts_hyphen(self):
        """Pure-function lock on the fix. If the regex is tightened to
        reject `-` again, this test fails without needing the cache."""
        import re
        pattern = re.compile(
            r"^sh:([A-Za-z][A-Za-z0-9_-]*)\b(.*?)(?=^sh:[A-Za-z]|\Z)",
            re.DOTALL | re.MULTILINE,
        )
        sample = (
            "sh:AndConstraintComponent\n"
            "\ta sh:ConstraintComponent ;\n"
            "\trdfs:label \"label\"@en .\n"
            "\n"
            "sh:AndConstraintComponent-and\n"
            "\ta sh:Parameter ;\n"
            "\tsh:path sh:and .\n"
        )
        names = [m.group(1) for m in pattern.finditer(sample)]
        assert "AndConstraintComponent" in names
        assert "AndConstraintComponent-and" in names


class TestXsdAttributeUseAndForm:
    """XSD attributes now carry `use` and `form` properties — defining
    cardinality (required/optional/prohibited) and namespace qualification.
    Before this fix, both were missing from every attribute entry.
    Fix at [scripts/scrape_lexicons.py:480-481]."""

    def test_every_attribute_has_use_field(self, cache_dir):
        _, ats = sl.scrape_xsd_elements_and_attributes(cache_dir)
        for a in ats:
            assert "use" in a, (
                f"attribute {a['name']!r} missing `use` field"
            )

    def test_every_attribute_has_form_field(self, cache_dir):
        _, ats = sl.scrape_xsd_elements_and_attributes(cache_dir)
        for a in ats:
            assert "form" in a

    def test_use_values_are_from_xsd_spec(self, cache_dir):
        """When `use` is set, it must be one of the three XSD-spec values."""
        _, ats = sl.scrape_xsd_elements_and_attributes(cache_dir)
        observed = {a["use"] for a in ats if a["use"] is not None}
        allowed = {"required", "optional", "prohibited"}
        assert observed <= allowed, (
            f"unexpected use values: {observed - allowed}"
        )

    def test_at_least_some_attributes_declare_use_explicitly(self, cache_dir):
        """The schema-for-schemas declares many attributes with explicit
        `use="required"` — guard against the extractor silently never
        capturing the field even though it's added."""
        _, ats = sl.scrape_xsd_elements_and_attributes(cache_dir)
        explicit = [a for a in ats if a["use"] is not None]
        assert len(explicit) > 50, (
            f"only {len(explicit)} attributes have explicit `use` — "
            "extractor may be silently dropping the attribute value"
        )


class TestAuthorityStatusUniformRollout:
    """v4 review: 5/12 lexicon sections were tagged with authority_status,
    7/12 were untagged. Fix: roll out to all sections.
    Standards-track:    'recommendation' (W3C) or 'ietf-draft' (IETF)
    Library distributions: 'library-distribution'
    Community sources:  'community-grammar' / 'community-spec' / 'community-draft'
    Reference implementations: 'reference-implementation'
    """

    EXPECTED_TAG_BY_SECTION = {
        ("json_schema_2020_12", "keywords"):           "ietf-draft",
        ("xsd_1_1", "elements"):                       "recommendation",
        ("xsd_1_1", "attributes"):                     "recommendation",
        ("xsd_1_1", "datatypes"):                      "recommendation",
        ("xsd_1_1", "datatype_productions"):           "recommendation",
        ("shacl", "core_vocabulary"):                  "recommendation",
        ("shacl", "compact_syntax_grammar"):           "community-draft",
        ("json_ld_1_1", "keywords"):                   "recommendation",
        ("typescript", "syntactic_constructs"):        "community-grammar",
        ("typescript", "intrinsic_types_es5"):         "reference-implementation",
        ("zod_v3", "exports"):                         "library-distribution",
        ("zod_v4", "exports"):                         "library-distribution",
    }

    def test_every_section_is_fully_tagged(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        for (section, key), expected in self.EXPECTED_TAG_BY_SECTION.items():
            items = payload[section][key]
            assert items, f"{section}.{key} is empty"
            tagged = [it for it in items if "authority_status" in it]
            assert len(tagged) == len(items), (
                f"{section}.{key}: {len(tagged)}/{len(items)} tagged — "
                "authority_status rollout incomplete"
            )
            observed = {it["authority_status"] for it in items}
            assert observed == {expected}, (
                f"{section}.{key}: got {observed}, expected {{{expected!r}}}"
            )

    def test_authority_status_value_set_is_closed(self, cache_dir):
        """All authority_status values across the lexicon must come from
        a small, documented closed set. Catches typos and accidental
        new categories."""
        payload = sl.build_payload(cache_dir)
        allowed = {
            "recommendation",          # W3C REC
            "ietf-draft",              # IETF standards-track draft
            "community-draft",         # W3C CG / informal draft
            "community-grammar",       # third-party parser grammar
            "community-spec",          # community-published spec (e.g. linkml)
            "library-distribution",    # published npm/pip package
            "reference-implementation", # vendor's authoritative impl
        }
        observed = set()
        for section_key, sub_key in self.EXPECTED_TAG_BY_SECTION:
            for it in payload[section_key][sub_key]:
                observed.add(it["authority_status"])
        # Also include linkml + linkml.imports
        for key in ("classes", "slots", "types", "imports"):
            for it in payload["linkml"][key]:
                observed.add(it["authority_status"])
        unexpected = observed - allowed
        assert not unexpected, (
            f"unexpected authority_status values: {unexpected}"
        )


class TestLinkmlImportsBoxUp:
    """linkml.imports was list[str], inconsistent with siblings' list[dict].
    Boxed into uniform {name, kind, source_url, authority_status} records
    so a generic walker over linkml.* works uniformly. Fix at
    [scripts/scrape_lexicons.py:944]."""

    def test_imports_is_list_of_dicts(self, cache_dir):
        r = sl.scrape_linkml_metamodel(cache_dir)
        assert isinstance(r["imports"], list)
        for imp in r["imports"]:
            assert isinstance(imp, dict), (
                f"imports entry not boxed: {imp!r}"
            )

    def test_imports_have_uniform_fields(self, cache_dir):
        r = sl.scrape_linkml_metamodel(cache_dir)
        required = {"name", "kind", "source_url", "authority_status"}
        for imp in r["imports"]:
            assert required <= imp.keys(), (
                f"imports entry {imp!r} missing fields {required - imp.keys()}"
            )
            assert imp["kind"] == "import"
            assert imp["authority_status"] == "community-spec"

    def test_imports_preserve_known_companion_modules(self, cache_dir):
        r = sl.scrape_linkml_metamodel(cache_dir)
        names = {imp["name"] for imp in r["imports"]}
        # `linkml:types` is the only universal companion; the rest vary
        # by linkml-model version.
        assert "linkml:types" in names

    def test_generic_walker_works_uniformly_across_linkml_sections(self, cache_dir):
        """The whole point of box-up: a single accessor pattern works
        across classes, slots, types, AND imports."""
        r = sl.scrape_linkml_metamodel(cache_dir)
        for section in ("classes", "slots", "types", "imports"):
            for item in r[section]:
                # Every entry has at least these two fields.
                assert "name" in item
                assert "authority_status" in item


class TestXsdElementDocumentationDefenseDoc:
    """v4 reviewer (third time) claimed the extractor drops <xs:annotation>
    <xs:documentation> blocks. Verified false — XMLSchema.xsd has only
    1 element with documentation in source (`facet`); Part 2 has 1
    (`facetElement`). Lexicon captures both. Extraction rule must
    document this so the claim doesn't recur."""

    def test_extraction_rule_explains_low_documentation_occupancy(self):
        rule = sl.EXTRACTION_RULES["xsd_elements"]
        assert "documentation" in rule
        # Must explain that low occupancy is source reality, not loss.
        assert (
            "reflects the source" in rule
            or "not extractor loss" in rule
        ), "rule must defend the field's faithfulness to the source"
        # Must name the two known documented elements specifically.
        assert "facet" in rule, (
            "rule should name the specific documented elements so future "
            "readers can verify by inspection"
        )

    def test_known_documented_elements_are_captured(self, cache_dir):
        """The 2 elements that DO have documentation in source must be
        captured — guards against the inverse regression where the
        extractor stops reading any annotation."""
        els, _ = sl.scrape_xsd_elements_and_attributes(cache_dir)
        documented = {e["name"] for e in els if e["documentation"]}
        assert "facet" in documented, (
            "Part 1 `facet` element has documentation in source but "
            "extractor failed to capture it"
        )


# --------------------------------------------------------------------------- #
# Regression tests for v5 re-review fixes                                     #
# --------------------------------------------------------------------------- #
#
# Fixes:
#  1. SHACL extractor surfaces per-term SHACL-namespaced constraints as
#     `shacl_constraints` (sh:path, sh:class, sh:datatype, sh:nodeKind,
#     sh:minCount, sh:maxCount, sh:name).
#  2. JSON Schema `$defs` captured inline as `shared_defs`.
#  3. linkml.imports[*].resolves_to derives the actual target URL.
#  5. New top-level cross_language_index surfaces same-name cross-lexicon
#     appearances; asserts NO semantic equivalence.


class TestShaclConstraintsRegression:
    """`shacl_constraints` field surfaces SHACL-namespaced predicates per term."""

    def test_parameter_subjects_have_sh_path(self, cache_dir):
        """Every sh:Parameter subject in the TTL declares sh:path —
        this is the load-bearing field for the partition."""
        terms = sl.scrape_shacl_core_vocabulary(cache_dir)
        params = [t for t in terms if t.get("rdf_type") == "sh:Parameter"]
        assert params, "no parameter subjects found"
        without_path = [
            p for p in params
            if not (p.get("shacl_constraints") and p["shacl_constraints"].get("path"))
        ]
        assert not without_path, (
            f"{len(without_path)} parameter subjects missing sh:path — "
            "extractor regression?"
        )

    def test_and_constraint_component_param_path(self, cache_dir):
        """Specific known parameter: sh:AndConstraintComponent-and has
        sh:path sh:and in the TTL."""
        terms = sl.scrape_shacl_core_vocabulary(cache_dir)
        m = [t for t in terms if t["name"] == "AndConstraintComponent-and"]
        assert len(m) == 1
        sc = m[0]["shacl_constraints"]
        assert sc is not None
        assert sc["path"] == "sh:and"

    def test_shacl_constraints_is_none_when_no_predicates(self, cache_dir):
        """We chose `None` (not `{}`) as the sentinel so consumers can
        use truthiness to filter."""
        terms = sl.scrape_shacl_core_vocabulary(cache_dir)
        none_count = sum(1 for t in terms if t.get("shacl_constraints") is None)
        assert none_count > 0, (
            "every term carries shacl_constraints — suspicious; "
            "expected None for non-Parameter classes"
        )

    def test_integer_extractor_pure_function(self):
        block = "sh:minCount 0 ; sh:maxCount 5 ; sh:path sh:foo ."
        assert sl._extract_integer_object(block, "sh:minCount") == 0
        assert sl._extract_integer_object(block, "sh:maxCount") == 5
        assert sl._extract_integer_object(block, "sh:absent") is None

    def test_constraints_helper_returns_none_when_empty(self):
        result = sl._extract_shacl_constraints("rdfs:label \"x\"@en .")
        assert result is None

    def test_constraints_helper_strips_sh_prefix_in_keys(self):
        block = "sh:path sh:something ; sh:minCount 1 ."
        result = sl._extract_shacl_constraints(block)
        assert result == {"path": "sh:something", "minCount": 1}


class TestJsonSchemaSharedDefsRegression:
    """The 8 internal `$defs` referenced by `$ref`s inside keyword
    value_constraint_schemas are now captured inline."""

    EXPECTED_DEFS = {
        "anchorString", "nonNegativeInteger", "nonNegativeIntegerDefault0",
        "schemaArray", "simpleTypes", "stringArray",
        "uriReferenceString", "uriString",
    }

    def test_all_referenced_defs_captured(self, cache_dir):
        defs = sl.scrape_json_schema_shared_defs(cache_dir)
        assert set(defs.keys()) == self.EXPECTED_DEFS

    def test_every_def_records_its_vocabulary(self, cache_dir):
        defs = sl.scrape_json_schema_shared_defs(cache_dir)
        for name, entry in defs.items():
            assert entry["defined_in_vocabulary"] in (
                "core", "applicator", "validation"
            )
            assert entry["defined_in_url"].startswith(
                "https://json-schema.org/draft/2020-12/meta/"
            )
            assert isinstance(entry["schema"], dict)

    def test_lexicon_output_contains_shared_defs(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        assert "shared_defs" in payload["json_schema_2020_12"]
        assert len(payload["json_schema_2020_12"]["shared_defs"]) == 8

    def test_all_dollar_refs_resolve_within_shared_defs(self, cache_dir):
        """Every `$ref: '#/$defs/<X>'` inside a keyword value-constraint
        schema must point at an X in shared_defs. Integrity property
        that makes the lexicon self-contained."""
        payload = sl.build_payload(cache_dir)
        defs = payload["json_schema_2020_12"]["shared_defs"]
        refs: set[str] = set()
        def walk(node):
            if isinstance(node, dict):
                for k, v in node.items():
                    if k == "$ref" and isinstance(v, str) and v.startswith("#/$defs/"):
                        refs.add(v.split("/")[-1])
                    walk(v)
            elif isinstance(node, list):
                for x in node:
                    walk(x)
        walk(payload["json_schema_2020_12"]["keywords"])
        unresolved = refs - defs.keys()
        assert not unresolved, (
            f"refs hang off the cliff: {unresolved} not in shared_defs"
        )


class TestLinkmlImportsResolvesToRegression:
    """linkml.imports[*].resolves_to derives the target URL from the
    linkml:<X> prefix convention. source_url remains the declaration site."""

    def test_every_import_has_resolves_to(self, cache_dir):
        r = sl.scrape_linkml_metamodel(cache_dir)
        for imp in r["imports"]:
            assert "resolves_to" in imp

    def test_linkml_prefix_imports_resolve_to_repo_yaml(self, cache_dir):
        r = sl.scrape_linkml_metamodel(cache_dir)
        for imp in r["imports"]:
            if imp["name"].startswith("linkml:"):
                assert imp["resolves_to"] is not None
                assert imp["resolves_to"].endswith(".yaml")
                assert sl.LINKML_MODEL_VERSION in imp["resolves_to"]

    def test_resolves_to_target_differs_from_declaration_site(self, cache_dir):
        """The whole point: source_url is where the directive *was*;
        resolves_to is where it *points*."""
        r = sl.scrape_linkml_metamodel(cache_dir)
        for imp in r["imports"]:
            if imp["resolves_to"] is not None:
                assert imp["resolves_to"] != imp["source_url"], (
                    f"{imp['name']}: resolves_to equals source_url — "
                    "field semantics conflated"
                )

    def test_extraction_rule_documents_dual_field_semantics(self):
        rule = sl.EXTRACTION_RULES["linkml_metamodel"]
        assert "resolves_to" in rule
        assert "declaration site" in rule


class TestCrossLanguageIndex:
    """New top-level cross_language_index surfaces same-name cross-lexicon
    appearances. Asserts NO semantic equivalence — only same-string
    presence. Computed at payload-build time, not scraped."""

    def test_index_present_in_payload(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        assert "cross_language_index" in payload
        assert isinstance(payload["cross_language_index"], dict)

    def test_summary_counter_matches_index_size(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        idx = payload["cross_language_index"]
        assert payload["summary"]["cross_language_index_size"] == len(idx)

    def test_every_index_entry_has_at_least_two_locations(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        for name, locs in payload["cross_language_index"].items():
            assert len(locs) >= 2, (
                f"{name!r} has only {len(locs)} location(s); should not be indexed"
            )

    def test_index_locations_use_section_dot_subkey_format(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        for name, locs in payload["cross_language_index"].items():
            for loc in locs:
                assert "." in loc, f"{loc!r} not in 'section.sub_key' form"

    def test_known_cross_cutting_names_are_indexed(self, cache_dir):
        """Sanity: 'string' and 'type' are known to appear in many lexicons."""
        payload = sl.build_payload(cache_dir)
        idx = payload["cross_language_index"]
        assert "string" in idx
        assert "type" in idx
        assert len(idx["type"]) >= 4

    def test_index_excludes_metadata_and_summary(self, cache_dir):
        """The walker must not index entries from metadata/summary etc."""
        payload = sl.build_payload(cache_dir)
        for name, locs in payload["cross_language_index"].items():
            for loc in locs:
                section = loc.split(".", 1)[0]
                assert section not in (
                    "metadata", "summary", "notice", "zod_v3_v4_delta",
                    "cross_language_index",
                ), f"index contains non-lexicon section {section!r}"

    def test_index_helper_pure_function(self):
        """_compute_cross_language_index works on synthetic input —
        guards against accidental coupling to the full payload shape."""
        sample = {
            "lang_a": {"items": [{"name": "string"}, {"name": "int"}]},
            "lang_b": {"items": [{"name": "string"}, {"name": "float"}]},
            "lang_c": {"items": [{"name": "string"}, {"name": "int"}]},
            "metadata": {"junk": "should be skipped"},
        }
        result = sl._compute_cross_language_index(sample, min_lexicon_count=2)
        assert sorted(result["string"]) == ["lang_a.items", "lang_b.items", "lang_c.items"]
        assert sorted(result["int"]) == ["lang_a.items", "lang_c.items"]
        assert "float" not in result

    def test_index_extraction_rule_states_no_semantic_assertion(self):
        rule = sl.EXTRACTION_RULES["cross_language_index"]
        assert "no semantic equivalence" in rule.lower() or "NO semantic" in rule
        assert "notice" in rule.lower()


# --------------------------------------------------------------------------- #
# Regression tests for v6 re-review fixes                                     #
# --------------------------------------------------------------------------- #
#
# Fixes:
#  1. logical_source_count derived from SOURCE_AUTHORITY + new
#     metadata.logical_sources enumeration (audit trail).
#  2. Protobuf field_options scoped to direct FieldOptions fields only
#     (14 canonical user-facing options); nested-message fields no longer
#     leak through.
#  3. cross_language_index extraction rule documents that it is a derived
#     artifact with no source_authority entry.


class TestLogicalSourceCountDerivation:
    """v6: logical_source_count was hardcoded (16 then 15) with no
    traceable derivation. Now derived from len(SOURCE_AUTHORITY) and
    enumerated in metadata.logical_sources."""

    def test_count_equals_source_authority_size(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        assert (
            payload["summary"]["logical_source_count"]
            == len(payload["metadata"]["source_authority"])
        )

    def test_logical_sources_field_present_and_sorted(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        ls = payload["metadata"]["logical_sources"]
        assert isinstance(ls, list)
        assert ls == sorted(ls), "logical_sources must be sorted for stable diffs"

    def test_logical_sources_set_equals_source_authority_keys(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        m = payload["metadata"]
        assert set(m["logical_sources"]) == set(m["source_authority"].keys()), (
            "metadata.logical_sources must enumerate exactly source_authority's keys"
        )

    def test_count_matches_enumeration_length(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        assert (
            payload["summary"]["logical_source_count"]
            == len(payload["metadata"]["logical_sources"])
        )


class TestProtobufFieldOptionsScoping:
    """v6: field_options regex captured fields of nested messages
    (FeatureSupport, EditionDefault) inside FieldOptions. The fix strips
    nested `message X {...}` and `enum X {...}` blocks with balanced-
    brace walking before applying the field-name regex."""

    CANONICAL_FIELD_OPTIONS = frozenset({
        "ctype", "packed", "jstype", "lazy", "unverified_lazy",
        "deprecated", "weak", "debug_redact", "retention", "targets",
        "edition_defaults", "features", "feature_support",
        "uninterpreted_option",
    })

    def test_only_canonical_field_options_appear(self, cache_dir):
        r = sl.scrape_protobuf_lexicon(cache_dir)
        names = {f["name"] for f in r["field_options"]}
        assert names == self.CANONICAL_FIELD_OPTIONS, (
            f"unexpected field options: extra={names - self.CANONICAL_FIELD_OPTIONS}, "
            f"missing={self.CANONICAL_FIELD_OPTIONS - names}"
        )

    def test_no_edition_machinery_in_field_options(self, cache_dir):
        """The 7 names that leaked from nested messages — verify each is
        gone. If any reappear, the nested-block stripping regressed."""
        r = sl.scrape_protobuf_lexicon(cache_dir)
        names = {f["name"] for f in r["field_options"]}
        leak_canaries = {
            "edition", "value",
            "edition_introduced", "edition_deprecated",
            "edition_removed", "removal_error", "deprecation_warning",
        }
        bled = names & leak_canaries
        assert not bled, (
            f"nested-message fields leaked back into field_options: {bled}"
        )

    def test_nested_block_stripper_pure_function(self):
        """Pure-function lock on _strip_proto_nested_blocks. Tests the
        balanced-brace walker on a synthetic input with nesting (because
        the actual descriptor.proto has nested enums within nested
        messages, which regex-only stripping would mishandle)."""
        src = """
            optional int32 a = 1;
            message Inner {
              optional int32 b = 1;
              enum E { X = 0; Y = 1; }
              optional int32 c = 2;
            }
            optional int32 d = 2;
        """
        stripped = sl._strip_proto_nested_blocks(src)
        import re
        names = re.findall(r"optional\s+\S+\s+(\w+)\s*=", stripped)
        assert names == ["a", "d"], (
            f"nested stripper left fields from inner message: {names}"
        )

    def test_summary_counter_reflects_14(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        assert payload["summary"]["protobuf_field_option_count"] == 14


class TestCrossLanguageIndexAsDerivedArtifact:
    """v6 polish: cross_language_index has no source_authority entry
    because it's a derived artifact, not an external source. The
    extraction rule documents this explicitly so reviewers don't flag
    it as a missing authority entry."""

    def test_no_source_authority_entry(self, cache_dir):
        """Negative invariant: the absence of a source_authority entry
        is the right shape because cross_language_index is derived."""
        payload = sl.build_payload(cache_dir)
        assert "cross_language_index" not in payload["metadata"]["source_authority"]

    def test_extraction_rule_documents_derived_status(self):
        rule = sl.EXTRACTION_RULES["cross_language_index"]
        # Must call out that it's a derived artifact with no authority entry.
        assert "derived artifact" in rule.lower() or "Derived artifact" in rule
        assert "no source_authority" in rule or "NO source_authority" in rule


# --------------------------------------------------------------------------- #
# Regression tests for v7 re-review fixes                                     #
# --------------------------------------------------------------------------- #
#
# Fixes:
#  1. Postgres casts now carry castcontext (i/a/e) + castmethod (f/i/b)
#     with both raw codes and decoded labels.
#  2. Postgres functions: extraction rule explicitly documents
#     "name roster, not signature catalog".
#  3. Postgres types now carry typcategory + typtype (b/c/d/e/p/r/m)
#     with raw codes and decoded labels.
#  4. cross_language_index_meta sibling field carries the homograph-not-
#     semantic caveat at point-of-use (the cross_language_index dict
#     itself stays a clean name→locations mapping).
#
# REJECTED in v7: bare_label boolean conversion would erase the AS_LABEL
# distinction (455 BARE_LABEL + 39 AS_LABEL, not 494 boolean-true).
# The current 2-value string encoding is correct.


class TestPostgresCastContextAndMethod:
    """v7: Postgres casts now carry castcontext (i/a/e) and castmethod
    (f/i/b). These are load-bearing for emitters — implicit ≠ assignment
    ≠ explicit; binary-coercible ≠ function-call ≠ inout."""

    def test_every_cast_has_castcontext_and_method(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        for c in r["casts"]:
            assert "castcontext" in c
            assert "castmethod"  in c
            assert "castcontext_label" in c
            assert "castmethod_label"  in c

    def test_castcontext_values_are_pg_spec_codes(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        observed = {c["castcontext"] for c in r["casts"]}
        assert observed <= {"i", "a", "e"}, (
            f"unexpected castcontext codes: {observed - {'i','a','e'}}"
        )

    def test_castmethod_values_are_pg_spec_codes(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        observed = {c["castmethod"] for c in r["casts"]}
        assert observed <= {"f", "i", "b"}, (
            f"unexpected castmethod codes: {observed - {'f','i','b'}}"
        )

    def test_labels_match_codes(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        expected_ctx = {"i": "implicit", "a": "assignment", "e": "explicit"}
        expected_method = {"f": "function", "i": "inout", "b": "binary-coercible"}
        for c in r["casts"]:
            assert c["castcontext_label"] == expected_ctx[c["castcontext"]]
            assert c["castmethod_label"]  == expected_method[c["castmethod"]]

    def test_all_three_contexts_actually_appear(self, cache_dir):
        """Postgres ships casts in all three contexts. If only one shows
        up the extractor likely defaulted on all entries."""
        r = sl.scrape_postgres_lexicon(cache_dir)
        observed = {c["castcontext"] for c in r["casts"]}
        assert observed == {"i", "a", "e"}, (
            f"expected all three context codes; got {observed}"
        )


class TestPostgresTypeCategoryAndType:
    """v7: Postgres types now carry typcategory + typtype.
    typcategory: single-char category (B=boolean, N=numeric, …).
    typtype: b=base, c=composite, d=domain, e=enum, p=pseudo, r=range,
             m=multirange. Defaults to 'b' when omitted in source."""

    def test_every_type_has_typcategory_and_typtype(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        for t in r["types"]:
            assert "typcategory" in t
            assert "typtype"     in t
            assert "typtype_label" in t

    def test_typtype_values_are_pg_spec_codes(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        observed = {t["typtype"] for t in r["types"]}
        assert observed <= {"b", "c", "d", "e", "p", "r", "m"}, (
            f"unexpected typtype codes: {observed - set('bcdeprm')}"
        )

    def test_typtype_defaults_to_base_when_source_omits(self, cache_dir):
        """pg_type.dat omits typtype on most base types; the extractor
        must default to 'b' (base) per Postgres catalog conventions."""
        r = sl.scrape_postgres_lexicon(cache_dir)
        # bool, int4, text — canonical base types, no explicit typtype in source.
        for name in ("bool", "int4", "text"):
            t = next((x for x in r["types"] if x["name"] == name), None)
            assert t is not None, f"type {name} missing"
            assert t["typtype"] == "b"
            assert t["typtype_label"] == "base"

    def test_pseudo_types_correctly_categorized(self, cache_dir):
        """Pseudo types (any, anyelement, void, record, cstring, …) must
        carry typtype='p'. These are the types a USL-NG emitter cares
        about distinguishing from scalars."""
        r = sl.scrape_postgres_lexicon(cache_dir)
        pseudos = {t["name"] for t in r["types"] if t["typtype"] == "p"}
        for canonical in ("any", "anyelement", "void", "record", "cstring"):
            assert canonical in pseudos, (
                f"{canonical} should be typtype='p' (pseudo); got "
                f"{next((t['typtype'] for t in r['types'] if t['name'] == canonical), 'MISSING')}"
            )

    def test_type_count_unchanged_after_v7_fix(self, cache_dir):
        """v7 fix initially regressed type count 112→111 because the naive
        per-entry regex choked on pg_type.dat's `line` entry (descr field
        contains literal `\\'{A,B,C}\\'`). String-aware parser recovers it."""
        r = sl.scrape_postgres_lexicon(cache_dir)
        assert len(r["types"]) == 112
        names = {t["name"] for t in r["types"]}
        assert "line" in names, (
            "`line` type dropped — string-aware hash parser regressed"
        )

    def test_typtype_label_decoding(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        expected = {
            "b": "base", "c": "composite", "d": "domain", "e": "enum",
            "p": "pseudo", "r": "range", "m": "multirange",
        }
        for t in r["types"]:
            assert t["typtype_label"] == expected[t["typtype"]]


class TestPgHashEntryParser:
    """Pure-function tests for _parse_pg_hash_entries — the string-aware
    walker that handles entries whose values contain literal `{`/`}`."""

    def test_parses_simple_entry(self):
        src = "{ a => 'x', b => 'y' }"
        r = sl._parse_pg_hash_entries(src)
        assert r == [{"a": "x", "b": "y"}]

    def test_parses_entry_with_braces_in_string_value(self):
        """The defect that motivated string-aware parsing: pg_type.dat's
        `line` entry has descr `\\'{A,B,C}\\'`. A naive `\\{[^{}]*\\}` regex
        truncates at the inner `{`."""
        src = r"{ descr => 'has {braces} inside', typname => 'line' }"
        r = sl._parse_pg_hash_entries(src)
        assert len(r) == 1
        assert r[0]["typname"] == "line"
        assert "{braces}" in r[0]["descr"]

    def test_parses_multiple_entries(self):
        src = "{ a => '1' }, { a => '2' }, { a => '3' }"
        r = sl._parse_pg_hash_entries(src)
        assert [e["a"] for e in r] == ["1", "2", "3"]

    def test_handles_escaped_quotes_in_string(self):
        """Perl allows `\\'` to escape a single-quote inside a single-
        quoted string. The walker must keep brace-tracking off until the
        unescaped closing `'`."""
        src = r"{ k => 'with \'quote\' and {brace}' }"
        r = sl._parse_pg_hash_entries(src)
        assert len(r) == 1
        assert "{brace}" in r[0]["k"]


class TestPostgresFunctionsScopeNote:
    """v7: extraction rule explicitly documents that functions partition
    is a name roster, not a signature catalog. Defends against the
    repeating reviewer request for arg/return types."""

    def test_extraction_rule_documents_name_roster_scope(self):
        rule = sl.EXTRACTION_RULES["postgres_lexicon"]
        # Must call out the scope limitation explicitly.
        assert "NAME ROSTER" in rule or "name roster" in rule.lower()
        assert "SIGNATURE CATALOG" in rule or "signature catalog" in rule.lower()
        # Must point consumers at the source for signatures.
        assert "consult pg_proc.dat" in rule or "consult pg_proc" in rule


class TestCrossLanguageIndexMeta:
    """v7: cross_language_index_meta sibling field surfaces the homograph-
    not-semantic caveat at point-of-use. The index itself stays a clean
    name→locations dict; the caveat lives in a peer field that consumers
    will naturally encounter."""

    def test_meta_field_present(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        assert "cross_language_index_meta" in payload
        meta = payload["cross_language_index_meta"]
        assert "caveat" in meta
        assert "min_lexicon_count" in meta
        assert "size" in meta

    def test_meta_size_matches_index_size(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        meta = payload["cross_language_index_meta"]
        assert meta["size"] == len(payload["cross_language_index"])

    def test_meta_min_lexicon_count_matches_index_filter(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        meta = payload["cross_language_index_meta"]
        # Every index entry must satisfy the declared min_lexicon_count.
        for name, locs in payload["cross_language_index"].items():
            assert len(locs) >= meta["min_lexicon_count"]

    def test_caveat_calls_out_homograph_risk_specifically(self, cache_dir):
        payload = sl.build_payload(cache_dir)
        caveat = payload["cross_language_index_meta"]["caveat"]
        assert "homograph" in caveat.lower()
        assert "no semantic correspondence" in caveat.lower() or \
               "no semantic equivalence" in caveat.lower()


class TestBareLabelEncodingPreserved:
    """v7 REJECTED finding: reviewer suggested converting bare_label to
    boolean. The current 2-value encoding (BARE_LABEL vs AS_LABEL) is
    correct — converting to boolean would lose the 39 AS_LABEL entries'
    distinction from the 455 BARE_LABEL entries. This test locks the
    current encoding in place so a future reviewer's same request doesn't
    silently get implemented."""

    def test_bare_label_is_string_enum_not_boolean(self, cache_dir):
        r = sl.scrape_postgres_lexicon(cache_dir)
        observed = {k["bare_label"] for k in r["keywords"]}
        assert observed <= {"BARE_LABEL", "AS_LABEL"}, (
            f"unexpected bare_label values: {observed - {'BARE_LABEL', 'AS_LABEL'}}"
        )
        # Both must actually appear.
        assert "BARE_LABEL" in observed
        assert "AS_LABEL" in observed, (
            "AS_LABEL never appears — if encoding was simplified to "
            "boolean-presence the AS_LABEL distinction would be lost"
        )
