# Adventurer A: local ComfyUI smoke and walk research

This is a local, no-paid-API experiment. It does not replace the game actor or approve motion. The current identity authority is `docs/assets/adventurer-a-approved-anchor-v1.png` and its manifest; the eight-pose dummy in `docs/characters/adventurer-a.md` is approved for gait only. The flat costume overlay was rejected. The dummy's source is not present on current main, so do not invent a replacement and call it the approved guide.

## Compatibility (checked 2026-10-29)

- [ComfyUI Windows portable](https://docs.comfy.org/installation/comfyui_portable_windows) offers a separate AMD ROCm archive with embedded Python and `run_amd_gpu.bat`. Packaging is not a guarantee for every GPU or driver.
- [TheRock releases](https://github.com/ROCm/TheRock/blob/main/RELEASES.md) list Windows ROCm and PyTorch packages and `device-gfx1030`; [support status](https://github.com/ROCm/TheRock/blob/main/SUPPORTED_GPUS.md) and nightly status may change. This is separate from the versions bundled in ComfyUI. Do not mix wheels into the portable install without a separate tested environment.
- [Microsoft DirectML PyTorch](https://learn.microsoft.com/en-us/windows/ai/directml/pytorch-windows) is public preview for DirectX 12 GPUs; this does not establish that the current ComfyUI workflow or every operator works on RX 6800. Keep it as a fallback experiment, not a promised route.
- RX 6800 is gfx1030, but availability of a package, HIP SDK support, PyTorch support, OS support and an actual 512px generation are different claims. Check the current AMD matrix for the precise release, OS and driver. Windows 11 26H2 with this specific GPU is not established by these documents alone.

## Run locally

Install the official AMD portable archive on a drive with sufficient space, verify its release checksum, and extract into a new folder. Do not replace an existing ComfyUI or Python environment. No checkpoint is bundled: supply a compatible local checkpoint you are licensed to use in `ComfyUI/models/checkpoints`, or configure ComfyUI's `extra_model_paths.yaml` to reference a local model directory without copying or changing its files. Avoid paid downloads or APIs. The smoke is a generic image, not a character-generation workflow.

From PowerShell in this repository, using the extracted portable root (the folder containing `python_embeded` and `run_amd_gpu.bat`):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/comfy-diagnose.ps1 -ComfyRoot 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable'
```

The diagnostic performs a real PyTorch tensor operation on its reported GPU. If it fails, capture the error; do not claim GPU generation succeeded. Start `run_amd_gpu.bat` and wait for `http://127.0.0.1:8188`. Check the server log and device name. With a local checkpoint shown in ComfyUI's checkpoint selector, in another PowerShell window:

```powershell
& 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable\python_embeded\python.exe' scripts/comfy-smoke.py --checkpoint 'YOUR_CHECKPOINT.safetensors'
```

The script sends one 512×512 job to **loopback only**, requires a GPU reported by ComfyUI, and prints the saved image name after the job completes. It does not install packages or overwrite assets; ComfyUI saves to its own output directory. A server that exposes a non-HIP backend can satisfy the device check: read its reported device and HIP diagnostic before describing the result as ROCm. A timeout does not cancel a queued job. Inspect the image dimensions and output and record the exact versions/driver; a successful HTTP response or queued job alone is not generation success.

## Next bounded animation experiment

Look for the exact approved eight-pose dummy source/provenance first. If it cannot be recovered, make a new pose study from the recorded gait contract and obtain human review; do not represent it as the original approved dummy. Use the motion guide for pose control, the A anchor for appearance, and a locally available licensed model and compatible pose-control mechanism in ComfyUI. Keep the same direction and camera across eight temporal frames. Compare the full cycle and phone-scale output against the anchor and dummy: alternate foot contact and crossing, level planted soles, arm counter-swing, stable head/torso and consistent coat, hair and sword. Export a review sheet and animated preview separately from runtime. Verify the actual artwork visually; pose controls and numeric checks cannot establish identity or animation quality. The necessary model, node compatibility, image generation and human review are not established by the smoke test.

## Observed on the local RX 6800 PC (2026-10-29)

Windows 11 Pro build 26300.9711, driver 32.0.21016.1010. The official ComfyUI v0.43.0 AMD archive SHA-256 matched its release. Its embedded PyTorch 2.9.1 / ROCm 7.2.1 crashed with access violation in GPU availability and ComfyUI startup. This is an observed failure of that combination, not proof of universal hardware incompatibility.

An isolated Python 3.12.11 environment on I: using AMD stable TheRock ROCm 10.1.0, torch 2.13.0 + torchvision 0.28.0 and gfx1030 device packages recognized RX 6800 and computed a GPU tensor sum. ComfyUI v0.43.0 started and generated a 512×512 PNG using an existing local SD1 checkpoint; its output was inspected. ComfyUI reported gfx1030, 16 GB VRAM and CUDA/HIP device 0. MIOpen emitted a missing gfx1030 database warning; the smoke completed despite it. This is one smoke, not evidence of all nodes or animation workflow compatibility. An unconstrained install initially selected torch 2.14 with torchvision 0.28 and failed to load torchvision; use the matching versions listed by AMD.

On this PC, `I:\02_AI\ComfyUI-Crownless\run-therock-gfx1030.bat` starts the tested configuration. It refers to the existing local model directory via a separate YAML file. The server must not already be running on port 8188. The portable-only commands above test a different environment; use the isolated environment's Python for the smoke on this PC.

## Local pose-control experiment (2026-10-29)

`scripts/adventurer-a-walk/pose_study.py` creates a **new, provisional** right-facing eight-position OpenPose guide from the written contract. It is not the unavailable human-approved dummy. It keeps separate near/far legs, alternates opposing contact positions, raises the passing foot and limits guide-head movement; those coordinates are not evidence that a generated sprite actually obeys them. The PNG guide and GIF are rendered locally into a newly created output directory; the original anchor remains unchanged.

`scripts/adventurer-a-walk/run_poc.py` submits one frame at a time to local ComfyUI, uses the verified approved anchor as img2img source, and applies an SD1.5 OpenPose ControlNet. It checks the anchor, transformed reference and ControlNet SHA-256, requires a locally reported RX 6800, and places output in a new UUID directory. The review sheet and GIF show 128px cells; they include a background and are **not** transparent runtime sprites. A failure or timeout leaves the submitted ComfyUI job/outputs intact for inspection.

On the observed PC the full 8-frame experiment ran at denoise 0.35, 0.55 and 0.75 with the existing `yayoiMix_v25` SD1.5 photorealistic checkpoint and the same seed; GPU execution completed. Review comparisons are `docs/assets/candidates/adventurer-a-local-poc/img2img-035.png`, `img2img-055.png`, and `img2img-075.png`. At 0.35 the figure remained similar but legs barely moved; 0.55 changed hair, face and costume while showing weak gait; 0.75 changed identity and clothing substantially. All are **rejected experimental outputs**, not approved animation, and may not serve as generation parents. The results do not verify foot contact, crossing, torso stability or identity in the generated motion. Human inspection at actual phone scale remains required.

The ControlNet source is [lllyasviel/control_v11p_sd15_openpose](https://huggingface.co/lllyasviel/control_v11p_sd15_openpose), revision `9ae9f970358db89e211b87c915f9535c6686d5ba`, OpenRAIL; fp16 SHA-256 `b25b1125e870275550b2a7de289056cb3c236c01c293bd5ba883657b1c006e3e`. A second experiment may enable `--adapter --contacts-only`, requiring [IP-Adapter Plus](https://github.com/cubiq/ComfyUI_IPAdapter_plus) custom nodes at `a0f451a5113cf9becb0847b92884cb10cbdec0ef`, [IP-Adapter Plus SD1.5 weights](https://huggingface.co/h94/IP-Adapter) (Apache-2.0), [Comfy-Org CLIP Vision H](https://huggingface.co/Comfy-Org/Wan-2.1/blob/main/split_files/clip_vision/clip_vision_h.safetensors), and [SD1.5 pixel-art LoRA](https://huggingface.co/SedatAl/pixel-art-LoRa) (CreativeML OpenRAIL-M). These model files are not committed; obtain them under their licenses, pin and verify the hashes in the script. The adapter path is experimental and does not make a successful identity match automatic.

Example, after installing the above models and starting the isolated TheRock ComfyUI on loopback:

```powershell
$python = 'I:\02_AI\ComfyUI-Crownless\therock-gfx1030-test\Scripts\python.exe'
& $python scripts/adventurer-a-walk/pose_study.py 'I:\02_AI\ComfyUI-Crownless\new-walk-study' docs/assets/adventurer-a-approved-anchor-v1.png
& $python scripts/adventurer-a-walk/run_poc.py --study 'I:\02_AI\ComfyUI-Crownless\new-walk-study' --anchor docs/assets/adventurer-a-approved-anchor-v1.png --comfy 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable\ComfyUI' --checkpoint 'YOUR_SD15_CHECKPOINT.safetensors' --adapter --contacts-only
```

Each experimental output is a candidate only; no game asset or approved identity is replaced.

### Identity-reference comparison

On the same RX 6800, the `--adapter --contacts-only` variant completed both opposite-contact frames with the above pinned IP-Adapter and pixel LoRA. At denoise 0.55 it retained more of the hair and coat colors but changed facial features and largely held the same standing pose. At 0.75 the contact silhouettes separated somewhat but did not establish alternating natural foot contact. With `--text2img` the anchor is supplied through IP-Adapter while the latent starts from noise; the two frames diverged more in pose, but the sword and facial identity did not reliably match and one pose still reads as standing. Compare `adapter-055-contacts.png`, `adapter-075-contacts.png` and `adapter-text2img-contacts.png`. All three are unapproved experiment results; no 8-frame identity-adapter walk, transparent sprite, phone review or human motion acceptance has been achieved. The model and LoRA compatibility in this single test does not guarantee other ComfyUI combinations.

## Pixel-trained checkpoint comparison (2026-10-29)

The pixel-trained [PublicPrompts All-In-One Pixel Model](https://huggingface.co/PublicPrompts/All-In-One-Pixel-Model) describes a `pixelsprite` trigger and is distributed under CreativeML OpenRAIL-M. Revision `b4330356edc9eaeb98571c144e8bbabe8bb15897` distributes an older `.ckpt`; its SHA-256 is `d7fb6396ab39b73019f37040977e15ec76a2548372daa534f9ac44b61c3d9548`. `convert_pixel_checkpoint.py` verifies that exact hash, uses PyTorch `weights_only=True` without an unsafe fallback, requires a tensor-only state dict and refuses to replace an existing output. The resulting local `public-prompts-pixel.safetensors` SHA-256 on this PC was `7e0557dfa8083a0f6d1ccb969c8a31a8195e5c005784c1a9b61caf354e40d292`; the runner checks it before use. The original source and converted weights are kept on I: and are not checked in.

A second provisional guide adds right-facing face landmarks and colored joints (`--face-guide`) to help the control signal; it is not the original approved mannequin. `--no-lora --sprite-trigger` uses the pixel-trained base without the earlier LoRA. The runner also supports explicit near/far contact descriptions (`--phase-prompt`) and stronger ControlNet (`--control-strength 1.4`). Each output manifest records which frames were requested and the SHA-256 of each pose image. These are experimental knobs rather than proof of identity preservation or gait correctness.

With the same RX 6800 setup, comparing the earlier pose guide, the new face guide, img2img and stronger control gave the contact sheets `pixel-base-original-guide.png`, `pixel-base-face-guide.png`, `pixel-base-img2img.png` and `pixel-base-phase-strong.png`. The new face guide was separately compared with the previous photo-oriented base in `face-guide-photobase-contacts.png`. The pixel model made the palette and pixel treatment more consistent, but the face became a side profile, the sheathed sword disappeared, and the contacts did not reliably show alternating feet. The two stronger-control contact frames regenerated as exact RGB pixel matches on this machine with the same inputs and seed. This only demonstrates repeatability for this setup, not broader determinism or visual acceptance.

An eight-frame loop from the stronger-control candidate is kept as `pixel-base-full-review.png` and `pixel-base-full-review.gif` to expose the motion failure. On the 512px outputs, a simple threshold against each corner background gave character bounding-box bottom rows 417–424 and top rows 104–112; this is a coarse silhouette diagnostic, not measured foot contact or torso motion. The visible feet do not establish clean near/far alternation and identity details differ from the anchor. The generated review images have opaque backgrounds and are not a transparent atlas or approved game sprite. Do not adopt or use them as new identity parents. The next experiment needs a better motion/identity control approach and a human phone-scale review.

Example of the tested pixel-model comparison after safe conversion and launching local ComfyUI:

```powershell
$python = 'I:\02_AI\ComfyUI-Crownless\therock-gfx1030-test\Scripts\python.exe'
& $python scripts/adventurer-a-walk/convert_pixel_checkpoint.py 'I:\02_AI\ComfyUI-Crownless\Public-Prompts-Pixel-Model.ckpt.download' 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable\ComfyUI\models\checkpoints\public-prompts-pixel.safetensors'
& $python scripts/adventurer-a-walk/pose_study.py 'I:\02_AI\ComfyUI-Crownless\new-face-study' docs/assets/adventurer-a-approved-anchor-v1.png --face-guide
& $python scripts/adventurer-a-walk/run_poc.py --study 'I:\02_AI\ComfyUI-Crownless\new-face-study' --anchor docs/assets/adventurer-a-approved-anchor-v1.png --comfy 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable\ComfyUI' --checkpoint public-prompts-pixel.safetensors --adapter --no-lora --sprite-trigger --contacts-only --text2img --phase-prompt --control-strength 1.4
```

The conversion command intentionally fails if its destination already exists. No paid service is required for this local run, but usage remains subject to the models' respective licenses.

## Temporal AnimateDiff experiment (2026-10-29)

The prior loop generated every frame independently. This experiment instead feeds all eight provisional pose images in order into one ComfyUI `ImageBatch`, samples eight latents in one KSampler job and uses an AnimateDiff v3 temporal module. IP-Adapter references only the approved Adventurer A anchor, and the same pinned pixel checkpoint and OpenPose ControlNet are used. It is still a local, review-only experiment; temporal coupling does not by itself guarantee identity, gait or a seamless loop.

The tested custom node was [AnimateDiff Evolved](https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved) commit `9257651221002dcba0a12f9cff37e1944e58fb60`. The [original AnimateDiff motion model](https://huggingface.co/guoyww/animatediff/blob/9cfaa8a83b89eec48b4b0ee8c970e8b9f69f2089/v3_sd15_mm.safetensors) is Apache-2.0, revision `9cfaa8a83b89eec48b4b0ee8c970e8b9f69f2089`, SHA-256 `73c4b969c778b2ea96a172c3b432572b654e91865f9f224a709dbda13e730043`. It is stored on I: and not included in the repository. The runner verifies the motion model, checkpoint, ControlNet, IP-Adapter, CLIP vision and anchor hashes. The extension commit is recorded but not enforced by the runner.

On the same RX 6800 / TheRock environment, all three jobs completed with eight 512×512 output images. The noise-start run (`temporal-noise`) had a consistent but noisy scene background and nearly static legs. Repeating the approved anchor latent for each frame (`temporal-anchor-09` and `temporal-anchor-14`, ControlNet 0.9 and 1.4) preserved the general costume more closely but still did not produce visible alternating foot contacts; backgrounds deteriorated in later frames. Inspect the PNG sheets and GIFs under `docs/assets/candidates/adventurer-a-local-poc/`. These are failures, not approved sprites; backgrounds are opaque, the original 8-pose mannequin is still unavailable, and no human phone-scale acceptance is claimed. Do not adopt them or use them as new generation parents.

Example after installing the pinned extension and model, and starting the local ComfyUI:

```powershell
$python = 'I:\02_AI\ComfyUI-Crownless\therock-gfx1030-test\Scripts\python.exe'
& $python scripts/adventurer-a-walk/run_temporal_poc.py --study 'I:\02_AI\ComfyUI-Crownless\walk-poc-20261029-v4' --anchor docs/assets/adventurer-a-approved-anchor-v1.png --comfy 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable\ComfyUI' --img2img --control-strength 0.9
```

Generate a new study using `pose_study.py ... --face-guide` if that local path is absent. Time coupling worked on this machine, but another motion/identity strategy or a better approved pose source is still needed before phone-scale human review.

## Fixed-length pose guide and comparison (2026-10-29)

`pose_study_ik.py` creates a **new, unapproved** 8-pose guide; the earlier human-approved mannequin remains unavailable. The previous guide interpolated knees directly and changed segment length from frame to frame. This study solves the knee with two equal 62px segments, uses alternating contact and swing phases, keeps a 400px ground line and counter-swings the arms. The planted foot translates backward by a constant amount relative to the character during each stance. OpenPose limb order and colors follow the [ControlNet OpenPose renderer](https://github.com/lllyasviel/ControlNet/blob/main/annotator/openpose/util.py). Foot marks are added only to the review GIF, not to the ControlNet input. `pose-study-ik.json` retains coordinates and ground flags, and `pose-study-ik.gif` shows the provisional guide. Tests check segment lengths, contact order, stance displacement, passing height, head range, and refusal to overwrite the output directory. These checks verify authored coordinates, not natural movement or user approval.

With the same pixel-trained checkpoint, IP-Adapter, seed and ControlNet settings as the prior independent-frame comparison, the RX 6800 generated eight 512px frames (`ik-independent.png` / `.gif`). The middle leg poses vary more visibly than the previous guide but the character becomes side-facing, the back sword disappears and actual near/far foot alternation is not established. The temporal configuration (`ik-temporal.png` / `.gif`) completed but remained near-static with a deteriorating background. Both are unapproved failures with opaque backgrounds.

`analyze_walk.py` reports foreground bounding-box diagnostics for images with near-uniform corners and rejects unsuitable inputs. The independent run's lowest foreground row varied by 8px and top row by 4px on the 512px source; see `ik-bbox-diagnostic.json`. Thresholds may include shadows, hair and background artifacts, so these values are **not** foot-contact, crossing, torso stability, or identity measurements. Human visual inspection remains necessary; no game or Canon asset is changed.

```powershell
$python = 'I:\02_AI\ComfyUI-Crownless\therock-gfx1030-test\Scripts\python.exe'
& $python scripts/adventurer-a-walk/pose_study_ik.py 'I:\02_AI\ComfyUI-Crownless\new-ik-study' docs/assets/adventurer-a-approved-anchor-v1.png
& $python scripts/adventurer-a-walk/run_poc.py --study 'I:\02_AI\ComfyUI-Crownless\new-ik-study' --anchor docs/assets/adventurer-a-approved-anchor-v1.png --comfy 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable\ComfyUI' --checkpoint public-prompts-pixel.safetensors --adapter --no-lora --sprite-trigger --text2img --phase-prompt --control-strength 1.4
# Then run analyze_walk.py with the new run directory and a new output JSON path.
```
