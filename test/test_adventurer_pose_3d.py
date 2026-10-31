"""Geometric contract tests for Adventurer A's procedural 3D contact guides.

This is an optional Python tooling test; other Crownless tests do not need
trimesh or matplotlib. Run in a venv with numpy/trimesh/matplotlib/Pillow.
"""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

try:
    import numpy as np
    import trimesh
    from PIL import Image
    HAS_3D_DEPS=True
except ImportError:
    HAS_3D_DEPS=False

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'scripts/adventurer-a-walk/prepare_pose_3d.py'
if HAS_3D_DEPS:
    spec=importlib.util.spec_from_file_location('prepare_pose_3d', SOURCE)
    pose=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pose)


@unittest.skipUnless(HAS_3D_DEPS, 'Optional 3D dependencies not installed')
class Pose3DTest(unittest.TestCase):
    def test_geometry_and_camera_are_fixed(self):
        a,b=pose.joints_for_pose('A'),pose.joints_for_pose('B')
        self.assertTrue(pose.validate_pair(a,b))
        self.assertGreater(a['near_ankle'][0],a['far_ankle'][0])
        self.assertLess(b['near_ankle'][0],b['far_ankle'][0])
        for part in ('near','far'):
            for state in (a,b):
                self.assertAlmostEqual(state[part+'_ankle'][2],.19)
                self.assertAlmostEqual(
                    np.linalg.norm(
                        np.array(state[part+'_knee'])-state[part+'_hip']
                    ),
                    pose.LEG_BONE,
                )
        self.assertEqual(a['head'],b['head'])

    def test_exports_two_real_meshes_and_two_pose_guides(self):
        try:
            import matplotlib
        except ImportError:
            self.skipTest('matplotlib optional render dependency missing')
        with tempfile.TemporaryDirectory() as d:
            target=Path(d)/'test-output'
            meta=pose.produce(target)
            self.assertEqual(meta['poses']['A']['front_leg'],'near')
            self.assertEqual(meta['poses']['B']['front_leg'],'far')
            self.assertEqual(len(list(target.glob('*.glb'))),2)
            for suffix in ('a','b'):
                scene=trimesh.load(target/f'contact-{suffix}.glb')
                self.assertTrue(len(scene.geometry)>0)
                self.assertGreater(max(scene.bounds[1]-scene.bounds[0]),2.)
                for name in (f'contact-{suffix}.png',f'pose-{suffix}-openpose.png'):
                    with Image.open(target/name) as image:
                        self.assertEqual(image.size,(512,512))
            self.assertTrue((target/'contact-sheet.png').is_file())
            self.assertIn('camera',json.loads((target/'geometry.json').read_text()))
            with self.assertRaises(FileExistsError):
                pose.produce(target)


if __name__=='__main__':
    unittest.main()
