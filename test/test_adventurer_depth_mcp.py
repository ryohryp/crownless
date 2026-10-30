"""3D Depth MCP graph wiring and safe installation preflight."""
import importlib.util
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/'scripts/adventurer-a-walk/register_depth_mcp.py'
spec=importlib.util.spec_from_file_location('register_depth_mcp',SCRIPT)
register=importlib.util.module_from_spec(spec)
spec.loader.exec_module(register)


class RegisterDepthTest(unittest.TestCase):
    def test_depth_loader_replaces_openpose_and_uses_distinct_controls(self):
        entries=register.workflow_json()
        self.assertEqual(set(entries),{'adventurer-a-3d-depth-a.json','adventurer-a-3d-depth-b.json'})
        for side in 'ab':
            graph=json.loads(entries[f'adventurer-a-3d-depth-{side}.json'])
            self.assertEqual(graph['7']['inputs']['control_net_name'],register.DEPTH_MODEL)
            self.assertEqual(graph['8']['inputs']['end_percent'],1.0)
            self.assertEqual(graph['5']['inputs']['image'],
                             f'{register.STAGE}/pose-{side}-depth.png')
            self.assertEqual(graph['9']['inputs']['denoise'],0.85)
            self.assertEqual(graph['9']['inputs']['latent_image'],['42',0])

    def test_missing_depth_model_refuses_all_output(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); comfy=root/'ComfyUI'; (comfy/'input').mkdir(parents=True)
            allow=root/'allowed';allow.mkdir()
            anchor=root/'source.png';Image.new('RGB',(16,16)).save(anchor)
            args=types.SimpleNamespace(comfy=comfy,allowlist=allow,anchor=anchor,depth_dir=root)
            with patch.dict(register.base.EXPECTED_HASHES,{},clear=True):
                with self.assertRaisesRegex(ValueError,'Depth ControlNet'):
                    register.install(args)
            self.assertEqual(list(allow.iterdir()),[])
            self.assertEqual(list((comfy/'input').iterdir()),[])

    def test_collision_fails_before_staging_any_input(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);comfy=root/'ComfyUI';(comfy/'input').mkdir(parents=True)
            model=comfy/'models'/'controlnet'/register.DEPTH_MODEL
            model.parent.mkdir(parents=True);model.write_bytes(b'fake')
            allow=root/'allowed';allow.mkdir()
            old=allow/'adventurer-a-3d-depth-a.json';old.write_bytes(b'keep me')
            anchor=root/'source.png';Image.new('RGB',(16,16)).save(anchor)
            args=types.SimpleNamespace(comfy=comfy,allowlist=allow,anchor=anchor,depth_dir=root)
            original_sha=register.sha
            def model_fake_sha(path):
                return register.DEPTH_MODEL_SHA256 if path==model else original_sha(path)
            with patch.dict(register.base.EXPECTED_HASHES,{},clear=True):
                with patch.object(register,'sha',side_effect=model_fake_sha):
                    with patch.object(register,'checked_inputs',
                                      return_value={'anchor.png':Image.new('RGB',(512,512))}):
                        with self.assertRaises(FileExistsError):
                            register.install(args)
            self.assertEqual(old.read_bytes(),b'keep me')
            self.assertFalse((comfy/'input'/register.STAGE).exists())
