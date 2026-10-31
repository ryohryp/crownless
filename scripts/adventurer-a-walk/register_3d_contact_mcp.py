"""Register the previously rendered 3D A/B controls as review-only MCP workflows.

No ComfyUI jobs are launched. --study contains pose-a-openpose.png and
pose-b-openpose.png from the previously built 3D guide kit.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

here = Path(__file__).parent
spec = importlib.util.spec_from_file_location("base_export", here / "export_mcp_workflows.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
STAGE = "crownless-mcp-adventurer-a-3d-v1"
PIXELS = {
    "a": "f93b436f47d1f05b6715e21651b07f16c688002532c133347e55ee2a512ec97a",
    "b": "ca86e6d04e36968fb3969b7d54c3a401d9dff29d7359a0034689ff8ca827c982",
}


def staged_inputs(study, anchor):
    if base.sha256(anchor) != base.walk.ANCHOR_SHA:
        raise ValueError("Approved character anchor differs")
    with Image.open(anchor) as original:
        ref = original.convert("RGBA").resize((256, 384), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (512, 512), (128, 128, 128, 255))
    canvas.alpha_composite(ref, (128, 64))
    mask = Image.new("L", (512, 512), 0)
    ImageDraw.Draw(mask).rectangle((175, 304, 361, 438), fill=255)
    result = {"anchor.png": canvas.convert("RGB"),
              "lower-mask.png": mask.filter(ImageFilter.GaussianBlur(7)).convert("RGB")}
    for label in ("a", "b"):
        with Image.open(study / f"pose-{label}-openpose.png") as image:
            pose = image.convert("RGB")
        if pose.size != (512, 512) or hashlib.sha256(pose.tobytes()).hexdigest() != PIXELS[label]:
            raise ValueError(f"3D {label} control is not the verified original")
        result[f"pose-{label}.png"] = pose
    return result


def graphs():
    outputs = {}
    for label in ("a", "b"):
        phase = ("camera-near leg forward, camera-far leg back" if label == "a"
                 else "camera-far leg forward, camera-near leg back")
        graph = base.walk.workflow(
            f"{STAGE}/anchor.png", f"{STAGE}/pose-{label}.png",
            base.walk.PIXEL_CHECKPOINT,
            f"crownless_mcp_candidate/adventurer_a_3d_contact_{label}",
            denoise=0.85, adapter=True, no_lora=True, sprite_trigger=True,
            phase=phase + ", grounded boot soles and right-pointing toes",
            control_strength=1.4, lower_mask=f"{STAGE}/lower-mask.png")
        graph["3"]["inputs"]["text"] += (
            ", oversized lunge, floating foot, exposed knee, bare thigh, "
            "left-pointing toes, changed hairstyle or coat")
        outputs[f"adventurer-a-3d-contact-{label}.json"] = (
            json.dumps(graph, indent=2, ensure_ascii=False) + "\n").encode()
    return outputs


def install(args):
    if not args.workflow_dir.is_dir() or not (args.comfy / "input").is_dir():
        raise NotADirectoryError("Use the existing owner-approved MCP folder and ComfyUI input directory")
    for rel, digest in base.EXPECTED_HASHES.items():
        if base.sha256(args.comfy / rel) != digest:
            raise ValueError("Model checksum mismatch: " + rel)
    images = staged_inputs(args.study, args.anchor)
    workflows = graphs()
    stage = args.comfy / "input" / STAGE
    # Check every destination before writing anything.
    for name, img in images.items():
        dest = stage / name
        if dest.is_symlink() or (dest.exists() and
                (not dest.is_file() or Image.open(dest).convert("RGB").tobytes() != img.tobytes())):
            raise FileExistsError("Conflicting staged image: " + str(dest))
    for name, data in workflows.items():
        dest = args.workflow_dir / name
        if dest.is_symlink() or (dest.exists() and (not dest.is_file() or dest.read_bytes() != data)):
            raise FileExistsError("Conflicting allowlisted workflow: " + str(dest))
    stage.mkdir(exist_ok=True)
    for name, img in images.items():
        if not (stage / name).exists():
            img.save(stage / name)
    for name, data in workflows.items():
        base.write_if_absent_or_identical(args.workflow_dir / name, data)
        print("Registered review candidate:", name.removesuffix(".json"))
    print("No GPU job submitted. Run contact-a once before contact-b.")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--study", type=Path, required=True)
    p.add_argument("--anchor", type=Path, required=True)
    p.add_argument("--comfy", type=Path, required=True)
    p.add_argument("--workflow-dir", type=Path, required=True)
    install(p.parse_args())
