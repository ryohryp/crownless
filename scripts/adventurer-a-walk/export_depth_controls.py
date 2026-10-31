"""Render visible 3D surface depth for two Adventurer A contact poses.

Requires numpy, trimesh, Pillow; reuses original prepare_pose_3d.py.
These are unapproved ControlNet guide images, NOT game sprites.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

MIN_DEPTH, MAX_DEPTH = -0.35, 1.30


def source_module(path):
    spec=importlib.util.spec_from_file_location('adventurer_3d_geometry',path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def rasterize(src, meshes):
    az=math.radians(src.CAM_AZIMUTH_DEG); el=math.radians(src.CAM_ELEVATION_DEG)
    right=np.array([-math.sin(az),math.cos(az),0])
    up=np.array([-math.sin(el)*math.cos(az),-math.sin(el)*math.sin(az),math.cos(el)])
    toward=np.array([math.cos(el)*math.cos(az),math.cos(el)*math.sin(az),math.sin(el)])
    zbuf=np.full((512,512),-np.inf)
    owner=np.full((512,512),-1,np.int16)
    for mesh_id,(mesh,_color,_name) in enumerate(meshes):
        v=np.asarray(mesh.vertices,dtype=float)
        pts=np.column_stack((256+(v@right)*142,403-(v@up)*143,v@toward))
        for ids in mesh.faces:
            tri=pts[ids]
            left=max(0,math.floor(tri[:,0].min()))
            top=max(0,math.floor(tri[:,1].min()))
            xmax=min(511,math.ceil(tri[:,0].max()))
            ymax=min(511,math.ceil(tri[:,1].max()))
            if xmax<left or ymax<top:continue
            ax,ay,ad=tri[0];bx,by,bd=tri[1];cx,cy,cd=tri[2]
            det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
            if abs(det)<1e-8:continue
            xx,yy=np.meshgrid(np.arange(left,xmax+1,dtype=float)+.5,
                              np.arange(top,ymax+1,dtype=float)+.5)
            wa=((by-cy)*(xx-cx)+(cx-bx)*(yy-cy))/det
            wb=((cy-ay)*(xx-cx)+(ax-cx)*(yy-cy))/det
            wc=1-wa-wb
            visible=(wa>=-1e-10)&(wb>=-1e-10)&(wc>=-1e-10)
            z=wa*ad+wb*bd+wc*cd
            window=zbuf[top:ymax+1,left:xmax+1]
            visible &= z>window
            window[visible]=z[visible]
            owner[top:ymax+1,left:xmax+1][visible]=mesh_id
    mask=np.isfinite(zbuf)
    gray=np.zeros((512,512),np.uint8)
    depth=np.clip((zbuf[mask]-MIN_DEPTH)/(MAX_DEPTH-MIN_DEPTH),0,1)
    gray[mask]=np.rint(35+depth*(246-35)).astype(np.uint8)
    return gray,mask,owner


def produce(destination,source):
    destination=Path(destination)
    if destination.exists() and any(destination.iterdir()):
        raise FileExistsError(f'Refuse candidate overwrite: {destination}')
    src=source_module(source)
    pair={}
    for label in 'AB':
        scene,meshes,joints=src.make_scene(label)
        gray,mask,owner=rasterize(src,meshes)
        pair[label]=(gray,mask,owner,meshes,joints)
    src.validate_pair(pair['A'][4],pair['B'][4])
    changed=int(np.count_nonzero(pair['A'][0]!=pair['B'][0]))
    if changed<300:raise ValueError('No distinguishable A/B depth change')
    destination.mkdir(parents=True,exist_ok=True)
    board=Image.new('RGB',(1060,1120),'#e9e7e1')
    draw=ImageDraw.Draw(board)
    hashes={}
    pixel_hashes={}
    for index,label in enumerate('AB'):
        gray,mask,owner,meshes,joints=pair[label]
        suffix=label.lower()
        images={
           'depth':Image.fromarray(gray,'L'),
           'silhouette':Image.fromarray((mask*255).astype(np.uint8),'L')}
        seg=np.zeros((512,512,3),np.uint8)
        for i,(_mesh,_color,name) in enumerate(meshes):
            color=((236,144,62) if name.startswith('near_') else
                   (83,167,204) if name.startswith('far_') else (105,120,125))
            seg[owner==i]=color
        images['surface-id']=Image.fromarray(seg)
        hashes[label]={}
        pixel_hashes[label]={}
        for name,img in images.items():
            file=destination/f'pose-{suffix}-{name}.png'
            img.save(file)
            hashes[label][name]=hashlib.sha256(file.read_bytes()).hexdigest()
            pixel_hashes[label][name]=hashlib.sha256(img.tobytes()).hexdigest()
        board.paste(images['depth'].convert('RGB'),(12+530*index,45))
        board.paste(images['surface-id'],(12+530*index,590))
        draw.text((18+530*index,22),f'Pose {label} / {"near" if label=="A" else "far"} leg forward',fill='#252529')
    draw.text((18,570),'DEPTH: white=near, dark=far. Fixed camera and global depth scale.',fill='#252529')
    draw.text((18,1103),'QA surface IDs: orange=near leg / blue=far leg. Unapproved control, NOT actor artwork.',fill='#252529')
    board.save(destination/'depth-review-sheet.png')
    metadata={'status':'unapproved_depth_control_only','fixed_camera':{'azimuth':src.CAM_AZIMUTH_DEG,'elevation':src.CAM_ELEVATION_DEG},
              'depth_range':[MIN_DEPTH,MAX_DEPTH],'changed_depth_pixels':changed,
              'pose_a_front_leg':'near','pose_b_front_leg':'far',
              'rasterization':'z-buffer with real visible 3D mesh surfaces',
              'hashes':hashes,'pixel_sha256':pixel_hashes}
    (destination/'depth-manifest.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
    return metadata


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('out',type=Path)
    parser.add_argument('--source',type=Path,default=Path(__file__).with_name('prepare_pose_3d.py'))
    args=parser.parse_args()
    print(json.dumps(produce(args.out,args.source),indent=2))
