import importlib.util
import hashlib
from unittest.mock import patch
import torch
from safetensors.torch import load_file
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).parents[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod
study = load('pose_study', 'scripts/adventurer-a-walk/pose_study.py')
poc = load('run_poc', 'scripts/adventurer-a-walk/run_poc.py')
conversion = load('conversion', 'scripts/adventurer-a-walk/convert_pixel_checkpoint.py')

class WalkPocTest(unittest.TestCase):
    def test_eight_distinct_temporal_poses_contact_and_passing(self):
        poses = list(study.poses())
        self.assertEqual(len(poses), 8)
        self.assertEqual(len({tuple(sorted(p.items())) for p in poses}), 8)
        self.assertEqual((poses[0][10][1], poses[0][13][1]), (400, 400))
        self.assertEqual((poses[4][10][1], poses[4][13][1]), (400, 400))
        self.assertGreater(poses[0][10][0], poses[0][13][0])
        self.assertLess(poses[4][10][0], poses[4][13][0])
        self.assertLess(poses[2][13][1], 400)
        self.assertLess(poses[6][10][1], 400)
        self.assertTrue(all(max(p[10][1], p[13][1]) == 400 for p in poses))
        self.assertLessEqual(max(p[0][1] for p in poses) - min(p[0][1] for p in poses), 5)
        face = list(study.poses(face_guide=True))
        self.assertEqual(len(face), 8)
        self.assertTrue(all(p[0][0] > p[1][0] and all(i in p for i in (14, 15, 16, 17)) for p in face))

    def test_study_creates_new_outputs_and_preserves_anchor(self):
        anchor = ROOT / 'docs/assets/adventurer-a-approved-anchor-v1.png'
        before = anchor.read_bytes()
        with tempfile.TemporaryDirectory() as temp:
            out = pathlib.Path(temp) / 'new'
            study.create(out, anchor)
            self.assertEqual(len(list(out.glob('pose-*.png'))), 8)
            self.assertTrue((out / 'pose-review.gif').exists())
            with self.assertRaises(FileExistsError):
                study.create(out, anchor)
        self.assertEqual(anchor.read_bytes(), before)

    def test_conversion_rejects_unverified_bytes_without_creating_output(self):
        with tempfile.TemporaryDirectory() as temp:
            source = pathlib.Path(temp) / 'unknown.ckpt'
            target = pathlib.Path(temp) / 'out.safetensors'
            source.write_bytes(b'unverified')
            with self.assertRaisesRegex(ValueError, 'hash differs'):
                conversion.convert(source, target)
            self.assertFalse(target.exists())

    def test_conversion_roundtrips_tensors_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            source = pathlib.Path(temp) / 'input.ckpt'
            target = pathlib.Path(temp) / 'out.safetensors'
            torch.save({'state_dict': {'model.x': torch.tensor([1.5, 2.5])}}, source)
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            with patch.object(conversion, 'EXPECTED', digest):
                conversion.convert(source, target)
                self.assertTrue(torch.equal(load_file(str(target))['model.x'], torch.tensor([1.5, 2.5])))
                original = target.read_bytes()
                with self.assertRaises(FileExistsError):
                    conversion.convert(source, target)
                self.assertEqual(target.read_bytes(), original)

    def test_workflow_uses_same_anchor_and_pose_control(self):
        g = poc.workflow('reference.png', 'pose.png', 'test.safetensors', 'candidate')
        self.assertEqual(g['4']['inputs']['image'], 'reference.png')
        self.assertEqual(g['5']['inputs']['image'], 'pose.png')
        self.assertEqual(g['8']['class_type'], 'ControlNetApplyAdvanced')
        self.assertEqual(g['9']['inputs']['latent_image'], ['6', 0])
        self.assertEqual(g['6']['inputs']['pixels'], ['4', 0])
        a = poc.workflow('reference.png', 'pose.png', 'test.safetensors', 'candidate', adapter=True)
        self.assertEqual(a['15']['inputs']['image'], ['4', 0])
        self.assertEqual(a['9']['inputs']['model'], ['15', 0])
        self.assertEqual(a['8']['inputs']['image'], ['5', 0])
        t = poc.workflow('reference.png', 'pose.png', 'test.safetensors', 'candidate', adapter=True, text2img=True)
        self.assertEqual(t['6']['class_type'], 'EmptyLatentImage')
        self.assertEqual(t['9']['inputs']['denoise'], 1.0)
        self.assertEqual(t['15']['inputs']['image'], ['4', 0])
        pixel = poc.workflow('reference.png', 'pose.png', 'pixel.safetensors', 'candidate', adapter=True, text2img=True, no_lora=True, sprite_trigger=True)
        self.assertNotIn('12', pixel)
        self.assertEqual(pixel['15']['inputs']['model'], ['1', 0])
        self.assertEqual(pixel['2']['inputs']['clip'], ['1', 1])
        self.assertIn('pixelsprite', pixel['2']['inputs']['text'])
        phased = poc.workflow('reference.png', 'pose.png', 'pixel.safetensors', 'candidate', phase='near foot forward', control_strength=1.4)
        self.assertIn('near foot forward', phased['2']['inputs']['text'])
        self.assertEqual(phased['8']['inputs']['strength'], 1.4)

if __name__ == '__main__':
    unittest.main()
