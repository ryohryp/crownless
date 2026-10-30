"""Safely register two review-only Depth ControlNet workflows in ComfyUI Local.

No job queued. Requires existing export_mcp_workflows.py and pinned models.
Preserve original anchor, all prior workflows and Crownless runtime assets.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('crownless_mcp_base', HERE/'export_mcp_workflows.py')
if not spec or not spec.loader:
    raise RuntimeError('Existing Crownless export_mcp_workflows.py is required')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
STAGE = 'crownless-mcp-adventurer-a-depth-v1'
DEPTH_MODEL = 'control_v11f1p_sd15_depth_fp16.safetensors'
# Official Hugging Face file page SHA-256; model is not bundled or auto-downloaded.
DEPTH_MODEL_SHA256 = '1c4a79aa52fb63f607cb9ff479ea5aa1923b6ceb21267bd14b69bd05d7b617be'
# Fixed-camera mesh-rasterized PNG hashes, not character-art approval.
DEPTH_IMAGE_SHA256 = {
    'a': 'f4f9c7d53853c26f5427a1c97941181aa40253fb2453dfff168815b04afe6ce9',
    'b': '5c5ef52952e286997d9ac856204c3e6ff1d66a0f1a082b6156a89664f69f7f4c',
}


def sha(path):
    with open(path,'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def checked_inputs(anchor, depth_dir):
    if sha(anchor) != base.walk.ANCHOR_SHA:
        raise ValueError('Crownless approved Adventurer A identity anchor SHA mismatch')
    with Image.open(anchor) as im:
        ref = im.convert('RGBA').resize((256,384),Image.Resampling.NEAREST)
    canvas = Image.new('RGBA',(512,512),(128,128,128,255))
    canvas.alpha_composite(ref,(128,64))
    mask = Image.new('L',(512,512),0)
    ImageDraw.Draw(mask).rectangle((175,304,361,438),fill=255)
    data={'anchor.png':canvas.convert('RGB'),
          'lower-mask.png':mask.filter(ImageFilter.GaussianBlur(7)).convert('RGB')}
    for label in ('a','b'):
        path=depth_dir/f'pose-{label}-depth.png'
        if sha(path)!=DEPTH_IMAGE_SHA256[label]:
            raise ValueError(f'Generated depth source SHA mismatch: {path}')
        with Image.open(path) as im:
            if im.size!=(512,512) or im.mode!='L':
                raise ValueError('Expected 512x512 grayscale depth control')
            data[f'pose-{label}-depth.png']=im.convert('RGB')
    return data


def workflow_json():
    result={}
    for label in ('a','b'):
        phase=('camera-near leg goes clearly forward, camera-far leg trails'
               if label=='a' else
               'camera-far leg goes clearly forward, camera-near leg trails')
        graph=base.walk.workflow(
            anchor=f'{STAGE}/anchor.png', pose=f'{STAGE}/pose-{label}-depth.png',
            model=base.walk.PIXEL_CHECKPOINT,
            prefix=f'crownless_mcp_candidate/adv_a_3d_depth_{label}',
            denoise=0.85, adapter=True, no_lora=True, sprite_trigger=True,
            phase=phase+', feet grounded, natural short step, no leg overlap',
            control_strength=1.0, lower_mask=f'{STAGE}/lower-mask.png')
        # Actual Depth model: no OpenPose loader in this new graph.
        graph['7']['inputs']['control_net_name']=DEPTH_MODEL
        graph['8']['inputs']['end_percent']=1.0
        graph['3']['inputs']['text']+=(
            ', long lunge, standing with legs together, exposed knee, disconnected'
            ' legs, floating soles, left-pointing boots, changed hair, distorted coat')
        result[f'adventurer-a-3d-depth-{label}.json']=(json.dumps(
            graph,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    return result


def install(args):
    if not args.allowlist.is_dir() or not (args.comfy/'input').is_dir():
        raise NotADirectoryError('Existing MCP allowlist and ComfyUI/input directories required')
    if not args.anchor.is_file():
        raise FileNotFoundError(args.anchor)
    for relative,expected in base.EXPECTED_HASHES.items():
        if sha(args.comfy/relative)!=expected:
            raise ValueError(f'Pinned existing model mismatch: {relative}')
    depth_model=args.comfy/'models'/'controlnet'/DEPTH_MODEL
    if not depth_model.is_file() or sha(depth_model)!=DEPTH_MODEL_SHA256:
        raise ValueError('Verified official SD1.5 Depth ControlNet missing or hash mismatch')
    inputs=checked_inputs(args.anchor,args.depth_dir)
    graphs=workflow_json()
    staged=args.comfy/'input'/STAGE
    if staged.is_symlink():
        raise ValueError('Refuse symlink staging directory')
    # Preflight every output before writing anything: no partial overwrite.
    for name,im in inputs.items():
        dest=staged/name
        if dest.is_symlink() or (dest.exists() and (
            not dest.is_file() or Image.open(dest).convert('RGB').tobytes()!=im.tobytes())):
            raise FileExistsError(f'Existing staged image differs: {dest}')
    for name,data in graphs.items():
        dest=args.allowlist/name
        if dest.is_symlink() or (dest.exists() and (
            not dest.is_file() or dest.read_bytes()!=data)):
            raise FileExistsError(f'Existing allowlisted workflow differs: {dest}')
    staged.mkdir(exist_ok=True)
    for name,im in inputs.items():
        if not (staged/name).exists():
            im.save(staged/name,format='PNG')
    for name,data in graphs.items():
        base.write_if_absent_or_identical(args.allowlist/name,data)
        print('Registered REVIEW ONLY:',name.removesuffix('.json'))
    print('No job submitted. Execute depth-a once and inspect before depth-b.')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--comfy',type=Path,required=True)
    parser.add_argument('--anchor',type=Path,required=True)
    parser.add_argument('--depth-dir',type=Path,required=True)
    parser.add_argument('--allowlist',type=Path,required=True)
    install(parser.parse_args())
