"""Crownless: deterministic 3D two-contact pose study (NOT approved character art).

Dependencies: numpy, trimesh, matplotlib, Pillow. No Blender, paid model or GPU.
Exports two genuine 3D meshes as GLB, fixed-camera PNG previews, projected
OpenPose-like joint coordinates, and a contact-sheet QA image.
"""
from __future__ import annotations
import json
import math
from pathlib import Path
import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont

# Fixed world: +X forward (character faces right); -Y camera-near;
# +Z vertical. Both boot soles rest on Z=0; fixed ground/camera for A/B.
FOOT_FRONT = 0.36
FOOT_BACK = -0.30
HIP_Z = 1.35
ANKLE_Z = 0.19
LEG_BONE = 0.78
GROUND = 0.0
CAM_AZIMUTH_DEG = -68
CAM_ELEVATION_DEG = 23
COLOR = {
    'body': '#303c58', 'head': '#dec9a5', 'hair': '#33333a',
    'coat': '#24304d', 'near': '#e1a663', 'far': '#7bb3ba',
    'joint': '#f3e8ca', 'boot': '#624936', 'sword': '#8b92a1',
    'arm': '#d0c4a8', 'ground': '#9b998d',
}


def knee_ik(hip, ankle, length=LEG_BONE):
    """Analytic sagittal-plane IK with a forward-bending knee; fixed bones."""
    hx, hy, hz = hip
    ax, ay, az = ankle
    if abs(hy-ay) > 1e-9:
        raise ValueError('IK is constrained to an x/z plane')
    dx, dz = ax-hx, az-hz
    d = math.hypot(dx, dz)
    if d > 2*length or d == 0:
        raise ValueError('Ankle unreachable')
    mx, mz = (hx+ax)/2, (hz+az)/2
    h = math.sqrt(length*length - (d/2)**2)
    return (mx + h*(-dz/d), hy, mz + h*(dx/d))


def joints_for_pose(which):
    if which not in ('A','B'):
        raise ValueError('Unknown pose')
    near_x, far_x = ((FOOT_FRONT, FOOT_BACK) if which=='A' else (FOOT_BACK, FOOT_FRONT))
    joints={
      'pelvis':(0.0,0,1.32), 'chest':(-0.035,0,1.92),
      'neck':(0,0,2.09), 'head':(.07,0,2.32),
      'near_hip':(0,-.20,HIP_Z), 'far_hip':(0,.20,HIP_Z),
      'near_ankle':(near_x,-.20,ANKLE_Z), 'far_ankle':(far_x,.20,ANKLE_Z),
      'near_shoulder':(-.04,-.29,1.91), 'far_shoulder':(-.04,.29,1.91),
    }
    for p in ('near','far'):
      joints[p+'_knee'] = knee_ik(joints[p+'_hip'],joints[p+'_ankle'])
    sign=1 if which=='A' else -1
    joints['near_elbow']=(0.04-sign*.12,-.37,1.67)
    joints['near_hand']=(0.07-sign*.21,-.40,1.38)
    joints['far_elbow']=(0.04+sign*.12,.37,1.67)
    joints['far_hand']=(0.07+sign*.21,.40,1.38)
    return joints


def cylinder_between(a,b,radius,sections=10):
    a,b=np.asarray(a,dtype=float),np.asarray(b,dtype=float)
    vector=b-a; length=float(np.linalg.norm(vector))
    mesh=trimesh.creation.cylinder(radius=radius,height=length,sections=sections)
    matrix=trimesh.geometry.align_vectors([0,0,1], vector/length)
    mesh.apply_transform(matrix)
    mesh.apply_translation((a+b)/2)
    return mesh


def ellipsoid(center,scale,subdivisions=1):
    mesh=trimesh.creation.icosphere(subdivisions=subdivisions,radius=1)
    mesh.apply_scale(scale)
    mesh.apply_translation(center)
    return mesh


def box(center, extents):
    m=trimesh.creation.box(extents=extents)
    m.apply_translation(center)
    return m


def make_scene(which):
    j=joints_for_pose(which)
    scene=trimesh.Scene()
    meshes=[]
    def add(mesh, color, name):
        mesh.visual.vertex_colors=trimesh.visual.color.hex_to_rgba(color)
        scene.add_geometry(mesh,geom_name=name)
        meshes.append((mesh,color,name))

    for side in ('far','near'):
        leg_color=COLOR[side]
        add(cylinder_between(j[side+'_hip'],j[side+'_knee'],.098),leg_color,side+'_thigh')
        add(cylinder_between(j[side+'_knee'],j[side+'_ankle'],.089),leg_color,side+'_shin')
        add(ellipsoid(j[side+'_knee'],(.098,.11,.10)),leg_color,side+'_knee')
        add(ellipsoid(j[side+'_ankle'],(.105,.105,.115)),COLOR['boot'],side+'_ankle')
        fx,fy,_=j[side+'_ankle']
        add(box((fx+.115,fy,.075),(.39,.19,.15)),COLOR['boot'],side+'_boot')
        add(box((fx+.322,fy,.065),(.035,.135,.07)), '#d0b387',side+'_toe')

    add(ellipsoid((-0.025,0,1.66),(.30,.35,.48)), COLOR['body'],'torso')
    add(ellipsoid(j['head'],(.235,.23,.25)),COLOR['head'],'head')
    add(ellipsoid((.018,0,2.47),(.238,.233,.123)),COLOR['hair'],'hair')
    add(box((.212,-.126,2.48),(.08,.095,.08)),'#e0e0d5','silver_forelock')
    for side in ('far','near'):
        add(cylinder_between(j[side+'_shoulder'],j[side+'_elbow'],.09),COLOR['arm'],side+'_upper_arm')
        add(cylinder_between(j[side+'_elbow'],j[side+'_hand'],.081),COLOR['arm'],side+'_forearm')
        add(ellipsoid(j[side+'_hand'],(.09,.085,.086)),COLOR['head'],side+'_hand')
    add(cylinder_between((-.19,.18,2.00),(-.31,.26,1.33),.037),COLOR['sword'],'scabbard')
    return scene,meshes,j


def render_preview(meshes, destination):
    from matplotlib import pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection
    fig=plt.figure(figsize=(5.12,5.12),dpi=100,facecolor='#e7e4dc')
    ax=fig.add_axes([.04,.015,.92,.97],projection='3d',facecolor='#e7e4dc')
    for mesh, color, name in meshes:
        f=mesh.vertices[mesh.faces]
        coll=Poly3DCollection(f,facecolor=color,edgecolors=(.12,.13,.15,.10),linewidths=.12,zsort='average')
        ax.add_collection3d(coll)
    xx=np.linspace(-.8,.8,2); yy=np.linspace(-.7,.7,2)
    X,Y=np.meshgrid(xx,yy)
    ax.plot_surface(X,Y,X*0-0.01,alpha=.18,color='#b6b1a7',shade=False)
    ax.plot([-1,1],[0,0],[0,0],color='#a39f94',linewidth=.8,alpha=.65)
    ax.set_xlim(-.95,.95);ax.set_ylim(-.8,.8);ax.set_zlim(-.02,2.72)
    ax.set_box_aspect((1.9,1.6,2.74),zoom=.94)
    ax.view_init(elev=CAM_ELEVATION_DEG,azim=CAM_AZIMUTH_DEG)
    ax.set_proj_type('ortho'); ax.set_axis_off()
    fig.savefig(destination,dpi=100,facecolor=fig.get_facecolor())
    plt.close(fig)


def project_3d(point):
    """Camera-space orthographic planar coordinates, shared for both poses."""
    az=math.radians(CAM_AZIMUTH_DEG)
    elev=math.radians(CAM_ELEVATION_DEG)
    towards_cam=np.array((math.cos(elev)*math.cos(az),math.cos(elev)*math.sin(az),math.sin(elev)))
    right=np.cross((0,0,1),towards_cam);right=right/np.linalg.norm(right)
    up=np.cross(towards_cam,right)
    p=np.asarray(point,dtype=float)
    return [round(float(np.dot(p,right)),5),round(float(np.dot(p,up)),5)]


def render_openpose(joints, destination):
    """Project 3D joints for existing SD1.5 OpenPose ControlNet."""
    im=Image.new('RGB',(512,512),(0,0,0))
    d=ImageDraw.Draw(im)
    def pt(name):
        x,y=project_3d(joints[name])
        return (round(256+x*142),round(403-y*143))
    links=[
        ('neck','near_shoulder','#ff0000'),
        ('near_shoulder','near_elbow','#ffaa00'),
        ('near_elbow','near_hand','#ffff00'),
        ('neck','far_shoulder','#aa00ff'),
        ('far_shoulder','far_elbow','#ff00ff'),
        ('far_elbow','far_hand','#ff0088'),
        ('neck','near_hip','#00ff00'),
        ('near_hip','near_knee','#00ffff'),
        ('near_knee','near_ankle','#0088ff'),
        ('neck','far_hip','#00aa00'),
        ('far_hip','far_knee','#0000ff'),
        ('far_knee','far_ankle','#8800ff'),
        ('neck','head','#ff4400'),
    ]
    for a,b,color in links:
        d.line([pt(a),pt(b)],fill=color,width=8)
    for name in ('neck','head','near_shoulder','far_shoulder','near_elbow','far_elbow',
                 'near_hand','far_hand','near_hip','far_hip','near_knee','far_knee',
                 'near_ankle','far_ankle'):
        x,y=pt(name)
        d.ellipse((x-5,y-5,x+5,y+5),fill='#eeeeee')
    im.save(destination)


def validate_pair(a,b):
    for side in ('near','far'):
      for pose in (a,b):
        h,k,p=[np.asarray(pose[f'{side}_{joint}']) for joint in ('hip','knee','ankle')]
        assert abs(np.linalg.norm(h-k)-LEG_BONE)<1e-8
        assert abs(np.linalg.norm(k-p)-LEG_BONE)<1e-8
        assert abs(p[2]-ANKLE_Z)<1e-8
    assert a['near_ankle'][0] > a['far_ankle'][0]
    assert b['near_ankle'][0] < b['far_ankle'][0]
    for x in ('head','neck','chest','pelvis'):
        assert a[x]==b[x]
    assert a['near_ankle'][1] < a['far_ankle'][1]
    assert b['near_ankle'][1] < b['far_ankle'][1]
    return True


def produce(out):
    out=Path(out)
    if out.exists() and any(out.iterdir()):
        raise FileExistsError(f'Output directory already contains files: {out}')
    out.mkdir(parents=True,exist_ok=True)
    poses={}
    for label in ('A','B'):
        scene,meshes,j=make_scene(label)
        poses[label]=j
        glb=out/f'contact-{label.lower()}.glb'
        preview=out/f'contact-{label.lower()}.png'
        glb.write_bytes(scene.export(file_type='glb'))
        render_preview(meshes,preview)
        render_openpose(j,out/f'pose-{label.lower()}-openpose.png')
    validate_pair(poses['A'],poses['B'])
    qa=Image.new('RGB',(1060,625),'#eeeae2')
    d=ImageDraw.Draw(qa)
    for i,label in enumerate(('A','B')):
        im=Image.open(out/f'contact-{label.lower()}.png').convert('RGB')
        qa.paste(im,(15+530*i,45))
        cap=('A | near leg +X (front)' if label=='A' else 'B | far leg +X (front)')
        d.text((25+530*i,20),cap,fill='#242936')
        d.text((25+530*i,565),'Both soles Z=0  |  both boot toes +X',fill='#3a4048')
    d.text((25,602),'3D geometry / fixed camera / unapproved CONTROL GUIDE; NOT Crownless actor artwork',fill='#7c4937')
    qa.save(out/'contact-sheet.png')
    data={
      'status':'review_only_unapproved_3d_pose_reference',
      'source':'original procedural meshes generated with trimesh',
      'camera':{'azimuth_deg':CAM_AZIMUTH_DEG,'elevation_deg':CAM_ELEVATION_DEG,'projection':'orthographic'},
      'coordinates':{'forward':'+X','near_to_camera':'-Y','up':'+Z','boot_sole_z':0.0},
      'leg_bone_length':LEG_BONE,
      'poses':{s:{'joints':{k:list(v) for k,v in j.items()},
                  'projected_camera_coordinates':{k:project_3d(v) for k,v in j.items()},
                  'foot_front_x':float(j['near_ankle'][0] if s=='A' else j['far_ankle'][0]),
                  'front_leg':'near' if s=='A' else 'far',
                  'boots':{p:{'sole_z':0.0,'toe_heading':'+X','toe_world_x':j[p+'_ankle'][0]+.322} for p in ('near','far')}} for s,j in poses.items()}
    }
    (out/'geometry.json').write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')
    print('Created 2 editable 3D meshes, PNGs, QA sheet and geometry.json in',out)
    return data


if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser()
    p.add_argument('output_dir',type=Path)
    args=p.parse_args()
    produce(args.output_dir)
