"""3D-grounded, opposite contacts; never infer playability from this unit test."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'scripts/adventurer-a-walk/direct3d_contacts.py'
BASE=ROOT/'scripts/adventurer-a-walk/prepare_pose_3d.py'
try:
    import numpy as np
    from PIL import Image
    import trimesh
    REQUIRED=True
except ImportError:
    REQUIRED=False

if REQUIRED:
    spec=importlib.util.spec_from_file_location('crownless_direct3d_contacts',SOURCE)
    direct=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(direct)


@unittest.skipUnless(REQUIRED,'Optional numpy/trimesh/Pillow 3D dependencies are absent')
class Direct3DContactTest(unittest.TestCase):
    def test_grounded_boot_soles_and_true_front_leg_reversal(self):
        scenes=[direct.scene_for_pose(BASE,label) for label in 'ab']
        def center_x(scene,side):
            bounds=scene.geometry[side+'_boot'].bounds
            return (bounds[0,0]+bounds[1,0])/2
        for scene in scenes:
            for side in ('near','far'):
                self.assertAlmostEqual(
                    float(scene.geometry[side+'_boot'].bounds[0,2]),0,places=6)
            self.assertIn('head',scene.geometry)
            self.assertIn('scabbard',scene.geometry)
        self.assertGreater(center_x(scenes[0],'near'),center_x(scenes[0],'far'))
        self.assertLess(center_x(scenes[1],'near'),center_x(scenes[1],'far'))
        self.assertEqual(scenes[0].geometry['head'].bounds.tolist(),
                         scenes[1].geometry['head'].bounds.tolist())

    def test_two_3d_assets_and_two_distinct_transparent_frames(self):
        with tempfile.TemporaryDirectory() as root:
            out=Path(root)/'review'
            result=direct.build(out,BASE)
            self.assertEqual(result['status'],'review_only_direct_3d_material_trial')
            self.assertNotEqual(result['phases']['a']['render_sha256'],
                                result['phases']['b']['render_sha256'])
            for label in 'ab':
                self.assertEqual(result['phases'][label]['soles_world_z'],[0,0])
                with Image.open(out/f'pose-{label}-direct3d.png') as frame:
                    self.assertEqual(frame.mode,'RGBA')
                    self.assertEqual(frame.size,(512,512))
                    self.assertGreater(
                        np.count_nonzero(np.array(frame.getchannel('A'))),2000)
                    self.assertEqual(frame.getpixel((10,10))[3],0)
                geometry=trimesh.load(out/f'pose-{label}-direct3d.glb',force='scene')
                self.assertGreater(len(geometry.geometry),35)
                self.assertTrue((out/f'pose-{label}-review.png').is_file())
            with Image.open(out/'phone-scale-qa.png') as sheet:
                self.assertEqual(sheet.size,(344,200))
            with self.assertRaisesRegex(FileExistsError,'Refuse overwrite'):
                direct.build(out,BASE)
