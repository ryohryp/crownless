import argparse
import json
import sys
import time
import struct
import urllib.parse
import urllib.error
import urllib.request

BASE = 'http://127.0.0.1:8188'

def request(path, data=None):
    body = None if data is None else json.dumps(data).encode('utf-8')
    req = urllib.request.Request(BASE + path, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)

def image_dimensions(image):
    query = urllib.parse.urlencode({k: image.get(k, '') for k in ('filename', 'subfolder', 'type')})
    with urllib.request.urlopen(BASE + '/view?' + query, timeout=15) as response:
        header = response.read(24)
    if len(header) != 24 or header[:8] != b'\x89PNG\r\n\x1a\n' or header[12:16] != b'IHDR':
        raise RuntimeError('Saved output is not a PNG with a valid header')
    return struct.unpack('>II', header[16:24])

def main():
    parser = argparse.ArgumentParser(description='Run a 512x512 ComfyUI smoke on a local server')
    parser.add_argument('--checkpoint', required=True, help='Exact checkpoint filename shown by ComfyUI')
    parser.add_argument('--timeout', type=int, default=900)
    args = parser.parse_args()
    stats = request('/system_stats')
    devices = stats.get('devices', [])
    print('ComfyUI devices:', json.dumps(devices, ensure_ascii=False))
    if not any(d.get('type') == 'cuda' and 'cpu' not in d.get('name', '').lower() for d in devices):
        raise RuntimeError('No GPU reported by ComfyUI; refusing to call this a GPU smoke test.')
    workflow = {
        '1': {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': args.checkpoint}},
        '2': {'class_type': 'CLIPTextEncode', 'inputs': {'text': 'a simple red apple on a wooden table', 'clip': ['1', 1]}},
        '3': {'class_type': 'CLIPTextEncode', 'inputs': {'text': 'text, watermark', 'clip': ['1', 1]}},
        '4': {'class_type': 'EmptyLatentImage', 'inputs': {'width': 512, 'height': 512, 'batch_size': 1}},
        '5': {'class_type': 'KSampler', 'inputs': {'model': ['1', 0], 'positive': ['2', 0], 'negative': ['3', 0], 'latent_image': ['4', 0], 'seed': 1234, 'steps': 8, 'cfg': 5, 'sampler_name': 'euler', 'scheduler': 'normal', 'denoise': 1}},
        '6': {'class_type': 'VAEDecode', 'inputs': {'samples': ['5', 0], 'vae': ['1', 2]}},
        '7': {'class_type': 'SaveImage', 'inputs': {'images': ['6', 0], 'filename_prefix': 'crownless_smoke'}},
    }
    prompt_id = request('/prompt', {'prompt': workflow})['prompt_id']
    print('Queued:', prompt_id, flush=True)
    deadline = time.monotonic() + args.timeout
    while time.monotonic() < deadline:
        history = request('/history/' + prompt_id).get(prompt_id)
        if history:
            if history.get('status', {}).get('status_str') == 'error':
                raise RuntimeError('ComfyUI reported execution error: ' + json.dumps(history['status'], ensure_ascii=False))
            images = history.get('outputs', {}).get('7', {}).get('images', [])
            if images:
                if image_dimensions(images[0]) != (512, 512):
                    raise RuntimeError('Saved PNG does not have the requested 512x512 dimensions')
                print('Verified 512x512 PNG saved in ComfyUI output:', json.dumps(images, ensure_ascii=False))
                return
        time.sleep(2)
    raise TimeoutError('Timed out; job may still be running in ComfyUI. Check its queue before retrying.')

if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, RuntimeError, TimeoutError, urllib.error.URLError) as exc:
        print('Smoke failed:', exc, file=sys.stderr)
        sys.exit(1)
