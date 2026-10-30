"""Safety/graph tests for the actual 3D contact MCP registration script."""
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from PIL import Image

PATH = Path(__file__).resolve().parents[1] / "scripts/adventurer-a-walk/register_3d_contact_mcp.py"
spec = importlib.util.spec_from_file_location("mcp_3d", PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class ThreeDContactMcpExportTest(TestCase):
    def test_two_distinct_opposite_contact_workflows(self):
        graphs = mod.graphs()
        self.assertEqual(set(graphs), {
            "adventurer-a-3d-contact-a.json", "adventurer-a-3d-contact-b.json"})
        for letter in ("a", "b"):
            graph = json.loads(graphs[f"adventurer-a-3d-contact-{letter}.json"])
            self.assertEqual(graph["4"]["inputs"]["image"], f"{mod.STAGE}/anchor.png")
            self.assertEqual(graph["5"]["inputs"]["image"], f"{mod.STAGE}/pose-{letter}.png")
            self.assertEqual(graph["40"]["inputs"]["image"], f"{mod.STAGE}/lower-mask.png")
            self.assertEqual(graph["9"]["inputs"]["latent_image"], ["42", 0])
            self.assertEqual(graph["9"]["inputs"]["denoise"], 0.85)
            self.assertEqual(graph["8"]["inputs"]["strength"], 1.4)
            self.assertNotIn("12", graph, "No-Lora path must omit the LoRA loader")
        self.assertNotEqual(graphs["adventurer-a-3d-contact-a.json"],
                            graphs["adventurer-a-3d-contact-b.json"])

    def test_unverified_openpose_control_is_rejected(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            Image.new("RGB", (512, 512), "black").save(root / "pose-a-openpose.png")
            Image.new("RGB", (512, 512), "black").save(root / "pose-b-openpose.png")
            with patch.object(mod.base, "sha256", return_value=mod.base.walk.ANCHOR_SHA):
                with self.assertRaisesRegex(ValueError, "3D a control"):
                    mod.staged_inputs(root, root / "fake-approved.png")

    def test_conflicting_allowlist_rejected_before_any_write(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            comfy = root / "ComfyUI"
            (comfy / "input").mkdir(parents=True)
            allowlist = root / "mcp-workflows"
            allowlist.mkdir()
            (allowlist / "adventurer-a-3d-contact-a.json").write_bytes(b"preexisting")
            args = SimpleNamespace(comfy=comfy, workflow_dir=allowlist,
                                   study=root, anchor=root / "unused.png")
            fake = {name: Image.new("RGB", (512, 512), "black")
                    for name in ("anchor.png","lower-mask.png","pose-a.png","pose-b.png")}
            with patch.dict(mod.base.EXPECTED_HASHES, {}, clear=True):
                with patch.object(mod, "staged_inputs", return_value=fake):
                    with self.assertRaisesRegex(FileExistsError, "Conflicting allowlisted"):
                        mod.install(args)
            self.assertEqual((allowlist / "adventurer-a-3d-contact-a.json").read_bytes(),
                             b"preexisting")
            self.assertFalse((comfy / "input" / mod.STAGE).exists())
