#!/usr/bin/env python3
"""Download the canonical specification for every typecarta adapter.

Vendors each adapter's authoritative spec into `vendor/specs/<adapter>/`
alongside a `_meta.json` capturing the source URL, fetch timestamp,
content-type, byte size, and SHA-256. The point is traceability: every
scorecard verdict the project ships should be auditable against the
exact bytes of the spec it claims to encode.

Three adapters (typescript, zod, effect-schema) have no formal external
spec; the script writes a `_NO_SPEC.md` stub explaining what the closest
authoritative reference would be, so the gap is visible rather than
silent.

Usage:
    python3 scripts/download-specs.py            # fetch missing only
    python3 scripts/download-specs.py --force    # re-fetch everything
    python3 scripts/download-specs.py --check    # verify SHAs, no download
    python3 scripts/download-specs.py --adapter xsd

Exit codes:
    0  every requested spec is present and (when --check) hashes match
    1  one or more downloads failed
    2  --check found a hash mismatch
    3  invalid CLI arguments
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
VENDOR_DIR = REPO_ROOT / "vendor" / "specs"
USER_AGENT = "typecarta-spec-downloader/1.0 (+https://github.com/anthropics/typecarta)"
TIMEOUT_SECONDS = 30


@dataclass(frozen=True)
class SpecFile:
    """One downloadable artifact within an adapter's spec bundle."""

    url: str
    filename: str
    description: str


@dataclass(frozen=True)
class AdapterSpec:
    """An adapter's spec, or an explicit "no spec" record."""

    adapter_key: str
    name: str
    spec_version: str
    files: tuple[SpecFile, ...] = ()
    no_spec_reason: str | None = None
    no_spec_closest_reference: str | None = None


# Canonical spec sources. Keep this list in lock-step with each adapter's
# `name` + `specVersion` declarations under packages/adapters/*/src/adapter.ts.
SPECS: tuple[AdapterSpec, ...] = (
    AdapterSpec(
        adapter_key="xsd",
        name="xsd",
        spec_version="1.0",
        files=(
            SpecFile(
                url="https://www.w3.org/TR/2004/REC-xmlschema-1-20041028/",
                filename="xmlschema-1-structures.html",
                description="W3C XML Schema Part 1: Structures (Second Edition, 2004)",
            ),
            SpecFile(
                url="https://www.w3.org/TR/2004/REC-xmlschema-2-20041028/",
                filename="xmlschema-2-datatypes.html",
                description="W3C XML Schema Part 2: Datatypes (Second Edition, 2004)",
            ),
        ),
    ),
    AdapterSpec(
        adapter_key="json-schema",
        name="JSON Schema",
        spec_version="draft-07",
        files=(
            SpecFile(
                url="https://raw.githubusercontent.com/json-schema-org/json-schema-spec/draft-07/schema.json",
                filename="meta-schema.json",
                description="JSON Schema draft-07 meta-schema (the schema that schemas validate against)",
            ),
        ),
    ),
    AdapterSpec(
        adapter_key="avro",
        name="Apache Avro",
        spec_version="1.11",
        files=(
            SpecFile(
                url="https://avro.apache.org/docs/1.11.1/specification/",
                filename="specification.html",
                description="Apache Avro 1.11.1 Specification (published HTML)",
            ),
        ),
    ),
    AdapterSpec(
        adapter_key="protobuf",
        name="Protocol Buffers",
        spec_version="proto3",
        files=(
            SpecFile(
                url="https://protobuf.dev/programming-guides/proto3/",
                filename="proto3.html",
                description="protobuf.dev Programming Guide: proto3 (the closest thing to a spec; there is no formal RFC-style proto3 spec)",
            ),
        ),
    ),
    AdapterSpec(
        adapter_key="graphql",
        name="GraphQL",
        spec_version="October 2021",
        # The GraphQL spec is split across an index + 7 sections + 2 appendices,
        # all under spec/ at the October2021 tag. URL-encode spaces (%20) and
        # the path separator -- (which is literal in the filenames).
        files=tuple(
            SpecFile(
                url=f"https://raw.githubusercontent.com/graphql/graphql-spec/October2021/spec/{path}",
                filename=path.replace("%20", " "),
                description=desc,
            )
            for path, desc in (
                ("GraphQL.md", "GraphQL Specification index, October 2021 edition"),
                ("Section%201%20--%20Overview.md", "Section 1 — Overview"),
                ("Section%202%20--%20Language.md", "Section 2 — Language"),
                ("Section%203%20--%20Type%20System.md", "Section 3 — Type System"),
                ("Section%204%20--%20Introspection.md", "Section 4 — Introspection"),
                ("Section%205%20--%20Validation.md", "Section 5 — Validation"),
                ("Section%206%20--%20Execution.md", "Section 6 — Execution"),
                ("Section%207%20--%20Response.md", "Section 7 — Response"),
                ("Appendix%20A%20--%20Notation%20Conventions.md", "Appendix A — Notation Conventions"),
                ("Appendix%20B%20--%20Grammar%20Summary.md", "Appendix B — Grammar Summary"),
            )
        ),
    ),
    AdapterSpec(
        adapter_key="typescript",
        name="TypeScript",
        spec_version="5.7",
        no_spec_reason=(
            "TypeScript has no formal language specification. The original "
            "spec at github.com/microsoft/TypeScript/blob/master/doc/spec-ARCHIVED.md "
            "was archived in 2014 and has not tracked the language since."
        ),
        no_spec_closest_reference=(
            "Closest authoritative reference: the TypeScript Handbook "
            "(https://www.typescriptlang.org/docs/handbook/) and release "
            "notes for v5.7. Behavior is ultimately defined by the compiler."
        ),
    ),
    AdapterSpec(
        adapter_key="zod",
        name="Zod",
        spec_version="3.x",
        no_spec_reason=(
            "Zod is a TypeScript library, not a standardized format. There "
            "is no spec separate from the library's source and README."
        ),
        no_spec_closest_reference=(
            "Closest authoritative reference: the colinhacks/zod repository "
            "and its README (https://github.com/colinhacks/zod). Pinning a "
            "minor version (e.g. 3.23.x) recommended for any concrete claim."
        ),
    ),
    AdapterSpec(
        adapter_key="effect-schema",
        name="Effect Schema",
        spec_version="0.x",
        no_spec_reason=(
            "Effect Schema is a TypeScript library, not a standardized "
            "format. There is no spec separate from the library's source."
        ),
        no_spec_closest_reference=(
            "Closest authoritative reference: the Effect-TS/effect "
            "repository and its docs (https://effect.website/docs/schema/"
            "introduction/). Pinning a minor version recommended for any "
            "concrete claim."
        ),
    ),
)


@dataclass
class FileMeta:
    """Per-file provenance written into _meta.json."""

    filename: str
    url: str
    description: str
    fetched_at: str
    content_type: str
    bytes: int
    sha256: str


@dataclass
class AdapterMeta:
    """Per-adapter provenance written into _meta.json."""

    adapter_key: str
    name: str
    spec_version: str
    files: list[FileMeta] = field(default_factory=list)
    no_spec_reason: str | None = None
    no_spec_closest_reference: str | None = None


# ─── HTTP ────────────────────────────────────────────────────────────


def _download(url: str) -> tuple[bytes, str]:
    """Fetch URL with a polite User-Agent. Returns (body, content-type)."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        body = response.read()
        content_type = response.headers.get("Content-Type", "application/octet-stream")
    return body, content_type


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ─── Writers ─────────────────────────────────────────────────────────


def _meta_to_dict(meta: AdapterMeta) -> dict:
    """Convert AdapterMeta to a JSON-serializable dict."""
    out: dict = {
        "adapter_key": meta.adapter_key,
        "name": meta.name,
        "spec_version": meta.spec_version,
    }
    if meta.no_spec_reason is not None:
        out["no_spec_reason"] = meta.no_spec_reason
    if meta.no_spec_closest_reference is not None:
        out["no_spec_closest_reference"] = meta.no_spec_closest_reference
    if meta.files:
        out["files"] = [
            {
                "filename": f.filename,
                "url": f.url,
                "description": f.description,
                "fetched_at": f.fetched_at,
                "content_type": f.content_type,
                "bytes": f.bytes,
                "sha256": f.sha256,
            }
            for f in meta.files
        ]
    return out


def _write_meta(target_dir: Path, meta: AdapterMeta) -> None:
    (target_dir / "_meta.json").write_text(
        json.dumps(_meta_to_dict(meta), indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def _read_meta(target_dir: Path) -> dict | None:
    meta_path = target_dir / "_meta.json"
    if not meta_path.exists():
        return None
    try:
        return json.loads(meta_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _write_no_spec_stub(target_dir: Path, spec: AdapterSpec) -> None:
    body = (
        f"# {spec.name} {spec.spec_version} — no formal spec\n\n"
        f"{spec.no_spec_reason}\n\n"
        f"{spec.no_spec_closest_reference}\n\n"
        f"This file is generated by `scripts/download-specs.py`.\n"
    )
    (target_dir / "_NO_SPEC.md").write_text(body, encoding="utf-8")


# ─── Per-adapter actions ─────────────────────────────────────────────


def _fetch_spec(spec: AdapterSpec, force: bool) -> tuple[AdapterMeta, list[str]]:
    """Download files for one adapter. Returns (meta, errors)."""
    target_dir = VENDOR_DIR / spec.adapter_key
    target_dir.mkdir(parents=True, exist_ok=True)

    meta = AdapterMeta(
        adapter_key=spec.adapter_key,
        name=spec.name,
        spec_version=spec.spec_version,
        no_spec_reason=spec.no_spec_reason,
        no_spec_closest_reference=spec.no_spec_closest_reference,
    )

    # No-spec adapters: emit the stub, no downloads.
    if spec.no_spec_reason is not None:
        _write_no_spec_stub(target_dir, spec)
        _write_meta(target_dir, meta)
        print(f"  [{spec.adapter_key}] no formal spec — stub written")
        return meta, []

    errors: list[str] = []
    existing_meta = _read_meta(target_dir)
    existing_files_by_name = {
        f["filename"]: f for f in (existing_meta or {}).get("files", [])
    }

    for spec_file in spec.files:
        target_path = target_dir / spec_file.filename
        existing = existing_files_by_name.get(spec_file.filename)

        if target_path.exists() and existing is not None and not force:
            # Trust the existing artifact; re-stamp meta without refetching.
            actual_sha = _sha256(target_path.read_bytes())
            if actual_sha != existing.get("sha256"):
                errors.append(
                    f"  [{spec.adapter_key}] {spec_file.filename}: on-disk SHA "
                    f"({actual_sha[:16]}) drifted from _meta.json "
                    f"({existing.get('sha256', '?')[:16]}); use --force to refetch"
                )
                continue
            meta.files.append(
                FileMeta(
                    filename=spec_file.filename,
                    url=spec_file.url,
                    description=spec_file.description,
                    fetched_at=existing["fetched_at"],
                    content_type=existing["content_type"],
                    bytes=existing["bytes"],
                    sha256=existing["sha256"],
                )
            )
            print(f"  [{spec.adapter_key}] {spec_file.filename}: present (skip)")
            continue

        try:
            body, content_type = _download(spec_file.url)
        except urllib.error.URLError as exc:
            errors.append(f"  [{spec.adapter_key}] {spec_file.filename}: {exc}")
            continue

        target_path.write_bytes(body)
        meta.files.append(
            FileMeta(
                filename=spec_file.filename,
                url=spec_file.url,
                description=spec_file.description,
                fetched_at=_now_iso(),
                content_type=content_type,
                bytes=len(body),
                sha256=_sha256(body),
            )
        )
        print(
            f"  [{spec.adapter_key}] {spec_file.filename}: {len(body):,} bytes "
            f"(sha256 {_sha256(body)[:16]}…)"
        )

    _write_meta(target_dir, meta)
    return meta, errors


def _check_spec(spec: AdapterSpec) -> list[str]:
    """Verify that on-disk SHAs match _meta.json. Returns error lines."""
    target_dir = VENDOR_DIR / spec.adapter_key
    if spec.no_spec_reason is not None:
        if not (target_dir / "_NO_SPEC.md").exists():
            return [f"  [{spec.adapter_key}] _NO_SPEC.md missing"]
        return []

    existing_meta = _read_meta(target_dir)
    if existing_meta is None:
        return [f"  [{spec.adapter_key}] _meta.json missing"]

    errors: list[str] = []
    for file_meta in existing_meta.get("files", []):
        target_path = target_dir / file_meta["filename"]
        if not target_path.exists():
            errors.append(
                f"  [{spec.adapter_key}] {file_meta['filename']}: missing on disk"
            )
            continue
        actual = _sha256(target_path.read_bytes())
        expected = file_meta.get("sha256", "")
        if actual != expected:
            errors.append(
                f"  [{spec.adapter_key}] {file_meta['filename']}: SHA mismatch "
                f"(disk {actual[:16]} vs meta {expected[:16]})"
            )
    return errors


# ─── CLI ─────────────────────────────────────────────────────────────


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download canonical specs for typecarta adapters.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download every file even if already present.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify on-disk SHAs against _meta.json without downloading.",
    )
    parser.add_argument(
        "--adapter",
        action="append",
        help=(
            "Restrict to one or more adapter keys (repeatable). "
            "Default: all adapters."
        ),
    )
    return parser.parse_args(argv)


def _select_specs(filter_keys: list[str] | None) -> list[AdapterSpec]:
    if not filter_keys:
        return list(SPECS)
    known = {spec.adapter_key for spec in SPECS}
    unknown = [k for k in filter_keys if k not in known]
    if unknown:
        sys.stderr.write(
            f"Unknown adapter key(s): {', '.join(unknown)}. "
            f"Known: {', '.join(sorted(known))}.\n"
        )
        sys.exit(3)
    return [spec for spec in SPECS if spec.adapter_key in filter_keys]


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])

    if args.force and args.check:
        sys.stderr.write("--force and --check are mutually exclusive.\n")
        return 3

    selected = _select_specs(args.adapter)
    VENDOR_DIR.mkdir(parents=True, exist_ok=True)

    if args.check:
        print(f"Checking {len(selected)} adapter spec(s) in {VENDOR_DIR}…")
        all_errors: list[str] = []
        for spec in selected:
            errors = _check_spec(spec)
            if errors:
                all_errors.extend(errors)
            else:
                print(f"  [{spec.adapter_key}] ok")
        if all_errors:
            print("\nDrift detected:")
            for line in all_errors:
                print(line)
            return 2
        print("\nAll checked specs match recorded SHAs.")
        return 0

    print(f"Downloading specs into {VENDOR_DIR}…")
    all_errors = []
    for spec in selected:
        _, errors = _fetch_spec(spec, force=args.force)
        all_errors.extend(errors)

    if all_errors:
        print("\nErrors:")
        for line in all_errors:
            print(line)
        return 1

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
