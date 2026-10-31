"""Export two review-only Adventurer A contact workflows for ComfyUI Local MCP.

This script does NOT submit a job. It copies verified, approved-reference inputs
into ComfyUI's input directory and writes only API-format JSON into the
PC owner's explicitly chosen MCP allowlist directory.

Example (from Crownless repository root, with the existing study created by
pose_study_ik.py):

  python scripts/adventurer-a-walk/export_mcp_workflows.py \
    --study I:\\02_AI\\ComfyUI-Crownless\\new-mask-study \
    --anchor docs/assets/adventurer-a-approved-anchor-v1.png \
    --comfy I:\\02_AI\\ComfyUI-Crownless\\ComfyUI_windows_portable\\ComfyUI \
    --workflow-dir PATH_TO_COMFYUI_LOCAL_MCP_ALLOWLIST

After registration, run only the two exported names through ComfyUI Local MCP.
Both outputs are unapproved candidates; never overwrite game assets.
"""
import argparse
import hashlib
import importlib.util
import json
import shutil
from pathlib import Path

from PIL import Image, ImageChops

RUNNER = Path(__file__).with_name("run_poc.py")
spec = importlib.util.spec_from_file_location("adventurer_a_run_poc", RUNNER)
walk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(walk)

STAGING_NAME = "crownless-mcp-adventurer-a-v1"
EXPECTED_HASHES = {
    "models/checkpoints/public-prompts-pixel.safetensors": walk.PIXEL_SHA,
    "models/controlnet/openpose-sd15-b25b1125.safetensors":
        "b25b1125e870275550b2a7de289056cb3c236c01c293bd5ba883657b1c006e3e",
    "models/ipadapter/ip-adapter-plus_sd15.safetensors":
        "a1c250be40455cc61a43da1201ec3f1edaea71214865fb47f57927e06cbe4996",
    "models/clip_vision/clip_vision_h.safetensors":
        "64a7ef761bfccbadbaa3da77366aac4185a6c58fa5de5f589b42a65bcc21f161",
}
CONTACTS = (
    ("near", 0, "near leg forward, far leg back, both boot soles on ground"),
    ("far", 4, "far leg forward, near leg back, both boot soles on ground"),
)


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_if_absent_or_identical(path, data):
    """Never overwrite a locally modified input, registered workflow or symlink."""
    if path.is_symlink():
        raise ValueError(f"Refusing symlink: {path}")
    if path.exists():
        if not path.is_file() or path.read_bytes() != data:
            raise FileExistsError(f"Existing file differs; nothing overwritten: {path}")
        return
    path.write_bytes(data)


def validate_approved_inputs(args):
    if sha256(args.anchor) != walk.ANCHOR_SHA:
        raise ValueError("Approved Adventurer A anchor SHA-256 mismatch")
    for relative, expected in EXPECTED_HASHES.items():
        path = args.comfy / relative
        if sha256(path) != expected:
            raise ValueError(f"Pinned model checksum mismatch: {relative}")
    with Image.open(args.anchor) as source:
        reference = source.convert("RGBA").resize((256, 384), Image.Resampling.NEAREST)
    expected = Image.new("RGBA", (512, 512), (128, 128, 128, 255))
    expected.alpha_composite(reference, (128, 64))
    with Image.open(args.study / "anchor-input.png") as staged:
        if ImageChops.difference(expected.convert("RGB"), staged.convert("RGB")).getbbox():
            raise ValueError("Study anchor-input differs from the approved anchor transform")
    for name in ["anchor-input.png", "lower-mask.png", "pose-00.png", "pose-04.png"]:
        with Image.open(args.study / name) as im:
            if im.size != (512, 512):
                raise ValueError(f"Expected a 512x512 guide: {name}")


def build_workflows():
    outputs = {}
    for label, frame, phase in CONTACTS:
        image_base = f"{STAGING_NAME}/"
        graph = walk.workflow(
            anchor=image_base + "anchor.png",
            pose=image_base + f"pose-{frame:02}.png",
            model=walk.PIXEL_CHECKPOINT,
            prefix=f"crownless_mcp_candidate/adv_a_{label}_contact",
            denoise=1.0,
            adapter=True,
            no_lora=True,
            sprite_trigger=True,
            phase=phase,
            control_strength=1.4,
            lower_mask=image_base + "lower-mask.png",
        )
        outputs[f"adventurer-a-{label}-contact.json"] = (
            json.dumps(graph, ensure_ascii=False, indent=2) + "\n"
        ).encode("utf-8")
    return outputs


def export(args):
    if not args.workflow_dir.is_dir():
        raise NotADirectoryError(
            "Specify the EXISTING ComfyUI Local MCP allowlist directory with --workflow-dir"
        )
    if not (args.comfy / "input").is_dir():
        raise NotADirectoryError("Not a ComfyUI root (input directory missing)")
    validate_approved_inputs(args)
    stage = args.comfy / "input" / STAGING_NAME
    exports = build_workflows()
    input_files = {
        "anchor.png": "anchor-input.png",
        "lower-mask.png": "lower-mask.png",
        "pose-00.png": "pose-00.png",
        "pose-04.png": "pose-04.png",
    }
    # Fail before writing anything when a previous version differs.
    for dest_name, source_name in input_files.items():
        dest = stage / dest_name
        if dest.exists() and (dest.is_symlink() or dest.read_bytes() != (args.study / source_name).read_bytes()):
            raise FileExistsError(f"Conflicting prepared input: {dest}")
    for name, contents in exports.items():
        dest = args.workflow_dir / name
        if dest.exists() and (dest.is_symlink() or dest.read_bytes() != contents):
            raise FileExistsError(f"Conflicting MCP allowlist entry: {dest}")
    stage.mkdir(exist_ok=True)
    for dest_name, source_name in input_files.items():
        write_if_absent_or_identical(stage / dest_name, (args.study / source_name).read_bytes())
    for name, contents in exports.items():
        write_if_absent_or_identical(args.workflow_dir / name, contents)
    for name in exports:
        print(f"Registered candidate: {name.removesuffix('.json')}")
    print("Review only. Confirm list_workflows, then run each candidate separately.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--study", type=Path, required=True)
    parser.add_argument("--anchor", type=Path, required=True)
    parser.add_argument("--comfy", type=Path, required=True)
    parser.add_argument("--workflow-dir", type=Path, required=True)
    export(parser.parse_args())
