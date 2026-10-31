import importlib.util
import io
import json
import pathlib
import sys
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('comfy_smoke', pathlib.Path(__file__).parents[1] / 'scripts' / 'comfy-smoke.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)

class SmokeTest(unittest.TestCase):
    def run_main(self, replies):
        with patch.object(sys, 'argv', ['comfy-smoke.py', '--checkpoint', 'test.safetensors']), \
             patch.object(smoke, 'request', side_effect=replies) as request, \
             patch.object(smoke, 'image_dimensions', return_value=(512, 512)), \
             patch('sys.stdout', new_callable=io.StringIO):
            smoke.main()
            return request

    def test_completes_only_when_saved_image_is_present(self):
        calls = self.run_main([
            {'devices': [{'type': 'cuda', 'name': 'AMD Radeon RX 6800'}]},
            {'prompt_id': 'test-id'},
            {'test-id': {'outputs': {'7': {'images': [{'filename': 'crownless_smoke_00001_.png'}]}}}},
        ])
        prompt = calls.call_args_list[1].args[1]['prompt']
        self.assertEqual((prompt['4']['inputs']['width'], prompt['4']['inputs']['height']), (512, 512))
        self.assertEqual(prompt['1']['inputs']['ckpt_name'], 'test.safetensors')

    def test_refuses_cpu_before_queueing(self):
        with self.assertRaisesRegex(RuntimeError, 'No GPU'):
            self.run_main([{'devices': [{'type': 'cpu', 'name': 'cpu'}]}])

    def test_reports_job_error(self):
        with self.assertRaisesRegex(RuntimeError, 'execution error'):
            self.run_main([
                {'devices': [{'type': 'cuda', 'name': 'GPU'}]}, {'prompt_id': 'test-id'},
                {'test-id': {'status': {'status_str': 'error'}}},
            ])

if __name__ == '__main__':
    unittest.main()
