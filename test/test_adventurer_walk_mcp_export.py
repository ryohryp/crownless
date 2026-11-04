"""Tests for the two bounded ComfyUI Local MCP contact exports."""
import importlib.util
import json
import pathlib
import tempfile
import types
import unittest
from unittest.mock import patch

from PIL import Image

ROOT = pathlib.Path(__file__).parents[1]
SOURCE = ROOT / "scripts/adventurer-a-walk/export_mcp_workflows.py"
spec = importlib.util.spec_from_file_location("export_mcp_workflows", SOURCE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class McpContactExportTest(unittest.TestCase):
    def test_two_workflows_use_approved_reference_and_opposing_pose(self):
        files = mod.build_workflows()
        self.assertEqual(set(files), {
            "adventurer-a-near-contact.json", "adventurer-a-far-contact.json"
        })
        for label, frame in [("near", "00"), ("far", "04")]:
            graph = json.loads(files[f"adventurer-a-{label}-contact.json"])
            self.assertEqual(graph["1"]["inputs"]["ckpt_name"], "public-prompts-pixel.safetensors")
            self.assertEqual(graph["4"]["inputs"]["image"],
                             "crownless-mcp-adventurer-a-v1/anchor.png")
            self.assertEqual(graph["5"]["inputs"]["image"],
                             f"crownless-mcp-adventurer-a-v1/pose-{frame}.png")
            self.assertEqual(graph["8"]["inputs"]["strength"], 1.4)
            self.assertEqual(graph["9"]["inputs"]["denoise"], 1.0)
            self.assertEqual(graph["9"]["inputs"]["latent_image"], ["42", 0])
            self.assertEqual(graph["11"]["class_type"], "SaveImage")
            self.assertIn("leg forward", graph["2"]["inputs"]["text"])
            self.assertIn("lower-mask.png", graph["40"]["inputs"]["image"])

    def test_export_is_idempotent_and_refuses_changed_inputs(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            study = root / "study"
            study.mkdir()
            comfy = root / "ComfyUI"
            (comfy / "input").mkdir(parents=True)
            allowlist = root / "mcp-allowlist"
            allowlist.mkdir()
            for name in ("anchor-input.png", "lower-mask.png",
                         "pose-00.png", "pose-04.png"):
                Image.new("RGB", (512, 512), (128, 128, 128)).save(study / name)
            args = types.SimpleNamespace(
                study=study, anchor=root / "unused-anchor.png",
                comfy=comfy, workflow_dir=allowlist
            )
            with patch.object(mod, "validate_approved_inputs"):
                mod.export(args)
                mod.export(args)
                self.assertEqual(len(list(allowlist.glob("*.json"))), 2)
                Image.new("RGB", (512, 512), (4, 5, 6)).save(study / "pose-00.png")
                with self.assertRaises(FileExistsError):
                    mod.export(args)
                self.assertTrue((allowlist / "adventurer-a-near-contact.json").exists())

    def test_export_refuses_missing_allowlist(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            args = types.SimpleNamespace(
                study=root, anchor=root / "none.png", comfy=root,
                workflow_dir=root / "missing"
            )
            with self.assertRaises(NotADirectoryError):
                mod.export(args)


if __name__ == "__main__":
    unittest.main()
