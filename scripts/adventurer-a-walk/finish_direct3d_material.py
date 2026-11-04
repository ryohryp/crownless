"""Protect the 3D silhouette while transferring ONLY luminance texture.

Accepts a future locally AI-painted color image, but does not let that image
relocate boots, deform knees, change hairstyle silhouette or swap clothing hue.
Review-only: output is never automatically a game asset.
"""
import argparse
from pathlib import Path
import numpy as np
from PIL import Image

def finish(geometry,paint,output,weight=.45):
    if not 0 <= weight <= 1:
        raise ValueError('weight must be in [0,1]')
    if output.exists():
        raise FileExistsError(f'Refuse to overwrite: {output}')
    with Image.open(geometry) as im:
        source=im.convert('RGBA')
    with Image.open(paint) as im:
        texture=im.convert('RGB')
    if source.size!=(512,512) or texture.size!=source.size:
        raise ValueError('Both images must be 512x512')
    before=np.asarray(source,dtype=np.uint8)
    suggested=np.asarray(texture,dtype=np.uint8)
    original=before[:,:,:3].astype(np.float32)
    light=original @ np.array([.2126,.7152,.0722],dtype=np.float32)
    ref=suggested.astype(np.float32) @ np.array([.2126,.7152,.0722],dtype=np.float32)
    # Transfer luminance only; no hue transfer, cutouts or shape displacement.
    gain=np.clip((ref+16)/(light+16),.80,1.20)
    brightness=1.0+weight*(gain-1.0)
    out=np.zeros_like(before)
    out[:,:,:3]=np.rint(np.clip(original*brightness[:,:,None],0,255)).astype(np.uint8)
    out[:,:,3]=before[:,:,3]  # The actual 3D frame owns alpha and geometry.
    out[before[:,:,3]==0,:3]=0
    output.parent.mkdir(parents=True,exist_ok=True)
    Image.fromarray(out,'RGBA').save(output)
    return output

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--geometry',type=Path,required=True)
    p.add_argument('--paint',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--weight',type=float,default=.45)
    a=p.parse_args()
    finish(a.geometry,a.paint,a.out,a.weight)
