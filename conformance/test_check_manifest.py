"""The manifests and the standards' requirement indexes must say the same thing.

Run: python3 -m unittest conformance/test_check_manifest.py
"""
import json
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from check_manifest import (check, check_all, check_constants, check_manifest_copy, check_text_map, generate, load_standards,
                            parse_constants, parse_index, parse_negatives, parse_withdrawn, shape_fields,
                            tables_under, untagged_musts)

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOC = (ROOT / "standard" / "applier.md").read_text()
MANIFEST = json.loads((ROOT / "conformance" / "applier-requirements.json").read_text())


def mini(ids: list[str], body: str = "") -> str:
    """A minimal standard: a body, then an index with the given ids."""
    rows = "\n".join(f"| {i} | MUST | Act | wire | text |" for i in ids)
    return f"# A standard\n\n{body}\n\n## Requirement index\n\n{rows}\n\n## After\n"


def manifest(ids: list[str]) -> list:
    return [
        {"id": i, "level": "MUST", "conformance": "Act", "verify": "wire", "text": "text",
         "negative_subjects": []}
        for i in ids
    ]


class RealFiles(unittest.TestCase):
    def test_the_real_pair_agrees(self):
        known = {i for doc, _ in load_standards(ROOT).values() for i in {*parse_index(doc), *parse_withdrawn(doc)}}
        self.assertEqual(check(DOC, MANIFEST, known), [])

    def test_the_index_is_not_empty(self):
        self.assertGreater(len(parse_index(DOC)), 40)

    def test_every_standard_in_the_tree_agrees(self):
        self.assertEqual(check_all(load_standards(ROOT)), [])

    def test_the_applier_standard_is_found(self):
        self.assertIn("applier", load_standards(ROOT))

    def test_the_bridge_standard_is_found(self):
        self.assertIn("bridge", load_standards(ROOT))
        ids = parse_index(load_standards(ROOT)["bridge"][0])
        self.assertTrue(all(i.startswith(("GA-BRIDGE-", "GA-BOX-", "GA-FIND-")) for i in ids), ids)

    def test_a_document_without_an_index_is_not_a_standard(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / "standard").mkdir()
            (root / "conformance").mkdir()
            (root / "standard" / "notes.md").write_text("# Notes\n\nNo index here.\n")
            self.assertEqual(load_standards(root), {})


class Mutations(unittest.TestCase):
    """Each mutation breaks the pair one way; the checker must see every one."""

    def test_an_id_missing_from_the_manifest(self):
        m = [r for r in MANIFEST if r["id"] != "GA-APPLY-6"]
        self.assertTrue(any("GA-APPLY-6" in e for e in check(DOC, m)))

    def test_an_id_missing_from_the_index(self):
        m = MANIFEST + [dict(MANIFEST[0], id="GA-FAKE-1")]
        self.assertTrue(any("GA-FAKE-1" in e for e in check(DOC, m)))

    def test_a_level_disagreement(self):
        m = [dict(r, conformance="Act") if r["id"] == "GA-SAFE-1" else r for r in MANIFEST]
        self.assertTrue(any("GA-SAFE-1" in e for e in check(DOC, m)))

    def test_a_verify_disagreement(self):
        m = [dict(r, verify="wire") if r["id"] == "GA-DESC-3" else r for r in MANIFEST]
        self.assertTrue(any("GA-DESC-3" in e for e in check(DOC, m)))

    def test_a_body_citation_to_no_requirement(self):
        doc = DOC + "\nThis cites GA-GHOST-9 in prose.\n"
        self.assertTrue(any("GA-GHOST-9" in e for e in check(doc, MANIFEST)))

    def test_a_duplicate_manifest_id(self):
        m = MANIFEST + [MANIFEST[0]]
        self.assertTrue(any(MANIFEST[0]["id"] in e for e in check(DOC, m)))


class TwoStandards(unittest.TestCase):
    """Ids are one namespace across the standards; each document has its own manifest."""

    def test_two_agreeing_standards_pass(self):
        s = {"a": (mini(["GA-X-1"]), manifest(["GA-X-1"])),
             "b": (mini(["GA-Y-1"]), manifest(["GA-Y-1"]))}
        self.assertEqual(check_all(s), [])

    def test_a_citation_into_the_other_standard_is_allowed(self):
        s = {"a": (mini(["GA-X-1"], "The other one's GA-Y-1 applies."), manifest(["GA-X-1"])),
             "b": (mini(["GA-Y-1"]), manifest(["GA-Y-1"]))}
        self.assertEqual(check_all(s), [])

    def test_a_citation_to_an_id_in_no_standard_fails(self):
        s = {"a": (mini(["GA-X-1"], "See GA-GHOST-2."), manifest(["GA-X-1"])),
             "b": (mini(["GA-Y-1"]), manifest(["GA-Y-1"]))}
        self.assertTrue(any("GA-GHOST-2" in e for e in check_all(s)))

    def test_one_id_in_two_indexes_fails(self):
        s = {"a": (mini(["GA-X-1"]), manifest(["GA-X-1"])),
             "b": (mini(["GA-X-1"]), manifest(["GA-X-1"]))}
        self.assertTrue(any("GA-X-1" in e and "two" in e for e in check_all(s)))

    def test_an_id_in_the_wrong_manifest_fails(self):
        s = {"a": (mini(["GA-X-1"]), manifest(["GA-Y-1"])),
             "b": (mini(["GA-Y-1"]), manifest(["GA-X-1"]))}
        errors = check_all(s)
        self.assertTrue(any(e.startswith("a:") and "GA-X-1" in e for e in errors))
        self.assertTrue(any(e.startswith("b:") and "GA-Y-1" in e for e in errors))


class Withdrawn(unittest.TestCase):
    """A withdrawn id stays citable (changelogs name it) but never returns to an index."""

    def test_a_withdrawn_id_is_parsed(self):
        doc = mini(["GA-X-1"]) + "\n## Withdrawn requirements\n\n- GA-X-2: replaced by GA-X-1\n"
        self.assertEqual(parse_withdrawn(doc), {"GA-X-2"})

    def test_citing_a_withdrawn_id_is_allowed(self):
        doc = mini(["GA-X-1"], "Was GA-X-2.") + "\n## Withdrawn requirements\n\n- GA-X-2: gone\n"
        self.assertEqual(check_all({"a": (doc, manifest(["GA-X-1"]))}), [])

    def test_a_withdrawn_id_back_in_an_index_fails(self):
        a = mini(["GA-X-1"]) + "\n## Withdrawn requirements\n\n- GA-X-2: gone\n"
        b = mini(["GA-X-2"])
        errors = check_all({"a": (a, manifest(["GA-X-1"])), "b": (b, manifest(["GA-X-2"]))})
        self.assertTrue(any("GA-X-2" in e and "withdrawn" in e for e in errors))


class UntaggedMusts(unittest.TestCase):
    """Every MUST in the body cites a requirement id, or says the harness does not check it."""

    def test_a_must_with_an_id_passes(self):
        self.assertEqual(untagged_musts(mini(["GA-X-1"], "It MUST do it (GA-X-1).")), [])

    def test_a_must_without_an_id_is_found(self):
        found = untagged_musts(mini(["GA-X-1"], "It MUST do the other thing."))
        self.assertEqual(len(found), 1)
        self.assertIn("other thing", found[0])

    def test_a_marked_unchecked_must_passes(self):
        body = "A consumer MUST ignore it. *Not checked by the harness.*"
        self.assertEqual(untagged_musts(mini(["GA-X-1"], body)), [])

    def test_the_unchecked_marker_may_break_across_lines(self):
        body = "A consumer MUST ignore it. *Not checked by\nthe harness.*"
        self.assertEqual(untagged_musts(mini(["GA-X-1"], body)), [])

    def test_the_index_and_changelog_are_not_body(self):
        doc = "## Changelog\n\n| d | v | It MUST now. |\n\n" + mini(["GA-X-1"])
        self.assertEqual(untagged_musts(doc), [])

    def test_each_list_item_is_its_own_block(self):
        body = "Rules:\n- one MUST do it (GA-X-1);\n- two MUST do more."
        self.assertEqual(len(untagged_musts(mini(["GA-X-1"], body))), 1)

    def test_check_all_reports_them(self):
        s = {"a": (mini(["GA-X-1"], "It MUST do the other thing."), manifest(["GA-X-1"]))}
        self.assertTrue(any("MUST without an id" in e for e in check_all(s)))


NEG = """
### Negative subjects

| Subject | Breaks | May also fail | Why those |
|---|---|---|---|
| `breaks-x` | GA-X-1 | GA-X-2 | shared clause |
| `breaks-y` | GA-X-2 | — | |
| `breaks-y-too` | GA-X-2 | GA-X-1 | |
"""


class NegativeSubjects(unittest.TestCase):
    """The text names each negative subject and what it may also fail; the manifest copies it."""

    def neg_manifest(self):
        m = manifest(["GA-X-1", "GA-X-2"])
        m[0]["negative_subjects"] = [{"subject": "breaks-x", "coupled": ["GA-X-2"]}]
        m[1]["negative_subjects"] = [{"subject": "breaks-y", "coupled": []},
                                     {"subject": "breaks-y-too", "coupled": ["GA-X-1"]}]
        return m

    def test_the_table_is_parsed(self):
        self.assertEqual(parse_negatives(mini(["GA-X-1", "GA-X-2"]) + NEG),
                         {"GA-X-1": [("breaks-x", ["GA-X-2"])],
                          "GA-X-2": [("breaks-y", []), ("breaks-y-too", ["GA-X-1"])]})

    def test_every_subject_of_an_id_is_kept(self):
        doc = mini(["GA-X-1", "GA-X-2"]) + NEG
        rec = {r["id"]: r for r in generate(doc)}["GA-X-2"]
        self.assertEqual([n["subject"] for n in rec["negative_subjects"]], ["breaks-y", "breaks-y-too"])

    def test_a_subject_missing_from_the_manifest_fails(self):
        doc = mini(["GA-X-1", "GA-X-2"]) + NEG
        m = self.neg_manifest()
        m[1]["negative_subjects"].pop()
        self.assertTrue(any("GA-X-2" in e and "negative subject" in e for e in check(doc, m)))

    def test_an_agreeing_manifest_passes(self):
        doc = mini(["GA-X-1", "GA-X-2"]) + NEG
        self.assertEqual(check(doc, self.neg_manifest()), [])

    def test_a_coupling_only_in_the_manifest_fails(self):
        doc = mini(["GA-X-1", "GA-X-2"]) + NEG
        m = self.neg_manifest()
        m[1]["negative_subjects"][0]["coupled"] = ["GA-X-1"]
        self.assertTrue(any("GA-X-2" in e and "negative subject" in e for e in check(doc, m)))

    def test_the_generated_manifest_agrees(self):
        doc = mini(["GA-X-1", "GA-X-2"]) + NEG
        self.assertEqual(check(doc, generate(doc)), [])

    def test_a_subject_only_in_the_manifest_fails(self):
        doc = mini(["GA-X-1", "GA-X-2"]) + NEG
        m = self.neg_manifest()
        m[1]["negative_subjects"][0]["subject"] = "ghost"
        self.assertTrue(any("GA-X-2" in e and "negative subject" in e for e in check(doc, m)))


class VerifyValues(unittest.TestCase):
    def doc(self, verify: str) -> str:
        return f"# A standard\n\n## Requirement index\n\n| GA-X-1 | MUST | Brain | {verify} | text |\n\n## After\n"

    def rec(self, verify: str) -> list:
        return [{"id": "GA-X-1", "level": "MUST", "conformance": "Brain", "verify": verify,
                 "text": "text", "negative_subjects": []}]

    def test_judged_is_accepted(self):
        self.assertEqual(check(self.doc("judged"), self.rec("judged")), [])

    def test_static_is_accepted(self):
        self.assertEqual(check(self.doc("static"), self.rec("static")), [])

    def test_a_misspelt_value_fails(self):
        errors = check(self.doc("judgd"), self.rec("judgd"))
        self.assertTrue(any("verify is judgd" in e for e in errors), errors)


CONSTANTS_DOC = """# A standard

## Constants

| Constant | Value | Where |
|---|---|---|
| Plan expiry | 60 s | *Planning* |
| Status interval | at most 10 s; within 1 s of a change | GA-BRIDGE-17; a fleet's |
| Heating load cap, default | 14400 s | GA-LOAD-2 ⚠️ a guess |
| `fresh_slack_s` for a bridged device | 11 s | GA-STATE-5 |
| History retention | 7 days | GA-EVT-5 |
| Apply bound | 0.5 ms | x |
| Something | none | y |

## Requirement index
"""


class Constants(unittest.TestCase):
    def test_each_row_becomes_a_constant(self):
        got = {c["key"]: c for c in parse_constants(CONSTANTS_DOC)}
        self.assertEqual(list(got), ["plan-expiry", "status-interval", "heating-load-cap-default",
                                     "fresh-slack-s-for-a-bridged-device", "history-retention",
                                     "apply-bound", "something"])
        self.assertEqual((got["plan-expiry"]["number"], got["plan-expiry"]["unit"]), (60, "s"))
        self.assertEqual(got["status-interval"]["number"], 10)
        self.assertEqual(got["status-interval"]["value"], "at most 10 s; within 1 s of a change")
        self.assertTrue(got["heating-load-cap-default"]["guess"])
        self.assertFalse(got["plan-expiry"]["guess"])
        self.assertEqual(got["fresh-slack-s-for-a-bridged-device"]["name"], "fresh_slack_s for a bridged device")
        self.assertEqual(got["history-retention"]["unit"], "days")
        self.assertEqual(got["apply-bound"]["number"], 0.5)
        self.assertIsNone(got["something"]["number"])
        self.assertIsInstance(got["plan-expiry"]["number"], int)

    def test_a_document_without_constants_has_none(self):
        self.assertEqual(parse_constants("# No constants\n"), [])

    def test_the_real_constants_files_agree(self):
        self.assertEqual(check_constants(ROOT, load_standards(ROOT)), [])

    def test_a_stale_constants_file_is_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / "conformance").mkdir()
            (root / "conformance" / "demo-constants.json").write_text("[]\n")
            errors = check_constants(root, {"demo": (CONSTANTS_DOC, [])})
            self.assertEqual(len(errors), 1)
            self.assertIn("demo-constants.json", errors[0])

    def test_keys_are_unique_in_every_real_standard(self):
        for name, (doc, _) in load_standards(ROOT).items():
            keys = [c["key"] for c in parse_constants(doc)]
            self.assertEqual(len(keys), len(set(keys)), name)


MAP_DOC = """# A standard

## Things

| Field | Values |
|---|---|
| `verdict` | `op` · `skip` |
| `reason` | for `skip`: `already`, `dead` |
| `a_b`, `c` | x |

Between.

| Operation | Request | Response |
|---|---|---|
| `describe` | `{ since_revision?, wait_s? }` | `{ id, levels, applier: { a, b }, test_run_id? }` |
| `apply` | `{ plan_id } \\| { request }` | `{ apply_id }` |

## After
"""


def write_map(root: pathlib.Path, entries: list, schemas: dict) -> None:
    root.mkdir(parents=True, exist_ok=True)
    (root / "text-map.json").write_text(json.dumps({"entries": entries}))
    for name, schema in schemas.items():
        (root / name).write_text(json.dumps(schema))


FIELDS = {"standard": "demo", "heading": "## Things", "table": 1, "kind": "fields", "column": "Field",
          "schema": "thing.json", "pointer": "", "case": "as_is"}
VALUES = {"standard": "demo", "heading": "## Things", "table": 1, "kind": "values", "row": "reason",
          "column": "Values", "ignore": ["skip"], "schema": "common.json", "pointer": "/$defs/reason/enum",
          "case": "as_is"}
SHAPE = {"standard": "demo", "heading": "## Things", "table": 2, "kind": "shape", "row": "describe",
         "column": "Response", "schema": "describe.json", "pointer": "", "case": "as_is"}
GOOD = {
    "thing.json": {"properties": {"verdict": {}, "reason": {}, "a_b": {}, "c": {}}},
    "common.json": {"$defs": {"reason": {"enum": ["already", "dead"]}}},
    "describe.json": {"properties": {"id": {}, "levels": {}, "applier": {}, "test_run_id": {}},
                      "required": ["id", "levels", "applier"]},
}


class TextMap(unittest.TestCase):
    def check(self, entries, schemas):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp) / "schemas"
            write_map(root, entries, schemas)
            return check_text_map({"demo": MAP_DOC}, root)

    def test_tables_are_found_under_their_heading(self):
        tables = tables_under(MAP_DOC, "## Things")
        self.assertEqual(len(tables), 2)
        self.assertEqual(tables[1]["header"], ["Operation", "Request", "Response"])
        self.assertEqual(tables[1]["rows"][1]["Request"], "`{ plan_id } | { request }`")
        self.assertIsNone(tables_under(MAP_DOC, "## Missing"))

    def test_shape_fields_reads_the_top_level_and_the_optional_mark(self):
        self.assertEqual(shape_fields("`{ id, levels, applier: { a, b }, test_run_id? }`"),
                         {"id": False, "levels": False, "applier": False, "test_run_id": True})
        self.assertIsNone(shape_fields("request"))

    def test_a_map_that_agrees_has_no_errors(self):
        self.assertEqual(self.check([FIELDS, VALUES, SHAPE], GOOD), [])

    def test_a_field_missing_from_the_schema_is_an_error(self):
        bad = {**GOOD, "thing.json": {"properties": {"verdict": {}, "reason": {}, "a_b": {}}}}
        errors = self.check([FIELDS], bad)
        self.assertEqual(len(errors), 1)
        self.assertIn("c in the text, not in the schema", errors[0])

    def test_a_field_only_in_the_schema_is_an_error(self):
        bad = {**GOOD, "thing.json": {"properties": {"verdict": {}, "reason": {}, "a_b": {}, "c": {}, "extra": {}}}}
        self.assertIn("extra in the schema, not in the text", self.check([FIELDS], bad)[0])

    def test_removing_an_enum_value_fails_the_check(self):
        bad = {**GOOD, "common.json": {"$defs": {"reason": {"enum": ["already"]}}}}
        self.assertIn("dead in the text, not in the schema", self.check([VALUES], bad)[0])

    def test_a_required_mismatch_is_an_error(self):
        bad = {**GOOD, "describe.json": {**GOOD["describe.json"], "required": ["id", "levels", "applier", "test_run_id"]}}
        self.assertIn("required", self.check([SHAPE], bad)[0])

    def test_camel_case_converts_the_texts_names(self):
        entry = {**FIELDS, "case": "camel"}
        schemas = {**GOOD, "thing.json": {"properties": {"verdict": {}, "reason": {}, "aB": {}, "c": {}}}}
        self.assertEqual(self.check([entry], schemas), [])

    def test_a_missing_table_row_column_or_pointer_is_an_error(self):
        for entry, text in [({**FIELDS, "table": 3}, "no such table"),
                            ({**VALUES, "row": "nothing"}, "no row nothing"),
                            ({**FIELDS, "column": "Nope"}, "no column Nope"),
                            ({**VALUES, "pointer": "/$defs/missing/enum"}, "does not exist")]:
            with self.subTest(text):
                self.assertIn(text, self.check([entry], GOOD)[0])

    def test_a_whole_column_checks_against_an_enum(self):
        entry = {**FIELDS, "kind": "column", "column": "Values", "schema": "common.json",
                 "pointer": "/$defs/reason/enum", "ignore": ["op", "skip"]}
        self.assertEqual(self.check([entry], GOOD), [])

    def test_a_field_required_under_a_condition_counts_as_required_where_the_map_says_so(self):
        # The 5b preflight's I4: configure's expected_revision is required unless every change is an ignore.
        conditional = {**GOOD, "describe.json": {"properties": GOOD["describe.json"]["properties"], "required": ["id", "levels"],
                                                 "if": {"properties": {"levels": {"const": []}}}, "else": {"required": ["applier"]}}}
        entry = {**SHAPE, "conditional": {"applier": "required unless levels is empty"}}
        self.assertEqual(self.check([entry], conditional), [])
        self.assertIn("required", self.check([SHAPE], conditional)[0])

    def test_a_conditional_field_the_schema_never_requires_is_an_error(self):
        never = {**GOOD, "describe.json": {"properties": GOOD["describe.json"]["properties"], "required": ["id", "levels"]}}
        entry = {**SHAPE, "conditional": {"applier": "required unless levels is empty"}}
        self.assertTrue(any("applier is conditional in the map, the schema requires it under no condition" in e
                            for e in self.check([entry], never)))

    def test_no_map_means_no_check(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(check_text_map({"demo": MAP_DOC}, pathlib.Path(tmp)), [])


class RealTextMap(unittest.TestCase):
    def test_the_real_map_agrees(self):
        docs = {n: d for n, (d, _) in load_standards(ROOT).items()}
        self.assertEqual(check_text_map(docs, ROOT / "conformance" / "schemas"), [])

    def test_removing_a_step_reason_from_the_real_schemas_fails(self):
        import shutil
        docs = {n: d for n, (d, _) in load_standards(ROOT).items()}
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp) / "schemas"
            shutil.copytree(ROOT / "conformance" / "schemas", root,
                            ignore=shutil.ignore_patterns("node_modules", "dist"))
            common = json.loads((root / "common.json").read_text())
            common["$defs"]["stepReason"]["enum"].remove("dead")
            (root / "common.json").write_text(json.dumps(common))
            errors = check_text_map(docs, root)
            self.assertTrue(any("dead in the text, not in the schema" in e for e in errors), errors)

    def test_removing_a_steward_reason_from_the_real_schemas_fails(self):
        import shutil
        docs = {n: d for n, (d, _) in load_standards(ROOT).items()}
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp) / "schemas"
            shutil.copytree(ROOT / "conformance" / "schemas", root,
                            ignore=shutil.ignore_patterns("node_modules", "dist"))
            common = json.loads((root / "common.json").read_text())
            common["$defs"]["stewardOwnReason"]["enum"].remove("leased")
            (root / "common.json").write_text(json.dumps(common))
            errors = check_text_map(docs, root)
            self.assertTrue(any("leased in the text, not in the schema" in e for e in errors), errors)


class ManifestSchemaCopy(unittest.TestCase):
    """@ludentes/galatea-life-schemas carries a copy of the bridge-type manifest schema, equal to its source."""

    def test_the_real_copy_equals_its_source(self):
        self.assertEqual(check_manifest_copy(ROOT / "conformance"), [])

    def test_a_copy_that_differs_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            conf = pathlib.Path(tmp)
            (conf / "schemas").mkdir()
            (conf / "galatea-bridge.schema.json").write_text('{"a": 1}\n')
            (conf / "schemas" / "galatea-bridge.schema.json").write_text('{"a": 2}\n')
            errors = check_manifest_copy(conf)
            self.assertTrue(any("differs from" in e for e in errors), errors)

    def test_a_missing_copy_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            conf = pathlib.Path(tmp)
            (conf / "galatea-bridge.schema.json").write_text("{}\n")
            self.assertTrue(any("missing" in e for e in check_manifest_copy(conf)))


if __name__ == "__main__":
    unittest.main()
