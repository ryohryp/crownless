"""A new, unapproved OpenPose walk guide with fixed-length legs.

This is not the missing approved mannequin. Positions are a compact procedural
study for local ControlNet experiments and require visual/human review.
"""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

# OpenPose COCO body connections and palette, based on the ControlNet renderer.
# Only the first 17 limbs are rendered; the shoulder-to-ear links are omitted.
PALETTE = [(255,0,0),(255,85,0),(255,170,0),(255,255,0),(170,255,0),
           (85,255,0),(0,255,0),(0,255,85),(0,255,170),(0,255,255),
           (0,170,255),(0,85,255),(0,0,255),(85,0,255),(170,0,255),
           (255,0,255),(255,0,170),(255,0,85)]
LIMBS = [(1,2),(1,5),(2,3),(3,4),(5,6),(6,7),(1,8),(8,9),(9,10),
         (1,11),(11,12),(12,13),(1,0),(0,14),(14,16),(0,15),(15,17)]
LEG_LENGTH = 62.0
GROUND = 400


def knee(hip, ankle, length=LEG_LENGTH):
    """Solve equal-length 2D leg segments with the knee bending toward +x."""
    dx,dy = ankle[0]-hip[0],ankle[1]-hip[1]
    distance = math.hypot(dx,dy)
    if not 0 < distance <= 2*length:
        raise ValueError('Leg endpoints cannot be reached with the fixed segments')
    offset = math.sqrt(max(0.0,length*length-(distance/2)**2))
    return ((hip[0]+ankle[0])/2 + dy/distance*offset,
            (hip[1]+ankle[1])/2 - dx/distance*offset)


def poses():
    near_offsets = [60,30,0,-30,-60,-30,0,30]
    near_y = [400,400,400,400,400,384,376,384]
    far_y  = [400,384,376,384,400,400,400,400]
    bob    = [0,1,-2,1,0,1,-2,1]
    for i, x in enumerate(near_offsets):
        b=bob[i]
        hip_near=(244,302+b); hip_far=(267,302+b)
        ankle_near=(244+x,near_y[i]); ankle_far=(267-x,far_y[i])
        swing=x*0.25
        points={0:(277,158+b),1:(255,205+b),2:(238,207+b),
                3:(230-swing,250+b),4:(226-swing*1.6,290+b),
                5:(273,208+b),6:(280+swing,250+b),7:(284+swing*1.6,290+b),
                8:hip_near,9:knee(hip_near,ankle_near),10:ankle_near,
                11:hip_far,12:knee(hip_far,ankle_far),13:ankle_far,
                14:(270,152+b),15:(260,153+b),16:(275,156+b),17:(248,157+b)}
        yield points


def create(output,anchor):
    output.mkdir(parents=True,exist_ok=False)
    with Image.open(anchor) as ref:
        ref=ref.convert('RGBA').resize((256,384),Image.Resampling.NEAREST)
    canvas=Image.new('RGBA',(512,512),(128,128,128,255))
    canvas.alpha_composite(ref,(128,64))
    canvas.convert('RGB').save(output/'anchor-input.png')
    frames=[]; data=[]
    for i,points in enumerate(poses()):
        im=Image.new('RGB',(512,512),(0,0,0)); draw=ImageDraw.Draw(im)
        # 60% intensity approximates the original OpenPose limb overlay.
        for index,(a,b) in enumerate(LIMBS):
            color=tuple(round(c*0.6) for c in PALETTE[index])
            draw.line((points[a],points[b]),fill=color,width=8)
        for index,(x,y) in points.items():
            draw.ellipse((x-4,y-4,x+4,y+4),fill=PALETTE[index])
        im.save(output/f'pose-{i:02}.png')
        review=im.copy(); rd=ImageDraw.Draw(review)
        rd.line((100,GROUND,412,GROUND),fill=(135,135,135),width=2)
        for index,color in [(10,(255,110,80)),(13,(90,170,255))]:
            x,y=points[index]; rd.line((x-4,y,x+14,y),fill=color,width=3)
        rd.text((12,12),f'{i+1}/8 UNAPPROVED',fill='white')
        frames.append(review)
        data.append({'frame':i,'points':{str(k):list(v) for k,v in points.items()},
                     'near_grounded':points[10][1]==GROUND,'far_grounded':points[13][1]==GROUND})
    frames[0].save(output/'pose-review.gif',save_all=True,append_images=frames[1:],duration=125,loop=0)
    (output/'guide.json').write_text(json.dumps({'status':'provisional_not_original','ground_y':GROUND,'leg_length':LEG_LENGTH,'frames':data},indent=2),encoding='utf-8')

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('output',type=Path);p.add_argument('anchor',type=Path)
    args=p.parse_args();create(args.output,args.anchor)
