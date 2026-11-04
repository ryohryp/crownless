"""Make sure style transfer cannot move the grounded 3D contact."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
    AVAILABLE=True
except ImportError:
    AVAILABLE=False

if AVAILABLE:
    file=Path(__file__).resolve().parents[1] / 'scripts/adventurer-a-walk/finish_direct3d_material.py'
    spec=importlib.util.spec_from_file_location('material_finishing',file)
    material=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(material)


@unittest.skipUnless(AVAILABLE,'Optional numpy and Pillow unavailable')
class ShapeLockedFinishTest(unittest.TestCase):
    def test_alpha_palette_and_non_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            alpha=np.zeros((512,512),np.uint8)
            alpha[80:400,200:370]=255
            base=np.zeros((512,512,4),np.uint8)
            base[:,:,:3]=[37,47,76]
            base[:,:,3]=alpha
            Image.fromarray(base,'RGBA').save(root/'geometry.png')
            Image.new('RGB',(512,512),(255,0,0)).save(root/'candidate.png')
            out=root/'finished.png'
            material.finish(root/'geometry.png',root/'candidate.png',out)
            actual=np.asarray(Image.open(out))
            self.assertTrue(np.array_equal(actual[:,:,3],alpha))
            self.assertTrue(np.all(actual[alpha==0,:3]==0))
            self.assertTrue(np.all(actual[alpha==255,2]>actual[alpha==255,0]))
            with self.assertRaises(FileExistsError):
                material.finish(root/'geometry.png',root/'candidate.png',out)
            with self.assertRaises(ValueError):
                material.finish(root/'geometry.png',root/'candidate.png',
                                root/'bad.png',weight=1.8)
