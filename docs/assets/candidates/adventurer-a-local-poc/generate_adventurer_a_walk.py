#!/usr/bin/env python3
"""Hand-plotted, layered 8-frame pixel-art motion study of Crownless Adventurer A.

This code is an editable art source, not a reducer/quantizer of a generated image.
Each garment, limb and highlight is drawn in a fixed pixel palette at 64 x 96.
No production game assets or Approved Anchors are modified.
"""

from pathlib import Path
import hashlib
import json
import zipfile
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

W, H = 64, 96
P = {
    "ink": "#201d25", "ink2": "#302a32", "hair": "#302b31",
    "hair2": "#484049", "hair3": "#63565d", "silver_dark": "#979396",
    "silver": "#d5d2c9", "silver_hi": "#f0e8d9",
    "skin_dark": "#8a503e", "skin": "#ca8660", "skin_hi": "#edb486",
    "ivory_dark": "#8d8377", "ivory": "#d0c2a7", "ivory_hi": "#ebe1c9",
    "navy_dark": "#24283b", "navy": "#353c57", "navy_hi": "#58617c",
    "navy_light": "#748098", "pants_dark": "#2d2c37", "pants": "#4d4550",
    "leather_dark": "#3e2d2c", "leather": "#6a4736", "leather_hi": "#966a4b",
    "gold_dark": "#775633", "gold": "#bd9255", "gold_hi": "#e0b979",
}

# The near and far boots exchange leading/trailing positions every four frames.
# Sign-reversed arms oppose the near leg. The body also counter-rotates: shoulder
# position, head lean, and coat tails change visibly throughout the loop.
POSES = [
    dict(near=9, far=-8, arm=-7, lean=-2, bob=0, shoulder=-3, tail=-4),
    dict(near=7, far=-5, arm=-5, lean=-1, bob=2, shoulder=-2, tail=-3),
    dict(near=2, far=0, arm=0, lean=0, bob=1, shoulder=1, tail=0),
    dict(near=-4, far=6, arm=5, lean=2, bob=-1, shoulder=3, tail=3),
    dict(near=-9, far=8, arm=7, lean=2, bob=0, shoulder=3, tail=4),
    dict(near=-6, far=5, arm=5, lean=1, bob=2, shoulder=2, tail=3),
    dict(near=0, far=1, arm=0, lean=0, bob=1, shoulder=-1, tail=0),
    dict(near=6, far=-5, arm=-5, lean=-2, bob=-1, shoulder=-3, tail=-3),
]


def c(name):
    return P[name]


def poly(d, points, fill, outline="ink", width=1):
    d.polygon([(round(x), round(y)) for x, y in points], fill=c(fill))
    if outline:
        d.line([(round(x), round(y)) for x, y in points + [points[0]]],
               fill=c(outline), width=width, joint="curve")


def block(d, xy, fill):
    d.rectangle(tuple(map(round, xy)), fill=c(fill))


def line(d, points, fill, width=1):
    d.line([(round(x), round(y)) for x, y in points], fill=c(fill), width=width)


def stroke_limb(d, a, b, width, outer, inner, highlight=None):
    line(d, [a, b], outer, width + 2)
    line(d, [a, b], inner, width)
    if highlight:
        ax, ay = a
        bx, by = b
        line(d, [(ax-1, ay-1), (bx-1, by-1)], highlight, max(1, width // 3))


def boot(d, ankle_x, sole_y, front=True):
    """Squared leather boot with only coherent 2-4 pixel highlight clusters."""
    toe = 5 if front else 2
    x, y = round(ankle_x), round(sole_y)
    poly(d, [(x-5,y-9), (x+3,y-10), (x+5,y-5),
             (x+toe+3,y-5), (x+toe+5,y-3), (x+toe+4,y),
             (x-5,y), (x-7,y-3)], "leather_dark")
    poly(d, [(x-4,y-8), (x+2,y-8), (x+3,y-4),
             (x+toe+3,y-3), (x+toe+2,y-2), (x-4,y-2)], "leather", None)
    line(d, [(x-4,y-6),(x+3,y-6)], "gold_dark", 2)
    block(d, (x-1,y-7,x+1,y-6), "gold")
    block(d, (x+2,y-4,x+toe+2,y-4), "leather_hi")
    line(d, [(x-5,y-1),(x+toe+4,y-1)], "ink2", 1)


def leg(d, x_hip, y_hip, step, far, bob):
    """Actual bent thigh and shin, not a translated whole-leg cutout."""
    knee_x = x_hip + step * .55 + (1 if far else -1)
    knee_y = 69 + bob - (1 if step < -3 else 0)
    ankle_x = 34 + step + (3 if far else 0)
    y_sole = 87 - max(0, 1 - abs(step)//4) if abs(step) > 4 else 85
    # The trailing foot lifts when it passes under the body, not at contact.
    if abs(step) <= 4:
        y_sole -= 1
    stroke_limb(d, (x_hip, y_hip), (knee_x, knee_y), 8,
                "ink", "pants_dark" if far else "pants", "pants" if far else None)
    stroke_limb(d, (knee_x, knee_y), (ankle_x, y_sole-7), 7,
                "ink", "pants_dark" if far else "pants", None)
    line(d, [(knee_x-2,knee_y-3),(knee_x+1,knee_y-1)], "pants_dark", 2)
    boot(d, ankle_x, y_sole, front=(step>=0))


def arm(d, sx, sy, swing, far=False):
    # Independent upper arm, forearm and cuff reveal elbow flexion and shoulder
    # rotation. Far arm is drawn behind the chest; near arm in front of it.
    direction = 1 if far else -1
    elbow = (sx + direction*6 - swing*.48, sy + 12)
    hand = (sx + direction*9 - swing, sy + 23 - abs(swing)*.22)
    stroke_limb(d, (sx, sy), elbow, 8, "ink", "ivory", "ivory_hi")
    poly(d, [(elbow[0]-4,elbow[1]-2),(elbow[0]+4,elbow[1]-2),
             (elbow[0]+4,elbow[1]+3),(elbow[0]-4,elbow[1]+3)], "ivory_dark")
    line(d, [(elbow[0]-3,elbow[1]-1),(elbow[0]+2,elbow[1]-1)], "ivory_hi", 2)
    stroke_limb(d, (elbow[0],elbow[1]+3), (hand[0],hand[1]-3), 6,
                "ink", "leather", "leather_hi")
    line(d, [(hand[0]-3,hand[1]-7),(hand[0]+3,hand[1]-7)], "leather_hi", 2)
    poly(d, [(hand[0]-4,hand[1]-3),(hand[0]+3,hand[1]-3),
             (hand[0]+4,hand[1]+2),(hand[0],hand[1]+4),
             (hand[0]-4,hand[1]+2)], "leather_dark")
    block(d, (hand[0]-2,hand[1]-1,hand[0],hand[1]), "leather_hi")


def head(d, cx, top, tilt):
    """Oblique right-facing face, black tousled silhouette, silver forelock."""
    def q(points):
        return [(x+cx-34 + round(tilt * (27-y)/24), y+top-9) for x,y in points]
    # Neck is anchored to the moving shoulder/collar.
    poly(d, q([(34,26),(42,26),(44,35),(35,35)]), "skin_dark")
    # Hair back tufts and crown: deliberate clustered spikes, no speckle noise.
    poly(d, q([(18,24),(14,25),(18,20),(16,18),(23,15),(20,13),
               (28,10),(31,8),(36,9),(42,8),(45,11),(49,10),
               (47,18),(44,25),(36,29),(27,28),(21,29)]), "hair")
    poly(d, q([(24,17),(29,12),(37,12),(41,15),(36,18),
               (30,19),(23,23),(19,23)]), "hair2", None)
    line(d, q([(23,18),(28,14),(34,13)]), "hair3", 2)
    line(d, q([(20,24),(27,21),(32,17)]), "hair2", 2)
    # Face: nose points right. The smaller beard breaks the jaw outline.
    poly(d, q([(31,19),(40,17),(46,19),(47,22),(50,24),
               (46,26),(45,29),(41,32),(34,30),(31,27)]), "skin_dark")
    poly(d, q([(33,20),(41,19),(45,21),(45,23),(48,24),
               (44,25),(43,29),(39,30),(34,27)]), "skin", None)
    poly(d, q([(35,22),(39,20),(43,21),(42,23),(36,25)]), "skin_hi", None)
    block(d, q([(32,23),(34,25)])[0]+q([(32,23),(34,25)])[1], "skin_hi")
    line(d, q([(42,21),(45,21)]), "ink2", 1) # brow
    block(d, (*q([(44,22)])[0], *q([(44,22)])[0]), "ink")
    line(d, q([(43,29),(40,30),(37,29)]), "hair2", 2) # stubble
    # Two clear silver locks rather than hundreds of gray one-pixel flecks.
    poly(d, q([(40,11),(43,10),(47,13),(48,16),(45,20),
               (44,24),(41,26),(42,19),(40,16)]), "silver_dark", None)
    poly(d, q([(42,11),(45,12),(46,16),(43,21),(43,16)]), "silver", None)
    line(d, q([(44,12),(45,15),(43,18)]), "silver_hi", 1)
    poly(d, q([(45,14),(49,15),(50,19),(47,22),(46,19)]), "silver", None)
    block(d, (*q([(48,17)])[0], *q([(49,18)])[0]), "silver_hi")


def render_frame(index, pose):
    im = Image.new("RGBA", (W,H))
    d = ImageDraw.Draw(im)
    lean, bob, shoulder = pose["lean"], pose["bob"], pose["shoulder"]
    tx, ty = 33 + lean, 31 + bob

    # Back-mounted sword: consistent metal and leather geometry, bobbed together.
    line(d, [(20+lean,51+bob),(12+lean,19+bob)], "ink", 6)
    line(d, [(20+lean,49+bob),(12+lean,20+bob)], "leather", 3)
    line(d, [(13+lean,21+bob),(10+lean,15+bob)], "gold_dark", 4)
    line(d, [(10+lean,15+bob),(10+lean,13+bob)], "gold_hi", 3)
    line(d, [(9+lean,24+bob),(18+lean,21+bob)], "leather_dark", 3)
    block(d, (16+lean,47+bob,18+lean,51+bob), "gold_dark")

    # Split coat tails swing against the body and stay behind the legs.
    tail = pose["tail"]
    poly(d, [(27,51+bob),(37,51+bob),(32+tail,79+bob),
             (25+tail,84+bob),(24+tail,75+bob),(18+tail,78+bob)], "navy_dark")
    poly(d, [(28,53+bob),(34,55+bob),(28+tail,75+bob),
             (23+tail,78+bob)], "navy", None)
    line(d, [(27,57+bob),(22+tail,75+bob)], "navy_hi", 2)
    poly(d, [(38,52+bob),(47,51+bob),(49-tail//2,72+bob),
             (44-tail//2,79+bob),(35,73+bob)], "navy_dark")
    poly(d, [(39,56+bob),(44,55+bob),(46-tail//2,72+bob),
             (42-tail//2,75+bob)], "navy", None)

    # Two articulated legs cross in a stable drawing order.
    leg(d, 42+lean, 57+bob, pose["far"], far=True, bob=bob)
    leg(d, 31+lean, 58+bob, pose["near"], far=False, bob=bob)

    # Counter-rotating coat torso; shoulders move more than hips.
    poly(d, [(26+lean+shoulder,31+bob),(43+lean+shoulder,30+bob),
             (49+lean,37+bob),(47+lean,57+bob),
             (28+lean,58+bob),(21+lean,38+bob)], "navy_dark")
    poly(d, [(27+lean+shoulder,33+bob),(42+lean+shoulder,33+bob),
             (45+lean,39+bob),(43+lean,53+bob),
             (27+lean,54+bob)], "navy", None)
    # Keep the far sleeve visible over the coat outline as a connected limb.
    # It is then partially occluded by the far-side lapel below.
    arm(d, 46+lean+shoulder, 35+bob, pose["arm"]*.8, far=True)
    # Ivory shirt V and collar stay visible as the chest pivots.
    poly(d, [(34+lean+shoulder,34+bob),(42+lean+shoulder,34+bob),
             (44+lean,47+bob),(38+lean,54+bob),
             (31+lean,45+bob)], "ivory_dark")
    poly(d, [(36+lean+shoulder,34+bob),(41+lean+shoulder,35+bob),
             (42+lean,45+bob),(38+lean,49+bob),
             (33+lean,42+bob)], "ivory", None)
    poly(d, [(35+lean,35+bob),(39+lean,37+bob),(37+lean,41+bob)], "ivory_hi", None)
    # Front lapels are intentionally asymmetrical (near lapel wider).
    poly(d, [(24+lean+shoulder,34+bob),(32+lean+shoulder,33+bob),
             (36+lean,41+bob),(32+lean,55+bob),
             (26+lean,52+bob)], "navy")
    poly(d, [(43+lean+shoulder,33+bob),(49+lean,39+bob),
             (45+lean,56+bob),(41+lean,51+bob)], "navy")
    line(d, [(28+lean,37+bob),(30+lean,48+bob)], "navy_hi", 2)
    line(d, [(46+lean,37+bob),(44+lean,45+bob)], "navy_hi", 2)
    # Diagonal sword sling moves with chest, vertical belt with hips.
    line(d, [(30+lean+shoulder,34+bob),(44+lean,54+bob)], "leather_dark", 5)
    line(d, [(31+lean+shoulder,35+bob),(44+lean,53+bob)], "leather", 2)
    line(d, [(27+lean,53+bob),(45+lean,53+bob)], "leather_dark", 5)
    line(d, [(27+lean,52+bob),(45+lean,52+bob)], "leather", 2)
    block(d, (36+lean,50+bob,40+lean,55+bob), "gold_dark")
    block(d, (37+lean,51+bob,39+lean,53+bob), "gold_hi")
    block(d, (38+lean,52+bob,38+lean,53+bob), "leather_dark")
    # Hip pouch has a distinct physical anchor.
    poly(d, [(24+lean,55+bob),(30+lean,55+bob),(31+lean,63+bob),
             (26+lean,67+bob),(22+lean,63+bob)], "leather")
    line(d, [(23+lean,58+bob),(29+lean,58+bob)], "leather_hi", 2)
    block(d, (26+lean,57+bob,27+lean,59+bob), "gold")
    # Front split strip in ivory separates the two coat panels.
    poly(d, [(35+lean,57+bob),(41+lean,56+bob),(39+tail//2,73+bob),
             (34+tail//2,77+bob),(32+lean,74+bob)], "ivory_dark")
    poly(d, [(36+lean,58+bob),(39+lean,58+bob),(37+tail//2,72+bob),
             (34+tail//2,74+bob)], "ivory", None)

    # Foreground near arm swings independently of the torso/head.
    arm(d, 25+lean+shoulder, 36+bob, pose["arm"], far=False)
    # Contrasting indigo shoulder pad covers the sleeve joint.
    poly(d, [(24+lean+shoulder,33+bob),(29+lean+shoulder,34+bob),
             (29+lean,41+bob),(23+lean,42+bob),
             (21+lean,38+bob)], "navy")
    line(d, [(23+lean+shoulder,36+bob),(26+lean+shoulder,35+bob)], "navy_hi", 2)

    # Head and charcoal/silver tuft ride a subtly tilted neck.
    head(d, 34+lean+shoulder, 9+bob, tilt=-shoulder)
    return im


def build():
    frames = [render_frame(i, pose) for i,pose in enumerate(POSES)]
    atlas = Image.new("RGBA", (W*8,H))
    for i,f in enumerate(frames):
        atlas.alpha_composite(f, (W*i,0))
    atlas.save(OUT / "adventurer-a-handcluster-v1.png")

    # Build a native, cel-by-cel Pixelorama project using the verified v1.2.3
    # archive schema. No pixels or layers from the older rejected walk are used.
    # The source archive is retained locally for schema verification only.
    template = HERE / "adventurer-a-contact-pixelorama-v0.pxo"
    if template.exists():
        with zipfile.ZipFile(template) as src:
            data = json.loads(src.read("data.json"))
            data["size_x"], data["size_y"] = W, H
            data["symmetry_points"] = [float(W-1),float(H-1)]
            data["tile_mode_x_basis_x"] = W
            data["tile_mode_x_basis_y"] = 0
            data["tile_mode_y_basis_x"] = 0
            data["tile_mode_y_basis_y"] = H
            data["fps"] = 8.0
            data["layers"][0]["name"] = "Adventurer A - hand-plotted walking v1 (review only)"
            data["export_profile"]["file_name"] = '"adventurer-a-handcluster-v1"'
            data["license"] = "Unapproved review-only candidate"
            with zipfile.ZipFile(OUT / "adventurer-a-handcluster-v1.pxo", "w",
                                 compression=zipfile.ZIP_DEFLATED, compresslevel=9) as dest:
                dest.writestr("mimetype", src.read("mimetype"))
                dest.writestr("data.json", json.dumps(data,separators=(",",":"),ensure_ascii=False))
                from io import BytesIO
                b = BytesIO()
                frames[0].save(b,format="PNG")
                dest.writestr("preview.png",b.getvalue())
                for i,f in enumerate(frames,1):
                    dest.writestr(f"image_data/frames/{i}/layer_1",f.tobytes())
                    dest.writestr(f"image_data/frames/{i}/indices_layer_1",b"\x00")

    scale = 5
    bg = Image.new("RGB", (W*scale,H*scale), (226,214,191))
    gifs = []
    for f in frames:
        p = bg.copy()
        p.paste(f.resize((W*scale,H*scale),Image.Resampling.NEAREST), (0,0),
                f.getchannel("A").resize((W*scale,H*scale),Image.Resampling.NEAREST))
        gifs.append(p)
    gifs[0].save(OUT / "adventurer-a-handcluster-v1.gif", save_all=True,
                 append_images=gifs[1:], duration=125, loop=0, optimize=False)

    # Atlas contact view: also shows every pose simultaneously for frame review.
    sheet = Image.new("RGB", (W*scale*4,H*scale*2), (226,214,191))
    for i,f in enumerate(frames):
        p = f.resize((W*scale,H*scale),Image.Resampling.NEAREST)
        sheet.paste(p, ((i%4)*W*scale,(i//4)*H*scale), p)
    sheet.save(OUT / "adventurer-a-handcluster-contact.png")

    hashes = [hashlib.sha256(f.tobytes()).hexdigest() for f in frames]
    raw_pixels = atlas.tobytes()
    visible_colors = {tuple(raw_pixels[i:i+4]) for i in range(0,len(raw_pixels),4)
                      if raw_pixels[i+3]}
    assert len(set(hashes)) == 8
    assert all(all(a in (0,255) for a in f.tobytes()[3::4]) for f in frames)
    assert len(visible_colors) <= len(P)
    # Regression on the user's specific complaint: upper-body silhouettes and
    # actual torso pixels must not be identical between opposing gait phases.
    def changed_pixels(a,b,crop):
        r1=frames[a].crop(crop).tobytes()
        r2=frames[b].crop(crop).tobytes()
        return sum(r1[i:i+4]!=r2[i:i+4] for i in range(0,len(r1),4))
    upper_motion=[changed_pixels(i,i+4,(21,30,50,55)) for i in range(4)]
    assert min(upper_motion)>150, f"upper_body_too_static:{upper_motion}"
    checks = {
        "native_frame_size": [W,H], "frame_count": len(frames),
        "native_atlas_size": list(atlas.size),
        "visible_color_count": len(visible_colors),
        "palette_colors": len(P), "alpha_mode": "binary",
        "distinct_frame_sha256": hashes,
        "upper_body_changed_pixels_opposing_phase": upper_motion,
        "frame_bboxes": [f.getbbox() for f in frames],
    }
    (OUT / "adventurer-a-handcluster-checks.json").write_text(
        json.dumps(checks,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:v for k,v in checks.items() if k!="distinct_frame_sha256"}))


if __name__ == "__main__":
    build()
