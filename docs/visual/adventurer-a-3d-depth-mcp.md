# Adventurer A — 3D Depth ControlNet pilot (review only)

**State:** true 3D per-surface depth controls A and B generated, visually inspected and tested. GPU character generation with Depth ControlNet **not run**. Keep Draft PR #1060, approved identity, visual Canon and game assets intact.

## Depth generator

Source: scripts/adventurer-a-walk/export_depth_controls.py

It reuses original prepare_pose_3d.py meshes and the fixed orthographic camera, and rasterizes visible triangles using a CPU z-buffer (not an OpenPose joint-depth approximation).

Output from a new, empty destination directory: pose-a-depth.png, pose-b-depth.png, pose-a-silhouette.png, pose-b-silhouette.png, two surface-ID QA PNGs, depth-review-sheet.png and depth-manifest.json. In the color-coded QA image, orange is the near leg and cyan is the far leg; never feed that color image into Depth ControlNet.

Background depth 0, foreground near surfaces brighter. Constant depth clip [-0.35,1.30] and identical camera for A/B. Local test: 25,666 differing depth pixels, two correctly reversed actual 3D leg-contact poses, 512x512 output.

Pinned PNG SHA-256:
- Pose A: f4f9c7d53853c26f5427a1c97941181aa40253fb2453dfff168815b04afe6ce9
- Pose B: 5c5ef52952e286997d9ac856204c3e6ff1d66a0f1a082b6156a89664f69f7f4c

Reproduce using a separate Python environment with numpy, trimesh, Pillow. From Crownless repo root run:

    python scripts/adventurer-a-walk/export_depth_controls.py .qa/candidates/adventurer-a-depth-v1

The output directory must not contain existing files.

## Verified model requirement

Official ComfyUI tutorial recommends SD1.5 fp16 Depth ControlNet:

https://huggingface.co/comfyanonymous/ControlNet-v1-1_fp16_safetensors/blob/main/control_v11f1p_sd15_depth_fp16.safetensors

File: control_v11f1p_sd15_depth_fp16.safetensors
Provider-declared SHA-256: 1c4a79aa52fb63f607cb9ff479ea5aa1923b6ceb21267bd14b69bd05d7b617be

The upstream model family lllyasviel/control_v11f1p_sd15_depth lists OpenRAIL; review license for production use. Place the official checked file at the already working ComfyUI/models/controlnet directory; never overwrite an existing model. This experiment does NOT download/install it and does not require Klein.

## Windows-side registration

Use scripts/adventurer-a-walk/register_depth_mcp.ps1 once on the PC owner checkout after model installation and depth image preparation:

    powershell -NoProfile -STA -ExecutionPolicy Bypass -File scripts/adventurer-a-walk/register_depth_mcp.ps1

It requests the actual existing ComfyUI Local MCP allowlist by selecting the older adventurer-a-near-contact.json and the depth image folder by selecting pose-a-depth.png. Or pass -McpWorkflowDir and -DepthDir. The Python installer verifies model SHA, approved anchor, exact A/B image SHA, and all original four pinned model hashes; preflights all existing targets before writing.

New names:
- adventurer-a-3d-depth-a
- adventurer-a-3d-depth-b

Existing v1/v2/3D OpenPose workflows and game assets must not be overwritten. Keep ComfyUI bound only to 127.0.0.1:8188.

## One-shot GPU gate

Check ComfyUI Local list_workflows and queue_status. If both new names appear, run A once, use get_result then get_image. Examine near leg truly ahead, both boot soles grounded, correct toes, intact knees/clothing, approved Adventurer A identity and camera. Run B only if A passes and compare actual leg reversal. If A fails, stop; no eight-frame expansion or automatic asset adoption.

Local independent verification: four 3D depth/occlusion tests and four registration unit tests passed. These do not establish owner-PC GPU runtime, character quality or animation approval.
