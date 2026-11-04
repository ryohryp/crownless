"""Deterministic 3D Depth candidate tests; optional 3D tooling dependencies."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'scripts/adventurer-a-walk/export_depth_controls.py'
try:
    import numpy as np
    import trimesh
    from PIL import Image
    AVAILABLE=True
except ImportError:
    AVAILABLE=False
if AVAILABLE:
    spec=importlib.util.spec_from_file_location('depth_candidate',SOURCE)
    depth=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(depth)


@unittest.skipUnless(AVAILABLE,'Optional numpy/trimesh/Pillow required for 3D depth')
class DepthCandidateTest(unittest.TestCase):
    def test_fixed_camera_and_genuine_surface_occlusion(self):
        src=depth.source_module(ROOT/'scripts/adventurer-a-walk/prepare_pose_3d.py')
        a=src.make_scene('A')
        b=src.make_scene('B')
        self.assertTrue(src.validate_pair(a[2],b[2]))
        ga,ma,oa=depth.rasterize(src,a[1])
        gb,mb,ob=depth.rasterize(src,b[1])
        self.assertEqual(ga.shape,(512,512))
        self.assertTrue(np.all(ga[~ma]==0))
        self.assertTrue(np.all(gb[~mb]==0))
        self.assertGreater(np.count_nonzero(ma),20000)
        self.assertGreater(np.count_nonzero(mb),20000)
        self.assertEqual(int(np.count_nonzero(ga!=gb)),25666)
        for ownership,meshes in ((oa,a[1]),(ob,b[1])):
            for prefix in ('near_','far_'):
                indexes=[i for i,(_,_,name) in enumerate(meshes) if name.startswith(prefix)]
                self.assertGreater(np.count_nonzero(np.isin(ownership,indexes)),1500)

    def test_output_hashes_no_overwrite(self):
        src=ROOT/'scripts/adventurer-a-walk/prepare_pose_3d.py'
        with tempfile.TemporaryDirectory() as directory:
            out=Path(directory)/'control'
            meta=depth.produce(out,src)
            self.assertEqual(meta['pose_a_front_leg'],'near')
            self.assertEqual(meta['pose_b_front_leg'],'far')
            self.assertEqual(meta['pixel_sha256']['A']['depth'],
                             '3ab036afe74a7d5d87b44779fe3d33af7bc218d10e37d0e424c85d6827fafa7c')
            self.assertEqual(meta['pixel_sha256']['B']['depth'],
                             'd68a874f4c0889a0ec6a564ef58068f0f262c98adce8da8c32ee3bf19c3fccbb')
            for label in 'ab':
                with Image.open(out/f'pose-{label}-depth.png') as image:
                    self.assertEqual(image.size,(512,512))
                    self.assertEqual(image.mode,'L')
            with self.assertRaises(FileExistsError):
                depth.produce(out,src)
