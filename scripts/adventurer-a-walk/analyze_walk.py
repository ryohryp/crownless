"""Coarse foreground bounding boxes for reviewing, not approving, a walk.

Requires a nearly uniform opaque corner background. It cannot identify boots,
feet, anatomy, identity, contact or naturalness; inspect the images/animation.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops


def measure(image, threshold=28):
    im=image.convert('RGB')
    if im.size != (512,512):
        raise ValueError('Expected a 512x512 frame')
    corners=[im.getpixel(p) for p in ((0,0),(511,0),(0,511),(511,511))]
    if any(max(abs(c[k]-corners[0][k]) for k in range(3))>12 for c in corners):
        raise ValueError('Background corners differ; threshold is not applicable')
    bg=Image.new('RGB',im.size,corners[0]); channels=ImageChops.difference(im,bg).split()
    diff=ImageChops.lighter(ImageChops.lighter(channels[0],channels[1]),channels[2])
    mask=diff.point(lambda v:255 if v>threshold else 0)
    box=mask.getbbox()
    if box is None:
        raise ValueError('No foreground detected')
    x0,y0,x1,y1=box
    bottom_band=mask.crop((0,max(0,y1-6),512,y1)).getbbox()
    return {'bbox_inclusive':[x0,y0,x1-1,y1-1],
            'lowest_six_rows_x_span':[bottom_band[0],bottom_band[2]-1],
            'corner_rgb':list(corners[0])}


def run(directory,output):
    if output.exists():
        raise FileExistsError(f'Refusing to replace {output}')
    frames=[]
    for i in range(8):
        path=directory/f'frame-{i:02}.png'
        with Image.open(path) as image:
            result=measure(image)
        result.update({'frame':i,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
        frames.append(result)
    result={'status':'diagnostic_only_not_art_or_gait_approval','threshold':28,
            'limitations':'Background/outline threshold only; does not identify feet, torso, contact, crossing, or identity.',
            'frames':frames,'bottom_row_range':max(f['bbox_inclusive'][3] for f in frames)-min(f['bbox_inclusive'][3] for f in frames),
            'top_row_range':max(f['bbox_inclusive'][1] for f in frames)-min(f['bbox_inclusive'][1] for f in frames)}
    with output.open('x',encoding='utf-8') as f:
        json.dump(result,f,indent=2)
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('directory',type=Path);p.add_argument('output',type=Path)
    args=p.parse_args();run(args.directory,args.output)
