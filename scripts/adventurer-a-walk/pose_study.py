"""Create an unapproved 8-frame OpenPose study from the written gait contract.

The original approved mannequin is unavailable. These coordinates are a new
approximation for review, not a reconstruction of that approval.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

# COCO OpenPose colors/links. 512px canvas; ground is y=400.
LINKS = [((1, 2), (255, 0, 0)), ((2, 3), (255, 85, 0)), ((3, 4), (255, 170, 0)),
         ((1, 5), (255, 255, 0)), ((5, 6), (170, 255, 0)), ((6, 7), (85, 255, 0)),
         ((1, 8), (0, 255, 85)), ((8, 9), (0, 255, 170)), ((9, 10), (0, 255, 255)),
         ((1, 11), (0, 170, 255)), ((11, 12), (0, 85, 255)), ((12, 13), (0, 0, 255)),
         ((1, 0), (255, 0, 255))]


def poses():
    # Alternating contact; in passing frames one foot lifts. All positions are
    # authored explicitly for inspectability; this does not establish natural gait.
    steps = [(68, -52, 400, 400), (43, -34, 400, 385), (0, 0, 400, 378),
             (-34, 43, 400, 385), (-52, 68, 400, 400), (-34, 43, 385, 400),
             (0, 0, 378, 400), (43, -34, 385, 400)]
    for i, (near_x, far_x, near_y, far_y) in enumerate(steps):
        bob = (0, 3, -2, 3, 0, 3, -2, 3)[i]
        shoulder_swing = near_x * 0.25
        yield {
            0: (258, 158 + bob), 1: (255, 205 + bob),
            2: (238, 207 + bob), 3: (230 - shoulder_swing, 250 + bob), 4: (226 - shoulder_swing * 1.6, 290 + bob),
            5: (273, 208 + bob), 6: (280 + shoulder_swing, 250 + bob), 7: (284 + shoulder_swing * 1.6, 290 + bob),
            8: (244, 302 + bob), 9: (244 + near_x * .52, 352 + bob), 10: (244 + near_x, near_y),
            11: (267, 302 + bob), 12: (267 + far_x * .52, 352 + bob), 13: (267 + far_x, far_y),
        }


def create(output, anchor):
    output.mkdir(parents=True, exist_ok=False)
    with Image.open(anchor) as ref:
        ref = ref.convert('RGBA').resize((256, 384), Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', (512, 512), (128, 128, 128, 255))
    canvas.alpha_composite(ref, (128, 64))
    canvas.convert('RGB').save(output / 'anchor-input.png')
    frames = []
    for i, points in enumerate(poses()):
        im = Image.new('RGB', (512, 512), (0, 0, 0))
        draw = ImageDraw.Draw(im)
        for (a, b), color in LINKS:
            draw.line((points[a], points[b]), fill=color, width=9)
        for point in points.values():
            x, y = point
            draw.ellipse((x-5, y-5, x+5, y+5), fill=(255, 255, 255))
        im.save(output / f'pose-{i:02}.png')
        preview = im.copy()
        pd = ImageDraw.Draw(preview)
        pd.line((100, 400, 412, 400), fill=(120, 120, 120), width=2)
        pd.text((12, 12), f'{i+1}/8 PROVISIONAL', fill='white')
        frames.append(preview)
    frames[0].save(output / 'pose-review.gif', save_all=True, append_images=frames[1:], duration=125, loop=0)


if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('output', type=Path, help='new empty output directory')
    p.add_argument('anchor', type=Path, help='approved Adventurer A anchor PNG')
    args = p.parse_args()
    create(args.output, args.anchor)
