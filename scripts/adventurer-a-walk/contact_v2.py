"""Export smaller-stride, opposite-contact Adventurer A candidates to ComfyUI Local MCP.

Never overwrite an approved anchor, a prior candidate, or a registered workflow.
The exported graphs are still unapproved experiments, not game assets.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


def load_sibling(name):
    path = Path(__file__).with_name(name + '.py')
    spec = importlib.util.spec_from_file_location(name + '_for_contact_v2', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ik = load_sibling('pose_study_ik')
base = load_sibling('export_mcp_workflows')
walk = base.walk
STAGE = 'crownless-mcp-adventurer-a-v2'
# The former guide put two boots nearly 100px apart. Reduce the two contact
# extremes to a symmetric 52px, leaving the grounded leg lengths reachable.
CONTACTS = (
    ('near', 0, 282, 230, 'near-side leg steps forward a SHORT distance; far-side leg trails; both boots planted'),
    ('far', 4, 230, 282, 'far-side leg steps forward a SHORT distance; near-side leg trails; both boots planted'),
)


def pose(index, near_foot_x, far_foot_x):
    """Keep the known oblique upper body, change only leg joints and contacts."""
    points = dict(list(ik.poses())[index])
    points[10] = (near_foot_x, ik.GROUND)
    points[13] = (far_foot_x, ik.GROUND)
    points[9] = ik.knee(points[8], points[10])
    points[12] = ik.knee(points[11], points[13])
    return points


def draw_pose(points):
    result = Image.new('RGB', (512, 512), (0, 0, 0))
    draw = ImageDraw.Draw(result)
    for i, (a, b) in enumerate(ik.LIMBS):
        color = tuple(round(c * 0.6) for c in ik.PALETTE[i])
        draw.line((points[a], points[b]), fill=color, width=8)
    for i, (x, y) in points.items():
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=ik.PALETTE[i])
    return result


def create_study(study, anchor):
    if study.exists():
        raise FileExistsError(f'Choose a fresh study directory: {study}')
    if base.sha256(anchor) != walk.ANCHOR_SHA:
        raise ValueError('Approved Adventurer A identity anchor changed')
    study.mkdir(parents=True, exist_ok=False)
    with Image.open(anchor) as original:
        source = original.convert('RGBA').resize((256, 384), Image.Resampling.NEAREST)
    prepared = Image.new('RGBA', (512, 512), (128, 128, 128, 255))
    prepared.alpha_composite(source, (128, 64))
    prepared.convert('RGB').save(study / 'anchor-input.png')

    # Preserve face, torso, sleeves and belt. Permit only lower trousers/boots
    # to change. Mask is narrower than the v1 experiment (no coat-wide redraw).
    mask = Image.new('L', (512, 512), 0)
    ImageDraw.Draw(mask).rectangle((175, 304, 361, 438), fill=255)
    mask.filter(ImageFilter.GaussianBlur(7)).convert('RGB').save(study / 'lower-mask.png')
    guide = []
    for label, index, near_x, far_x, phase in CONTACTS:
        points = pose(index, near_x, far_x)
        draw_pose(points).save(study / f'pose-{index:02}.png')
        guide.append({'label': label, 'frame': index,
                      'near_ankle': list(points[10]), 'far_ankle': list(points[13]),
                      'near_knee': list(points[9]), 'far_knee': list(points[12]),
                      'phase': phase})
    (study / 'guide-v2.json').write_text(json.dumps({'status': 'unapproved_candidate_guide',
        'anchor_sha256': walk.ANCHOR_SHA, 'ground_y': ik.GROUND,
        'contact_separation_px': 52, 'contacts': guide}, indent=2), encoding='utf-8')


def make_graphs():
    result = {}
    for label, index, near_x, far_x, phase in CONTACTS:
        graph = walk.workflow(
            anchor=f'{STAGE}/anchor.png', pose=f'{STAGE}/pose-{index:02}.png',
            model=walk.PIXEL_CHECKPOINT, prefix=f'crownless_mcp_candidate/adv_a_{label}_contact_v2',
            denoise=0.65, adapter=True, no_lora=True, sprite_trigger=True,
            phase=phase, control_strength=1.25, lower_mask=f'{STAGE}/lower-mask.png')
        graph['2']['inputs']['text'] += (
            ', small natural step, continuous dark trousers cover both knees, '
            'both leather boots have flat grounded soles and toes pointing right, '
            'consistent coat and equipment, same camera and stable upper body')
        graph['3']['inputs']['text'] += (
            ', exposed knee, bare thigh, missing trousers, long lunge, '
            'raised front knee, leaping, floating foot, left pointing boot, '
            'broken ankles, stretched leg')
        graph['8']['inputs']['end_percent'] = 0.95
        result[f'adventurer-a-{label}-contact-v2.json'] = (
            json.dumps(graph, indent=2, ensure_ascii=False) + '\n').encode('utf-8')
    return result


def install(args):
    if not args.workflow_dir.is_dir():
        raise NotADirectoryError('Existing MCP workflow allowlist directory required')
    if not (args.comfy / 'input').is_dir():
        raise NotADirectoryError('ComfyUI input directory not found')
    if args.study.exists():
        raise FileExistsError(f'Study already exists: {args.study}')
    if base.sha256(args.anchor) != walk.ANCHOR_SHA:
        raise ValueError('Approved identity anchor checksum mismatch')
    # Check local model provenance before creating any new assets.
    for rel, expected_sha in base.EXPECTED_HASHES.items():
        if base.sha256(args.comfy / rel) != expected_sha:
            raise ValueError(f'Model checksum mismatch: {rel}')
    graphs = make_graphs()
    stage = args.comfy / 'input' / STAGE
    if stage.exists():
        raise FileExistsError(f'Existing v2 staged directory: {stage}')
    for name in graphs:
        if (args.workflow_dir / name).exists():
            raise FileExistsError(f'Existing v2 workflow: {name}')
    create_study(args.study, args.anchor)
    base.validate_approved_inputs(args)
    stage.mkdir(exist_ok=False)
    for name, source in [('anchor.png', 'anchor-input.png'),
                         ('lower-mask.png', 'lower-mask.png'),
                         ('pose-00.png', 'pose-00.png'),
                         ('pose-04.png', 'pose-04.png')]:
        base.write_if_absent_or_identical(stage / name, (args.study / source).read_bytes())
    for name, payload in graphs.items():
        base.write_if_absent_or_identical(args.workflow_dir / name, payload)
        print('Registered REVIEW ONLY:', name.removesuffix('.json'))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--study', required=True, type=Path)
    parser.add_argument('--anchor', required=True, type=Path)
    parser.add_argument('--comfy', required=True, type=Path)
    parser.add_argument('--workflow-dir', required=True, type=Path)
    install(parser.parse_args())
