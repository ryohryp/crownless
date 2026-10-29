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

Recover the exact approved eight-pose dummy source/provenance first. Use it for motion control, the A anchor for appearance, and a locally available licensed model and compatible pose-control mechanism in ComfyUI. Keep the same direction and camera across eight temporal frames. Compare the full cycle and phone-scale output against the anchor and dummy: alternate foot contact and crossing, level planted soles, arm counter-swing, stable head/torso and consistent coat, hair and sword. Export a review sheet and animated preview separately from runtime. Verify the actual artwork visually; pose controls and numeric checks cannot establish identity or animation quality. The necessary model, node compatibility, image generation and human review are not established by the smoke test.

## Observed on the local RX 6800 PC (2026-10-29)

Windows 11 Pro build 26300.9711, driver 32.0.21016.1010. The official ComfyUI v0.43.0 AMD archive SHA-256 matched its release. Its embedded PyTorch 2.9.1 / ROCm 7.2.1 crashed with access violation in GPU availability and ComfyUI startup. This is an observed failure of that combination, not proof of universal hardware incompatibility.

An isolated Python 3.12.11 environment on I: using AMD stable TheRock ROCm 10.1.0, torch 2.13.0 + torchvision 0.28.0 and gfx1030 device packages recognized RX 6800 and computed a GPU tensor sum. ComfyUI v0.43.0 started and generated a 512×512 PNG using an existing local SD1 checkpoint; its output was inspected. ComfyUI reported gfx1030, 16 GB VRAM and CUDA/HIP device 0. MIOpen emitted a missing gfx1030 database warning; the smoke completed despite it. This is one smoke, not evidence of all nodes or animation workflow compatibility. An unconstrained install initially selected torch 2.14 with torchvision 0.28 and failed to load torchvision; use the matching versions listed by AMD.

On this PC, `I:\02_AI\ComfyUI-Crownless\run-therock-gfx1030.bat` starts the tested configuration. It refers to the existing local model directory via a separate YAML file. The server must not already be running on port 8188. The portable-only commands above test a different environment; use the isolated environment's Python for the smoke on this PC.
