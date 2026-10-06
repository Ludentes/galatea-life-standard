"""Check that each standard's requirement index and its manifest agree.

A standard is any `standard/<name>.md` with a `## Requirement index` of GA rows; its manifest is
`conformance/<name>-requirements.json`. Requirement ids are one namespace across the standards.
Verify is one of wire, static, judged.

Usage: python3 conformance/check_manifest.py           (exit 1 and a list on disagreement)
       python3 conformance/check_manifest.py --write   (regenerate every manifest and constants file
                                                        from its text)
"""
import json
import pathlib
import re
import sys

ID = re.compile(r"\bGA-[A-Z]+-\d+\b")
ROW = re.compile(r"^\| (GA-[A-Z]+-\d+) \| (MUST|SHOULD|MAY) \| (\w+) \| (\w+) \| (.+) \|$")
FIELDS = ("level", "conformance", "verify")
VERIFY = ("wire", "static", "judged")


def parse_index(doc: str) -> dict:
    """The rows of the *Requirement index* table, by id."""
    if "## Requirement index" not in doc:
        return {}
    section = doc.split("## Requirement index", 1)[1].split("\n## ", 1)[0]
    rows = {}
    for line in section.splitlines():
        m = ROW.match(line)
        if m:
            rows[m[1]] = dict(zip(FIELDS, m.group(2, 3, 4)))
    return rows


def parse_withdrawn(doc: str) -> set:
    """The ids listed under *Withdrawn requirements*: citable, never again in an index."""
    if "## Withdrawn requirements" not in doc:
        return set()
    section = doc.split("## Withdrawn requirements", 1)[1].split("\n## ", 1)[0]
    return {m[1] for m in re.finditer(r"^- (GA-[A-Z]+-\d+)\b", section, re.MULTILINE)}


NEG_ROW = re.compile(r"^\| `([a-z0-9-]+)` \| ([^|]+) \| ([^|]+) \|")


def parse_negatives(doc: str) -> dict:
    """From the *Negative subjects* table: id -> [(subject, ids it may also fail)], in table order."""
    if "### Negative subjects" not in doc:
        return {}
    section = doc.split("### Negative subjects", 1)[1].split("\n#", 1)[0]
    out = {}
    for line in section.splitlines():
        m = NEG_ROW.match(line)
        if m:
            for rid in ID.findall(m[2]):
                out.setdefault(rid, []).append((m[1], ID.findall(m[3])))
    return out


def _section(doc: str, title: str) -> str:
    if f"## {title}" not in doc:
        return ""
    return doc.split(f"## {title}", 1)[1].split("\n## ", 1)[0]


BLOCK = re.compile(r"\n\s*\n|\n(?=\s*[-*] )|\n(?=\|)|\n(?=\d+\. )")
UNCHECKED = re.compile(r"not\s+checked\s+by\s+the\s+harness", re.IGNORECASE)


def untagged_musts(doc: str) -> list:
    """Paragraphs, list items and table rows of the body with a MUST and no requirement id."""
    body = doc.split("\n---\n", 1)[-1] if doc.startswith("---\n") else doc
    for title in ("Changelog", "Requirement index", "Withdrawn requirements"):
        body = body.replace(_section(body, title), "")
    found = []
    for block in BLOCK.split(body):
        if re.search(r"\bMUST\b", block) and not ID.search(block) and not UNCHECKED.search(block):
            found.append(" ".join(block.split())[:160])
    return found


def check(doc: str, manifest: list, known: set | None = None) -> list:
    """One standard against its manifest. `known` is every id in any standard's index."""
    errors = []
    index = parse_index(doc)
    for rid, row in sorted(index.items()):
        if row["verify"] not in VERIFY:
            errors.append(f"{rid}: verify is {row['verify']}, not one of {', '.join(VERIFY)}")
    known = set(index) if known is None else known
    seen = {}
    for rec in manifest:
        if rec["id"] in seen:
            errors.append(f"{rec['id']}: twice in the manifest")
        seen[rec["id"]] = rec
    for rid in sorted(index.keys() - seen.keys()):
        errors.append(f"{rid}: in the index, not in the manifest")
    for rid in sorted(seen.keys() - index.keys()):
        errors.append(f"{rid}: in the manifest, not in the index")
    for rid in sorted(index.keys() & seen.keys()):
        for f in FIELDS:
            if index[rid][f] != seen[rid][f]:
                errors.append(f"{rid}: {f} is {index[rid][f]} in the index, {seen[rid][f]} in the manifest")
    negatives = parse_negatives(doc)
    for rid in sorted(index.keys() & seen.keys()):
        text = [(s, sorted(c)) for s, c in negatives.get(rid, [])]
        listed = [(n.get("subject"), sorted(n.get("coupled", [])))
                  for n in seen[rid].get("negative_subjects", [])]
        if listed != text:
            errors.append(f"{rid}: negative subjects are {text} in the text, {listed} in the manifest")
    for rid in sorted(set(ID.findall(doc)) - known):
        errors.append(f"{rid}: cited in the text, no such requirement")
    return errors


CONST_ROW = re.compile(r"^\| ([^|]+) \| ([^|]+) \| ([^|]*) \|$")
NUMBER = re.compile(r"(\d+(?:\.\d+)?)(?:\s*(ms|s|min|h|days?|%)(?![A-Za-z]))?")


def _plain(text: str) -> str:
    return text.replace("`", "").strip()


def _key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", _plain(name).lower()).strip("-")


def parse_constants(doc: str) -> list:
    """The rows of the *Constants* table: what a test reads a bound from."""
    out = []
    for line in _section(doc, "Constants").splitlines():
        m = CONST_ROW.match(line)
        if not m or _plain(m[1]) == "Constant" or set(m[1].strip()) <= {"-"}:
            continue
        name, value, where = m[1], m[2], m[3]
        n = NUMBER.search(_plain(value))
        number = None
        if n:
            number = float(n[1])
            number = int(number) if number.is_integer() else number
        out.append({
            "key": _key(name),
            "name": _plain(name),
            "value": _plain(value),
            "number": number,
            "unit": n[2] if n and n[2] else None,
            "guess": "⚠️" in value or "⚠️" in where,
            "where": _plain(where),
        })
    return out


def _constants_json(doc: str) -> str:
    return json.dumps(parse_constants(doc), indent=2, ensure_ascii=False) + "\n"


def check_constants(root: pathlib.Path, standards: dict) -> list:
    """Each `conformance/<name>-constants.json` is what its standard's *Constants* table implies."""
    errors = []
    for name, (doc, _) in sorted(standards.items()):
        path = root / "conformance" / f"{name}-constants.json"
        keys = [c["key"] for c in parse_constants(doc)]
        for k in sorted({k for k in keys if keys.count(k) > 1}):
            errors.append(f"{name}: constant key {k} twice")
        if not path.exists() or path.read_text() != _constants_json(doc):
            errors.append(f"{name}: {path.name} differs from the text; run --write")
    return errors


CELL = re.compile(r"(?<!\\)\|")
NAME = re.compile(r"`([A-Za-z_][A-Za-z0-9_.]*)`")
SHAPE_NAME = re.compile(r"\s*([A-Za-z_][A-Za-z0-9_]*)(\??)")


def tables_under(doc: str, heading: str):
    """The tables between a heading line and the next heading: [{header, rows: [{column: cell}]}]."""
    lines = doc.splitlines()
    if heading not in lines:
        return None
    tables, current = [], None
    for line in lines[lines.index(heading) + 1:]:
        if line.startswith("#"):
            break
        if not line.startswith("|"):
            current = None
            continue
        cells = [c.strip().replace("\\|", "|") for c in CELL.split(line.strip())[1:-1]]
        if current is None:
            current = {"header": cells, "rows": []}
            tables.append(current)
        elif not all(set(c) <= set("-: ") for c in cells):
            current["rows"].append(dict(zip(current["header"], cells)))
    return tables


def shape_fields(cell: str):
    """{name: optional} for the top level of the first { ... } in a cell, or None."""
    text = cell.replace("`", "")
    start = text.find("{")
    if start < 0:
        return None
    parts, buf, depth = [], "", 0
    for ch in text[start + 1:]:
        if ch in "{[(":
            depth += 1
        elif ch in "}])":
            if depth == 0:
                break
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(buf)
            buf = ""
        else:
            buf += ch
    parts.append(buf)
    out = {}
    for part in parts:
        m = SHAPE_NAME.match(part)
        if m:
            out[m[1]] = bool(m[2])
    return out


CASES = {
    "as_is": lambda n: n,
    "camel": lambda n: re.sub(r"_([a-z0-9])", lambda m: m[1].upper(), n),
    "snake": lambda n: re.sub(r"(?<=[a-z0-9])([A-Z])", lambda m: "_" + m[1].lower(), n),
}


def _resolve(schema, pointer: str):
    node = schema
    for part in [p for p in pointer.split("/")[1:]]:
        part = part.replace("~1", "/").replace("~0", "~")
        node = node[int(part)] if isinstance(node, list) else node[part]
    return node


def _find_row(table: dict, key: str):
    first = table["header"][0]
    for row in table["rows"]:
        cell = row.get(first, "")
        if key in NAME.findall(cell) or _plain(cell) == key:
            return row
    return None


def check_text_map(docs: dict, schema_root: pathlib.Path) -> list:
    """Every field and enum value a mapped table lists is in its schema, and the reverse."""
    path = schema_root / "text-map.json"
    if not path.exists():
        return []
    errors = []
    for e in json.loads(path.read_text())["entries"]:
        n = e.get("table", 1)
        where = f"text-map: {e['standard']} {e['heading']} table {n}"
        tables = tables_under(docs.get(e["standard"], ""), e["heading"])
        if not tables or len(tables) < n:
            errors.append(f"{where}: no such table")
            continue
        table = tables[n - 1]
        if e["column"] not in table["header"]:
            errors.append(f"{where}: no column {e['column']}")
            continue
        target_name = f"{e['schema']}#{e['pointer']}"
        try:
            target = _resolve(json.loads((schema_root / e["schema"]).read_text()), e["pointer"])
        except (OSError, KeyError, IndexError, ValueError, TypeError):
            errors.append(f"{where}: {target_name} does not exist")
            continue
        conv = CASES[e.get("case", "as_is")]
        ignore = set(e.get("ignore", []))
        if e["kind"] in ("fields", "column"):
            text = {conv(x) for row in table["rows"] for x in NAME.findall(row.get(e["column"], ""))}
            schema = set(target.get("properties", {})) if e["kind"] == "fields" else set(target)
        else:
            row = _find_row(table, e["row"])
            if row is None:
                errors.append(f"{where}: no row {e['row']}")
                continue
            cell = row.get(e["column"], "")
            if e["kind"] == "values":
                text = {conv(x) for x in NAME.findall(cell)}
                schema = set(target)
            else:
                shape = shape_fields(cell)
                if shape is None:
                    errors.append(f"{where}: row {e['row']} has no {{ ... }} in {e['column']}")
                    continue
                text = {conv(x) for x in shape}
                schema = set(target.get("properties", {}))
                wanted = {conv(x) for x, optional in shape.items() if not optional} - ignore
                # A field the map names `conditional` counts as required when the schema requires it under a
                # condition (`then` or `else` of its top-level `if`), as configure's expected_revision is
                # required unless every change is an ignore (applier, *Discovery*; GA-CFG-2).
                under = set(target.get("then", {}).get("required", [])) | set(target.get("else", {}).get("required", []))
                for x in sorted(e.get("conditional", {})):
                    if x not in under:
                        errors.append(f"{where} → {target_name}: {x} is conditional in the map, the schema requires it under no condition")
                have = (set(target.get("required", [])) | (set(e.get("conditional", {})) & under)) - ignore
                if wanted != have:
                    errors.append(f"{where} → {target_name}: required is {sorted(have)}, the text says {sorted(wanted)}")
        text, schema = text - ignore, schema - ignore
        for x in sorted(text - schema):
            errors.append(f"{where} → {target_name}: {x} in the text, not in the schema")
        for x in sorted(schema - text):
            errors.append(f"{where} → {target_name}: {x} in the schema, not in the text")
    return errors


def check_all(standards: dict) -> list:
    """Every standard against its own manifest; ids unique across indexes; citations resolve."""
    errors = []
    owner = {}
    withdrawn = set()
    for name, (doc, _) in sorted(standards.items()):
        withdrawn |= parse_withdrawn(doc)
        for rid in parse_index(doc):
            if rid in owner:
                errors.append(f"{rid}: in two indexes, {owner[rid]} and {name}")
            owner.setdefault(rid, name)
    for rid in sorted(withdrawn & owner.keys()):
        errors.append(f"{rid}: withdrawn, but back in the index of {owner[rid]}")
    for name, (doc, manifest) in sorted(standards.items()):
        errors += [f"{name}: {e}" for e in check(doc, manifest, set(owner) | withdrawn)]
        errors += [f"{name}: MUST without an id: {b}" for b in untagged_musts(doc)]
    return errors


def generate(doc: str) -> list:
    """The manifest a standard's text implies: its index rows and its negative subjects."""
    section = doc.split("## Requirement index", 1)[1].split("\n## ", 1)[0]
    negatives = parse_negatives(doc)
    out = []
    for line in section.splitlines():
        m = ROW.match(line)
        if not m:
            continue
        rec = dict(zip(("id",) + FIELDS + ("text",), m.group(1, 2, 3, 4, 5)))
        rec["text"] = rec["text"].replace("`", "")
        rec["negative_subjects"] = [{"subject": s, "coupled": c} for s, c in negatives.get(m[1], [])]
        out.append(rec)
    return out


def load_standards(root: pathlib.Path) -> dict:
    """{name: (text, manifest)} for every standard document with a GA requirement index."""
    out = {}
    for path in sorted((root / "standard").glob("*.md")):
        doc = path.read_text()
        if not parse_index(doc):
            continue
        manifest = root / "conformance" / f"{path.stem}-requirements.json"
        out[path.stem] = (doc, json.loads(manifest.read_text()) if manifest.exists() else [])
    return out


def check_manifest_copy(conformance: pathlib.Path) -> list:
    """@ludentes/galatea-life-schemas' copy of the bridge-type manifest schema is byte for byte its source, which
    the standard cites; the package loads the copy so that a `pnpm deploy` bundle has it."""
    source = conformance / "galatea-bridge.schema.json"
    copy = conformance / "schemas" / "galatea-bridge.schema.json"
    if not copy.exists():
        return [f"{copy.relative_to(conformance.parent)}: missing; copy {source.name} there"]
    if copy.read_bytes() != source.read_bytes():
        return [f"{copy.relative_to(conformance.parent)} differs from {source.relative_to(conformance.parent)}: copy it again"]
    return []


def main() -> int:
    root = pathlib.Path(__file__).resolve().parent.parent
    if "--write" in sys.argv:
        for name, (doc, _) in load_standards(root).items():
            path = root / "conformance" / f"{name}-requirements.json"
            path.write_text(json.dumps(generate(doc), indent=2, ensure_ascii=False) + "\n")
            (root / "conformance" / f"{name}-constants.json").write_text(_constants_json(doc))
    standards = load_standards(root)
    errors = (check_all(standards) + check_constants(root, standards)
              + check_text_map({n: d for n, (d, _) in standards.items()}, root / "conformance" / "schemas")
              + check_manifest_copy(root / "conformance"))
    for e in errors:
        print(e)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
