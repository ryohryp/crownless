"""Review-only 8-frame AnimateDiff + OpenPose + approved-reference experiment."""
import argparse
import hashlib
import importlib.util
import json
import shutil
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

spec = importlib.util.spec_from_file_location('walk_poc', Path(__file__).with_name('run_poc.py'))
walk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(walk)
MOTION = 'v3_sd15_mm.safetensors'
MOTION_SHA = '73c4b969c778b2ea96a172c3b432572b654e91865f9f224a709dbda13e730043'


def digest(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def workflow(reference, poses, prefix, img2img=False, control_strength=1.4):
    if len(poses) != 8:
        raise ValueError('Exactly eight temporal pose images are required')
    graph = walk.workflow(reference, poses[0], walk.PIXEL_CHECKPOINT, prefix, adapter=True, text2img=True, no_lora=True, sprite_trigger=True, control_strength=1.4)
    # In one KSampler call, the motion module couples all 8 latent frames.
    graph['8']['inputs']['strength'] = control_strength
    if img2img:
        graph['6'] = {'class_type': 'VAEEncode', 'inputs': {'pixels': ['4', 0], 'vae': ['1', 2]}}
        graph['19'] = {'class_type': 'RepeatLatentBatch', 'inputs': {'samples': ['6', 0], 'amount': 8}}
        graph['9']['inputs']['latent_image'] = ['19', 0]
        graph['9']['inputs']['denoise'] = 0.65
    else:
        graph['6']['inputs']['batch_size'] = 8
    graph['16'] = {'class_type': 'ADE_LoadAnimateDiffModel', 'inputs': {'model_name': MOTION}}
    graph['17'] = {'class_type': 'ADE_ApplyAnimateDiffModelSimple', 'inputs': {'motion_model': ['16', 0]}}
    graph['18'] = {'class_type': 'ADE_UseEvolvedSampling', 'inputs': {'model': ['15', 0], 'beta_schedule': 'autoselect', 'm_models': ['17', 0]}}
    graph['9']['inputs']['model'] = ['18', 0]
    # Standard ComfyUI ImageBatch preserves order; ControlNet gets one pose per latent.
    for i, pose in enumerate(poses):
        graph[str(20+i)] = {'class_type': 'LoadImage', 'inputs': {'image': pose}}
    previous = ['20', 0]
    for i in range(1, 8):
        key = str(30+i)
        graph[key] = {'class_type': 'ImageBatch', 'inputs': {'image1': previous, 'image2': [str(20+i), 0]}}
        previous = [key, 0]
    graph['8']['inputs']['image'] = previous
    return graph


def run(args):
    files = {
        args.anchor: walk.ANCHOR_SHA,
        args.comfy/'models/checkpoints'/walk.PIXEL_CHECKPOINT: walk.PIXEL_SHA,
        args.comfy/'models/controlnet'/walk.CONTROL: 'b25b1125e870275550b2a7de289056cb3c236c01c293bd5ba883657b1c006e3e',
        args.comfy/'models/ipadapter/ip-adapter-plus_sd15.safetensors': 'a1c250be40455cc61a43da1201ec3f1edaea71214865fb47f57927e06cbe4996',
        args.comfy/'models/clip_vision/clip_vision_h.safetensors': '64a7ef761bfccbadbaa3da77366aac4185a6c58fa5de5f589b42a65bcc21f161',
        args.comfy/'models/animatediff_models'/MOTION: MOTION_SHA,
    }
    for path, expected in files.items():
        if digest(path) != expected:
            raise ValueError(f'Pinned file hash mismatch: {path.name}')
    with Image.open(args.anchor) as ref:
        ref = ref.convert('RGBA').resize((256, 384), Image.Resampling.NEAREST)
    expected = Image.new('RGBA', (512, 512), (128, 128, 128, 255))
    expected.alpha_composite(ref, (128, 64))
    with Image.open(args.study/'anchor-input.png') as supplied:
        if ImageChops.difference(expected.convert('RGB'), supplied.convert('RGB')).getbbox():
            raise ValueError('Prepared image differs from approved anchor')
    if not any('RX 6800' in d.get('name','') and d.get('type') == 'cuda' for d in walk.get('/system_stats').get('devices', [])):
        raise RuntimeError('ComfyUI did not report RX 6800')
    run_id = 'adventurer_a_temporal_' + uuid.uuid4().hex[:12]
    target = args.study/run_id
    target.mkdir(exist_ok=False)
    staging = args.comfy/'input'/run_id
    staging.mkdir(exist_ok=False)
    shutil.copyfile(args.study/'anchor-input.png', staging/'anchor.png')
    for i in range(8):
        shutil.copyfile(args.study/f'pose-{i:02}.png', staging/f'pose-{i:02}.png')
    pose_inputs = [f'{run_id}/pose-{i:02}.png' for i in range(8)]
    graph = workflow(f'{run_id}/anchor.png', pose_inputs, f'{run_id}/frames', args.img2img, args.control_strength)
    pid = walk.get('/prompt', {'prompt': graph})['prompt_id']
    print('Queued 8-frame temporal job:', pid, flush=True)
    deadline = time.monotonic()+1200
    while time.monotonic()<deadline:
        result = walk.get('/history/'+pid).get(pid)
        if result and result.get('status', {}).get('status_str') == 'error':
            raise RuntimeError('ComfyUI execution failed: '+json.dumps(result['status'],ensure_ascii=False))
        images = result.get('outputs', {}).get('11', {}).get('images', []) if result else []
        if images:
            if len(images)!=8:
                raise ValueError(f'Expected eight ordered frames; received {len(images)}')
            break
        time.sleep(2)
    else:
        raise TimeoutError('Job timed out; check queue before retrying')
    frames=[]
    for i, meta in enumerate(images):
        url=walk.BASE+'/view?'+urllib.parse.urlencode({k:meta.get(k,'') for k in ('filename','subfolder','type')})
        with urllib.request.urlopen(url,timeout=30) as response:
            (target/f'frame-{i:02}.png').write_bytes(response.read())
        with Image.open(target/f'frame-{i:02}.png') as im:
            if im.size!=(512,512): raise ValueError('Unexpected frame dimensions')
            frames.append(im.convert('RGB').resize((128,128),Image.Resampling.NEAREST))
    sheet=Image.new('RGB',(1024,160),(32,32,32))
    draw=ImageDraw.Draw(sheet)
    for i, frame in enumerate(frames):
        sheet.paste(frame,(i*128,0)); draw.text((i*128+5,136),str(i+1),fill='white')
    sheet.save(target/'review-sheet.png')
    frames[0].save(target/'review.gif',save_all=True,append_images=frames[1:],duration=125,loop=0)
    manifest={'status':'unapproved_experiment','motion_model':MOTION,'motion_sha256':MOTION_SHA,'anchor_sha256':walk.ANCHOR_SHA,'checkpoint_sha256':walk.PIXEL_SHA,'seed':74293,'frames':8,'img2img':args.img2img,'denoise':0.65 if args.img2img else 1.0,'control_strength':args.control_strength,'pose_sha256':[digest(args.study/f'pose-{i:02}.png') for i in range(8)],'note':'Provisional pose guide, not the missing approved mannequin; no runtime adoption.'}
    (target/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print('Unapproved review output:',target,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--img2img',action='store_true',help='Repeat the approved anchor latent for all eight frames')
    p.add_argument('--control-strength',type=float,choices=[0.9,1.4],default=1.4)
    p.add_argument('--study',type=Path,required=True)
    p.add_argument('--anchor',type=Path,required=True)
    p.add_argument('--comfy',type=Path,required=True)
    run(p.parse_args())
