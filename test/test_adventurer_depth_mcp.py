"""3D Depth MCP graph wiring and safe installation preflight."""
import importlib.util
import json
import hashlib
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

    def test_png_encoding_changes_are_ok_but_pixel_changes_are_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            anchor=root/'anchor.png'
            Image.new('RGB',(256,384),'gray').save(anchor)
            image=Image.new('L',(512,512),5)
            image.putpixel((256,403),190)
            canonical_hash=hashlib.sha256(image.tobytes()).hexdigest()
            with patch.dict(register.DEPTH_IMAGE_PIXEL_SHA256,
                            {'a':canonical_hash,'b':canonical_hash},clear=True):
                image.save(root/'pose-a-depth.png',compress_level=0)
                image.save(root/'pose-b-depth.png',compress_level=9)
                self.assertNotEqual(
                    register.sha(root/'pose-a-depth.png'),
                    register.sha(root/'pose-b-depth.png'),
                    'PNG encoding was intended to differ while decoded pixels match')
                with patch.object(register,'sha',return_value=register.base.walk.ANCHOR_SHA):
                    valid=register.checked_inputs(anchor,root)
                    self.assertEqual(valid['pose-a-depth.png'].size,(512,512))
                    self.assertEqual(valid['pose-b-depth.png'].size,(512,512))
                    image.putpixel((256,403),191)
                    image.save(root/'pose-b-depth.png',compress_level=9)
                    with self.assertRaisesRegex(ValueError,'depth pixels differ'):
                        register.checked_inputs(anchor,root)

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
