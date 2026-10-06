"""The bridge manifest schema accepts the valid examples and refuses each broken one."""
import json
import pathlib
import re
import unittest

import jsonschema

HERE = pathlib.Path(__file__).parent
SCHEMA = HERE / "galatea-bridge.schema.json"
EXAMPLES = HERE / "examples" / "manifests"
BRIDGE = HERE.parent / "standard" / "bridge.md"


def load_schema() -> dict:
    return json.loads(SCHEMA.read_text())


def errors_for(manifest: dict) -> list:
    validator = jsonschema.Draft202012Validator(load_schema())
    return [e.message for e in validator.iter_errors(manifest)]


class SchemaTest(unittest.TestCase):
    def test_the_schema_is_a_valid_schema(self):
        jsonschema.Draft202012Validator.check_schema(load_schema())

    def test_every_valid_example_passes(self):
        files = sorted(EXAMPLES.glob("*.json"))
        self.assertGreaterEqual(len(files), 4)
        for f in files:
            with self.subTest(f.name):
                self.assertEqual(errors_for(json.loads(f.read_text())), [])

    def test_every_invalid_example_fails(self):
        files = sorted((EXAMPLES / "invalid").glob("*.json"))
        self.assertGreaterEqual(len(files), 13)
        for f in files:
            with self.subTest(f.name):
                self.assertNotEqual(errors_for(json.loads(f.read_text())), [])

    def test_no_matchers_is_allowed(self):
        # A bridge type with nothing to hear (Modbus) still ships a manifest.
        m = json.loads((EXAMPLES / "esphome.json").read_text())
        m["matchers"] = []
        self.assertEqual(errors_for(m), [])


class StandardExampleTest(unittest.TestCase):
    def test_the_standards_example_manifest_is_valid(self):
        blocks = re.findall(r"```json\n(.*?)```", BRIDGE.read_text(), re.S)
        manifests = [json.loads(b) for b in blocks if '"matchers"' in b]
        self.assertEqual(len(manifests), 1, "bridge.md prints exactly one example manifest")
        self.assertEqual(errors_for(manifests[0]), [])


if __name__ == "__main__":
    unittest.main()
