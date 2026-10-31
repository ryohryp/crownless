# Adventurer A: deterministic 3D contact reference — experimental, unapproved

**Status:** Geometry A/B and source completed, AI-generated A/B sprites **not** tested with this 3D guide. Do not ship, merge into runtime, or promote to visual Canon. See [3D feasibility](adventurer-a-3d-pose-feasibility.md) and the existing [ComfyUI POC](adventurer-a-comfy-local.md).

## Why this differs from the rejected 2D rig

The objective of this experiment is **not** to animate assembled image cutouts or replace the approved actor with a simple 3D figure. It is to supply a true three-dimensional, inspectable **pose-control reference** to subsequent image generation. A 3D source can encode leg depth, ankle contact and rightward toes that a bare two-dimensional OpenPose diagram cannot.

A *procedural, originally authored* low-poly 3D mannequin is constructed entirely from geometric primitives. No externally licensed humanoid, FBX, Mixamo motion, new paid model or remote code is required. The face, sword and outfit are placeholders; only the approved identity anchor `docs/assets/adventurer-a-approved-anchor-v1.png` is authoritative for eventual character art. The approved historic colored walking dummy is not claimed to be recovered.

The output is **two deliberate contact poses**, not an eight-frame walk cycle.

- **A:** near (camera-side) leg forward, far leg trailing.
- **B:** far leg forward, near leg trailing.
- Both soles touch ground Z=0. Both boot toes point to +X. Near/far depth is fixed at Y=-0.2 / +0.2.
- Knee joints solve a two-segment analytic IK with fixed bone lengths 0.78 scene units.
- Body/head, orthographic camera azimuth -68°, camera elevation 23° and output size remain fixed.

## Run the deterministic 3D generator

From the Crownless repository root, in a **separate optional Python virtual environment** (do not replace the working RX 6800 TheRock environment):

```powershell
py -3.12 -m venv .venv-pose3d
.\.venv-pose3d\Scripts\python.exe -m pip install numpy trimesh matplotlib Pillow
.\.venv-pose3d\Scripts\python.exe scripts/adventurer-a-walk/prepare_pose_3d.py .qa/candidates/adventurer-a-3d-contact-v1
.\.venv-pose3d\Scripts\python.exe -m unittest discover -s test -p test_adventurer_pose_3d.py -v
```

The generator will refuse to reuse an output directory containing files. Reruns require a **fresh output directory**. Model downloads and paid APIs are **not required** for this stage.

Outputs:

| Filename | Meaning |
|---|---|
| `contact-a.glb`, `contact-b.glb` | Real 3D triangle meshes suitable for viewing in GLB-aware tools |
| `contact-a.png`, `contact-b.png` | Fixed-camera 512×512 3D reference renders |
| `pose-a-openpose.png`, `pose-b-openpose.png` | 512×512 projected skeletal ControlNet hints |
| `contact-sheet.png` | Human-inspectable comparison |
| `geometry.json` | World-space and projected joint coordinates plus front-leg, toe and camera contracts |

The script has been run independently in an isolated Python container with both 3D poses generated and **2 local unit tests passing**. This does **not** establish that ComfyUI, SD1.5, IP-Adapter or FLUX follows either control image on the owner-PC GPU, or that the two poses form a natural walking cycle.

## Next: one bounded GPU test, not another broad research task

The existing ComfyUI Local MCP allowlist **does not accept arbitrary workflows or upload a new control image from ChatGPT**. To test the new 3D guide, the Windows-side executor must first stage `pose-a-openpose.png` and (after review) `pose-b-openpose.png` into the *local* ComfyUI input folder and register **new, uniquely named** API graph files using the existing `scripts/adventurer-a-walk/run_poc.py` `workflow()` builder, pinned pixel checkpoint, approved Adventurer A anchor, IP-Adapter and OpenPose ControlNet. Never repurpose/overwrite the v1/v2 registered workflow entries. No need to download Klein for this initial comparison.

Generate Pose A only and inspect:
1. Right-facing oblique camera and same charcoal/silver hair, navy coat, boots, sword.
2. Near leg is visibly ahead of far leg, both toe caps point right and boots contact the ground.
3. Legs/coat do not split, stretch, swap material or expose knees.
4. Same head/torso position as the approved reference.

Only if A is plausible, queue B and verify **actual near/far contact reversal**, not merely a different knee angle. A failed pose is a result, not a reason to run dozens more jobs or silently replace the character. Keep output under a review-only candidate directory; update Draft PR #1060 with the prompt IDs and the actual imagery.

## Acceptance boundaries

Geometry tests guarantee the authored guide's 3D joint positions, bone lengths and front-leg reversal, **not the generated art**. GLB files are editable 3D meshes but do not contain a textured or rigged version of the approved Adventurer A. No GPU run with these new controls, final transparent sheet or phone-scale approval is claimed.
