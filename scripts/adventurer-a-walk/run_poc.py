"""Experimental local ComfyUI img2img + OpenPose walk, always review-only."""
import argparse
import hashlib
import json
import shutil
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops

BASE = 'http://127.0.0.1:8188'
ANCHOR_SHA = '73c6569adf0510bbbfccb7d7da80578e8deb07ba9b1f773f530e0ed2e5342c91'
CONTROL = 'openpose-sd15-b25b1125.safetensors'

def get(path, data=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(BASE + path, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)

def workflow(anchor, pose, model, prefix, denoise=0.55, adapter=False, text2img=False):
    graph = {
        '1': {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': model}},
        '2': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['1', 1], 'text': 'full body right facing oblique three quarter medieval adventurer, detailed pixel art, charcoal tousled hair with silver forelock, short stubble, indigo split coat, cream sleeves, brown leather strapped boots, belt, pouches, sheathed sword on back, same character, compact 3 to 3.5 heads, small restrained face, natural walking pose, pixel art with irregular dry-brush contours and restrained charcoal, warm ivory and sparse muted vermilion, Japanese sumi-e on warm washi style, plain neutral background, no labels'}},
        '3': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['1', 1], 'text': 'photorealistic, anime gacha, glossy RPG chrome, oil-paint, flat clean clipart, neon, dominant teal, gold borders, changed identity, red scarf, extra limbs, duplicate, distorted anatomy, changed direction, text, watermark, blurred'}},
        '4': {'class_type': 'LoadImage', 'inputs': {'image': anchor}},
        '5': {'class_type': 'LoadImage', 'inputs': {'image': pose}},
        '6': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['4', 0], 'vae': ['1', 2]}},
        '7': {'class_type': 'ControlNetLoader', 'inputs': {'control_net_name': CONTROL}},
        '8': {'class_type': 'ControlNetApplyAdvanced', 'inputs': {'positive': ['2', 0], 'negative': ['3', 0], 'control_net': ['7', 0], 'image': ['5', 0], 'strength': 0.9, 'start_percent': 0.0, 'end_percent': 0.9}},
        '9': {'class_type': 'KSampler', 'inputs': {'model': ['1', 0], 'positive': ['8', 0], 'negative': ['8', 1], 'latent_image': ['6', 0], 'seed': 74293, 'steps': 18, 'cfg': 5.0, 'sampler_name': 'euler', 'scheduler': 'normal', 'denoise': denoise}},
        '10': {'class_type': 'VAEDecode', 'inputs': {'samples': ['9', 0], 'vae': ['1', 2]}},
        '11': {'class_type': 'SaveImage', 'inputs': {'images': ['10', 0], 'filename_prefix': prefix}},
    }
    if adapter:
        graph.update({
            '12': {'class_type': 'LoraLoader', 'inputs': {'model': ['1', 0], 'clip': ['1', 1], 'lora_name': 'pixel-art-sd15.safetensors', 'strength_model': 0.8, 'strength_clip': 0.8}},
            '13': {'class_type': 'IPAdapterModelLoader', 'inputs': {'ipadapter_file': 'ip-adapter-plus_sd15.safetensors'}},
            '14': {'class_type': 'CLIPVisionLoader', 'inputs': {'clip_name': 'clip_vision_h.safetensors'}},
            '15': {'class_type': 'IPAdapterAdvanced', 'inputs': {'model': ['12', 0], 'ipadapter': ['13', 0], 'clip_vision': ['14', 0], 'image': ['4', 0], 'weight': 0.8, 'weight_type': 'linear', 'combine_embeds': 'concat', 'start_at': 0.0, 'end_at': 1.0, 'embeds_scaling': 'V only'}},
        })
        graph['2']['inputs']['clip'] = ['12', 1]
        graph['3']['inputs']['clip'] = ['12', 1]
        graph['9']['inputs']['model'] = ['15', 0]
    if text2img:
        graph['6'] = {'class_type': 'EmptyLatentImage', 'inputs': {'width': 512, 'height': 512, 'batch_size': 1}}
        graph['9']['inputs']['denoise'] = 1.0
    return graph

def run(args):
    if args.text2img and not args.adapter:
        raise ValueError('Text-to-image mode requires the approved-anchor adapter')
    if hashlib.sha256(args.anchor.read_bytes()).hexdigest() != ANCHOR_SHA:
        raise ValueError('Approved Adventurer A anchor SHA-256 mismatch')
    with Image.open(args.anchor) as ref:
        ref = ref.convert('RGBA').resize((256, 384), Image.Resampling.NEAREST)
    expected = Image.new('RGBA', (512, 512), (128, 128, 128, 255))
    expected.alpha_composite(ref, (128, 64))
    with Image.open(args.study / 'anchor-input.png') as prepared:
        if ImageChops.difference(expected.convert('RGB'), prepared.convert('RGB')).getbbox():
            raise ValueError('Prepared image differs from the approved anchor transform')
    control_path = args.comfy / 'models' / 'controlnet' / CONTROL
    with control_path.open('rb') as control_file:
        control_sha = hashlib.file_digest(control_file, 'sha256').hexdigest()
    if control_sha != 'b25b1125e870275550b2a7de289056cb3c236c01c293bd5ba883657b1c006e3e':
        raise ValueError('ControlNet checksum mismatch')
    if args.adapter:
        for rel, expected_sha in [('models/ipadapter/ip-adapter-plus_sd15.safetensors', 'a1c250be40455cc61a43da1201ec3f1edaea71214865fb47f57927e06cbe4996'), ('models/clip_vision/clip_vision_h.safetensors', '64a7ef761bfccbadbaa3da77366aac4185a6c58fa5de5f589b42a65bcc21f161'), ('models/loras/pixel-art-sd15.safetensors', 'ad5034703699e910d5f9525ea5db64abcbd8d7396ff8f771c09403f3adb048ad')]:
            with (args.comfy / rel).open('rb') as f:
                if hashlib.file_digest(f, 'sha256').hexdigest() != expected_sha:
                    raise ValueError('Model checksum mismatch: ' + rel)
    devices = get('/system_stats').get('devices', [])
    if not any('RX 6800' in d.get('name', '') and d.get('type') == 'cuda' for d in devices):
        raise RuntimeError('ComfyUI did not report RX 6800 GPU')
    run_id = 'adventurer_a_' + uuid.uuid4().hex[:12]
    target = args.study / run_id
    target.mkdir(exist_ok=False)
    staging = args.comfy / 'input' / run_id
    staging.mkdir(exist_ok=False)
    shutil.copyfile(args.study / 'anchor-input.png', staging / 'anchor.png')
    frames = []
    indices = [0, 4] if args.contacts_only else list(range(8))
    for i in indices:
        shutil.copyfile(args.study / f'pose-{i:02}.png', staging / f'pose-{i:02}.png')
        graph = workflow(f'{run_id}/anchor.png', f'{run_id}/pose-{i:02}.png', args.checkpoint, f'{run_id}/frame-{i:02}', args.denoise, args.adapter, args.text2img)
        pid = get('/prompt', {'prompt': graph})['prompt_id']
        print(f'Frame {i+1}/8 queued: {pid}', flush=True)
        deadline = time.monotonic() + 600
        while time.monotonic() < deadline:
            item = get('/history/' + pid).get(pid)
            if item and item.get('status', {}).get('status_str') == 'error':
                raise RuntimeError('ComfyUI execution failed: ' + json.dumps(item['status'], ensure_ascii=False))
            images = item.get('outputs', {}).get('11', {}).get('images', []) if item else []
            if images:
                url = BASE + '/view?' + urllib.parse.urlencode({k: images[0].get(k, '') for k in ('filename', 'subfolder', 'type')})
                with urllib.request.urlopen(url, timeout=30) as response:
                    (target / f'frame-{i:02}.png').write_bytes(response.read())
                with Image.open(target / f'frame-{i:02}.png') as im:
                    if im.size != (512, 512):
                        raise ValueError('Unexpected frame dimensions')
                    frames.append(im.convert('RGB').resize((128, 128), Image.Resampling.NEAREST))
                print(f'Frame {i+1}/8 saved', flush=True)
                break
            time.sleep(2)
        else:
            raise TimeoutError('Job timed out; check the ComfyUI queue before retrying')
    sheet = Image.new('RGB', (128 * len(frames), 160), (32, 32, 32))
    draw = ImageDraw.Draw(sheet)
    for i, frame in enumerate(frames):
        sheet.paste(frame, (128 * i, 0))
        draw.text((128 * i + 5, 136), str(indices[i] + 1), fill='white')
    sheet.save(target / 'review-sheet.png')
    frames[0].save(target / 'review.gif', save_all=True, append_images=frames[1:], duration=125, loop=0)
    (target / 'manifest.json').write_text(json.dumps({'status': 'unapproved_experiment', 'anchor_sha256': ANCHOR_SHA, 'model': args.checkpoint, 'controlnet': CONTROL, 'seed': 74293, 'denoise': 1.0 if args.text2img else args.denoise, 'indices': indices, 'adapter': args.adapter, 'text2img': args.text2img, 'note': 'New provisional pose study; not the original approved mannequin. No runtime adoption.'}, indent=2), encoding='utf-8')
    print('Unapproved review output:', target)

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--study', type=Path, required=True)
    p.add_argument('--anchor', type=Path, required=True)
    p.add_argument('--comfy', type=Path, required=True)
    p.add_argument('--checkpoint', required=True)
    p.add_argument('--adapter', action='store_true', help='Use IP-Adapter Plus and pixel LoRA')
    p.add_argument('--text2img', action='store_true', help='Use an empty latent, retaining approved reference via adapter')
    p.add_argument('--contacts-only', action='store_true', help='Generate poses 1 and 5 only')
    p.add_argument('--denoise', type=float, default=0.55, choices=[0.35, 0.55, 0.75])
    run(p.parse_args())
