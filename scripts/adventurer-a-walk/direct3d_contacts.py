"""Render two fixed-contact Adventurer A costumes directly from the existing 3D geometry.

Never uses AI to redraw gait. Outputs 3D GLB + transparent 512 PNG and review
images only, NOT approved game assets. Needs numpy/trimesh/Pillow (no GPU).
Pass --source the existing prepare_pose_3d.py or an existing directory
containing contact-a.glb and contact-b.glb. Never clobber an output directory.
"""
import argparse, json, math, hashlib, importlib.util
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh

W=512
AZ,EL=np.deg2rad(-68),np.deg2rad(23)
RIGHT=np.array([-np.sin(AZ),np.cos(AZ),0])
UP=np.array([-np.sin(EL)*np.cos(AZ),-np.sin(EL)*np.sin(AZ),np.cos(EL)])
TOWARDS=np.array([np.cos(EL)*np.cos(AZ),np.cos(EL)*np.sin(AZ),np.sin(EL)])
LIGHT=np.array([.5,-.7,1.0]); LIGHT/=np.linalg.norm(LIGHT)
COLORS={
    'far_thigh':'#343741','near_thigh':'#343741',
    'far_shin':'#6b4830','near_shin':'#6b4830',
    'far_knee':'#403d3b','near_knee':'#403d3b',
    'far_ankle':'#66462f','near_ankle':'#66462f',
    'far_boot':'#533724','near_boot':'#533724',
    'far_toe':'#8b6945','near_toe':'#8b6945',
    'torso':'#253348','head':'#ddbb8d','hair':'#27282e',
    'silver_forelock':'#e2d8c0',
    'far_upper_arm':'#d4c6a7','far_forearm':'#d4c6a7','far_hand':'#c79a72',
    'near_upper_arm':'#d4c6a7','near_forearm':'#d4c6a7','near_hand':'#c79a72',
    'scabbard':'#67626a'
}

def rgb(color):
    return tuple(int(color.lstrip('#')[i:i+2],16) for i in (0,2,4))

def box(where,extents):
    m=trimesh.creation.box(extents=extents); m.apply_translation(where); return m

def ellipsoid(where,extents,subdivisions=1):
    m=trimesh.creation.icosphere(subdivisions=subdivisions)
    m.apply_scale(extents); m.apply_translation(where); return m

def cylinder(a,b,radius,sections=9):
    a,b=np.array(a,dtype=float),np.array(b,dtype=float); vec=b-a
    m=trimesh.creation.cylinder(radius=radius,height=np.linalg.norm(vec),sections=sections)
    m.apply_transform(trimesh.geometry.align_vectors([0,0,1],vec/np.linalg.norm(vec)))
    m.apply_translation((a+b)/2); return m

def quad_panel(corners,depth=.045):
    corners=np.asarray(corners,dtype=float)
    other=corners+np.array([0,depth,0])
    points=np.concatenate((corners,other)); fs=[(0,1,2),(0,2,3),(4,6,5),(4,7,6)]
    for k in range(4):
        fs.extend([(k,(k+1)%4,4+(k+1)%4),(k,4+(k+1)%4,4+k)])
    return trimesh.Trimesh(vertices=points,faces=fs,process=False)

def costume(scene):
    """Same base mesh for A/B; only rigged contact and arm counter-swing differ."""
    result=[(geom,COLORS.get(name,'#696a70'),name)
            for name,geom in scene.geometry.items()]
    def add(name,m,color): result.append((m,color,name))
    add('coat_far',quad_panel([(-.18,.19,1.55),(.04,.18,1.57),
                             (.12,.20,1.13),(-.28,.21,1.10)],.06),'#29374c')
    add('coat_near',quad_panel([(-.13,-.36,1.58),(.15,-.37,1.56),
                              (.19,-.39,1.17),(-.25,-.39,1.11)],.045),'#273b58')
    add('coat_hem_ink',cylinder((-.24,-.407,1.12),(.18,-.405,1.18),.021),'#1b2436')
    add('ivory_tunic',ellipsoid((.18,-.04,1.7),(.096,.23,.25),2),'#d3c9ad')
    add('lapel1',cylinder((.17,-.22,1.91),(.27,-.25,1.61),.023),'#d5c6ab')
    add('lapel2',cylinder((-.08,-.29,1.87),(.07,-.31,1.61),.026),'#1b283c')
    add('belt',box((.08,-.02,1.45),(.39,.63,.095)),'#5b3e2d')
    add('belt_buckle',box((.29,-.332,1.45),(.08,.025,.07)),'#a98d61')
    add('pouch_near',box((-.2,-.35,1.38),(.16,.13,.15)),'#865d40')
    add('pouch_far',box((-.23,.30,1.38),(.15,.13,.14)),'#7e593b')
    for side,y in (('near',-.2),('far',.2)):
        shin=scene.geometry[side+'_shin']; verts=np.asarray(shin.vertices)
        low=verts[np.argsort(verts[:,2])[:len(verts)//3]].mean(axis=0)
        high=verts[np.argsort(verts[:,2])[-len(verts)//3:]].mean(axis=0)
        for t in (.31,.50,.68):
            p=low*(1-t)+high*t
            add(f'{side}_boot_strap_{t}',ellipsoid(p,(.111,.102,.028)),'#98724c')
        boot=scene.geometry[side+'_boot']; bb=boot.bounds
        add(side+'_sole',box(((bb[0][0]+bb[1][0])/2,y,.015),
                            (.40,.23,.03)),'#35291f')
        add(side+'_toe_guard',box((bb[1][0]-.035,y,.105),
                                 (.075,.20,.065)),'#a37a51')
    for side in ('near','far'):
        fore=scene.geometry[side+'_forearm']
        p=np.asarray(fore.vertices).mean(axis=0)
        add(side+'_cuff',ellipsoid(p+np.array([.015,0,-.13]),
                                 (.113,.108,.075)),'#514039')
    add('stubble',ellipsoid((.202,-.086,2.205),(.047,.14,.093),2),'#524238')
    add('nose',ellipsoid((.295,-.05,2.34),(.048,.08,.05)),'#c29a72')
    add('silver_strand',cylinder((.16,-.16,2.555),(.278,-.174,2.42),
                                .037),'#d9d6cb')
    add('hair_tuft_1',cylinder((-.115,-.14,2.55),(-.20,-.14,2.59),
                              .059),'#2b2a2e')
    add('hair_tuft_2',cylinder((-.015,.08,2.57),(-.06,.08,2.64),
                              .06),'#2b292c')
    return result

def render(items):
    """Simple face-lit triangle z-buffer; silhouettes are preserved by geometry."""
    zbuf=np.full((W,W),-np.inf,np.float32)
    col=np.zeros((W,W,3),np.uint8)
    for mesh,hex_color,_name in items:
        v=np.asarray(mesh.vertices,dtype=float)
        if not len(v): continue
        p=np.stack((256+(v@RIGHT)*142,403-(v@UP)*143,v@TOWARDS),axis=1)
        palette=np.array(rgb(hex_color),float)
        for face in mesh.faces:
            a,b,c=p[face];(ax,ay,ad),(bx,by,bd),(cx,cy,cd)=a,b,c
            left=max(0,math.floor(min(ax,bx,cx)))
            top=max(0,math.floor(min(ay,by,cy)))
            right=min(W-1,math.ceil(max(ax,bx,cx)))
            bottom=min(W-1,math.ceil(max(ay,by,cy)))
            if right<left or bottom<top: continue
            den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
            if abs(den)<1e-7: continue
            yy,xx=np.ogrid[top:bottom+1,left:right+1]; xx=xx+.5; yy=yy+.5
            aa=((by-cy)*(xx-cx)+(cx-bx)*(yy-cy))/den
            bb=((cy-ay)*(xx-cx)+(ax-cx)*(yy-cy))/den
            cc=1-aa-bb
            zz=aa*ad+bb*bd+cc*cd
            crop=zbuf[top:bottom+1,left:right+1]
            mask=(aa>=-1e-8)&(bb>=-1e-8)&(cc>=-1e-8)&(zz>crop)
            if not np.any(mask): continue
            nor=np.cross(v[face[1]]-v[face[0]],v[face[2]]-v[face[0]])
            nor=nor/(np.linalg.norm(nor)+1e-10)
            light=.70+.30*max(0,float(np.dot(nor,LIGHT)))
            gy,gx=np.ogrid[top:bottom+1,left:right+1]
            noise=((((gx*19+gy*47)%31)-15)/15)*4.2
            pixel=np.clip(palette[None,None,:]*light+noise[:,:,None],
                          0,255).astype(np.uint8)
            crop[mask]=zz[mask]
            col[top:bottom+1,left:right+1][mask]=pixel[mask]
    alpha=np.uint8(np.isfinite(zbuf))*255
    base=Image.fromarray(np.dstack((col,alpha)),'RGBA')
    canvas=base.resize((256,256),Image.Resampling.BOX).resize(
        (512,512),Image.Resampling.NEAREST)
    a=canvas.getchannel('A')
    line=np.array(a.filter(ImageFilter.MaxFilter(3)))-np.array(a)
    arr=np.asarray(canvas).copy()
    arr[line>0,:3]=(35,33,40); arr[line>0,3]=180
    return Image.fromarray(arr,'RGBA')

def ground_shadow(draw,ankles):
    # Only the review plate gets the ground shadows; sprite PNG is transparent.
    for x,y in ankles:
        cx=int(round(256+(x*RIGHT[0]+y*RIGHT[1])*142))
        cy=int(round(403-(x*UP[0]+y*UP[1])*143))
        draw.ellipse((cx-32,cy-7,cx+46,cy+8),fill=(78,69,59,52))
        draw.ellipse((cx-19,cy-4,cx+35,cy+5),fill=(82,72,62,50))

def scene_for_pose(source,label):
    if source.is_dir():
        file=source/f'contact-{label}.glb'
        if not file.is_file(): raise FileNotFoundError(file)
        return trimesh.load(file,force='scene')
    if not source.is_file(): raise FileNotFoundError(source)
    spec=importlib.util.spec_from_file_location(
        'crownless_existing_3d_source',source)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.make_scene(label.upper())[0]

def build(out,source):
    """Produce exactly two unapproved geometry-locked contact candidates."""
    if out.exists() and any(out.iterdir()):
        raise FileExistsError('Refuse overwrite '+str(out))
    out.mkdir(parents=True,exist_ok=True)
    sheet=Image.new('RGB',(1056,620),'#ede9df')
    draw=ImageDraw.Draw(sheet)
    data={'status':'review_only_direct_3d_material_trial',
          'both_ground_z':0,
          'camera':{'azimuth':-68,'elevation':23},
          'phases':{}}
    for i,label in enumerate(('a','b')):
        scene=scene_for_pose(source,label)
        items=costume(scene)
        clothed=trimesh.Scene()
        for mesh,color,name in items:
            mesh.visual.vertex_colors=trimesh.visual.color.hex_to_rgba(color)
            clothed.add_geometry(mesh,geom_name=name)
        (out/f'pose-{label}-direct3d.glb').write_bytes(
            clothed.export(file_type='glb'))
        rendered=render(items)
        rendered.save(out/f'pose-{label}-direct3d.png')
        feet=({'near':(.36,-.2),'far':(-.30,.2)} if label=='a'
              else {'near':(-.30,-.2),'far':(.36,.2)})
        frame=Image.new('RGBA',(512,512),'#ece8dd')
        ground_shadow(ImageDraw.Draw(frame),list(feet.values()))
        frame.alpha_composite(rendered)
        frame.convert('RGB').save(out/f'pose-{label}-review.png')
        sheet.paste(frame.convert('RGB'),(16+i*524,48))
        draw.text((20+i*524,18),
                  f'CONTACT {label.upper()} / {"NEAR" if label=="a" else "FAR"} FOOT FORWARD',
                  fill='#2e3035')
        data['phases'][label]={
            'foreground_leg':'near' if label=='a' else 'far',
            'soles_world_z':[float(scene.geometry[side+'_boot'].bounds[0,2])
                              for side in ('near','far')],
            'ankles_xy':feet,
            'render_sha256':hashlib.sha256(
                (out/f'pose-{label}-direct3d.png').read_bytes()).hexdigest()}
    draw.text((18,585),
              'REVIEW ONLY: direct 3D geometry/color, no AI pose synthesis; NOT APPROVED GAME ART',
              fill='#614a3d')
    sheet.save(out/'comparison.png')
    # Phone-scale QA exposes costume legibility failures hidden in large renders.
    phone=Image.new('RGB',(344,200),'#ece8dd')
    label_draw=ImageDraw.Draw(phone)
    for i,label in enumerate(('a','b')):
        with Image.open(out/f'pose-{label}-review.png') as original:
            small=original.resize((160,160),Image.Resampling.BOX)
        phone.paste(small,(6+i*172,25))
        label_draw.text((12+i*172,8),f'CONTACT {label.upper()} / 160px',fill='#303236')
    phone.save(out/'phone-scale-qa.png')
    (out/'qa.json').write_text(json.dumps(data,indent=2),encoding='utf8')
    return data

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--source',type=Path,
                   default=Path(__file__).with_name('prepare_pose_3d.py'))
    p.add_argument('--out',type=Path,required=True)
    args=p.parse_args()
    print(json.dumps(build(args.out,args.source),indent=2))
