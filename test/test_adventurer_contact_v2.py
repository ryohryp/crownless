"""Geometry/JSON checks; requires repository sibling modules and Pillow, not GPU."""
import importlib.util
import math
from pathlib import Path
import unittest

module_path = Path(__file__).resolve().parents[1] / 'scripts' / 'adventurer-a-walk' / 'contact_v2.py'
spec = importlib.util.spec_from_file_location('contact_v2_test', module_path)
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)


class ContactV2Tests(unittest.TestCase):
    def test_opposite_contacts_are_symmetric_and_grounded(self):
        contacts = [v2.pose(i, near_x, far_x) for _, i, near_x, far_x, _ in v2.CONTACTS]
        self.assertEqual(contacts[0][10], (282, 400))
        self.assertEqual(contacts[0][13], (230, 400))
        self.assertEqual(contacts[1][10], (230, 400))
        self.assertEqual(contacts[1][13], (282, 400))
        self.assertEqual(abs(contacts[0][10][0] - contacts[0][13][0]), 52)
        self.assertEqual(abs(contacts[1][10][0] - contacts[1][13][0]), 52)

    def test_lower_joint_lengths_are_constant(self):
        for _, index, near_x, far_x, _ in v2.CONTACTS:
            p = v2.pose(index, near_x, far_x)
            for hip, knee, ankle in [(8, 9, 10), (11, 12, 13)]:
                self.assertAlmostEqual(math.dist(p[hip], p[knee]), v2.ik.LEG_LENGTH, places=5)
                self.assertAlmostEqual(math.dist(p[knee], p[ankle]), v2.ik.LEG_LENGTH, places=5)

    def test_no_change_to_upper_body_in_guides(self):
        original = list(v2.ik.poses())
        for _, index, near_x, far_x, _ in v2.CONTACTS:
            p = v2.pose(index, near_x, far_x)
            for joint in range(8):
                self.assertEqual(p[joint], original[index][joint])

    def test_graphs_keep_approved_anchor_and_mask(self):
        graphs = v2.make_graphs()
        self.assertEqual(set(graphs), {'adventurer-a-near-contact-v2.json',
                                       'adventurer-a-far-contact-v2.json'})
        for label in ('near', 'far'):
            import json
            g = json.loads(graphs[f'adventurer-a-{label}-contact-v2.json'])
            self.assertEqual(g['4']['inputs']['image'], f'{v2.STAGE}/anchor.png')
            self.assertEqual(g['40']['inputs']['image'], f'{v2.STAGE}/lower-mask.png')
            self.assertEqual(g['9']['inputs']['denoise'], 0.65)
            self.assertEqual(g['8']['inputs']['strength'], 1.25)
            self.assertEqual(g['11']['inputs']['filename_prefix'], f'crownless_mcp_candidate/adv_a_{label}_contact_v2')
            self.assertIn('continuous dark trousers', g['2']['inputs']['text'])


if __name__ == '__main__':
    unittest.main()
