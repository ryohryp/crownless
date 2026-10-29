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
powershell -ExecutionPolicy Bypass -File scripts/comfy-diagnose.ps1 -ComfyRoot 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable_amd'
```

The diagnostic performs a real PyTorch tensor operation on its reported GPU. If it fails, capture the error; do not claim GPU generation succeeded. Start `run_amd_gpu.bat` and wait for `http://127.0.0.1:8188`. Check the server log and device name. With a local checkpoint shown in ComfyUI's checkpoint selector, in another PowerShell window:

```powershell
& 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable_amd\python_embeded\python.exe' scripts/comfy-smoke.py --checkpoint 'YOUR_CHECKPOINT.safetensors'
```

The script sends one 512×512 job to **loopback only**, requires a GPU reported by ComfyUI, and prints the saved image name after the job completes. It does not install packages or overwrite assets; ComfyUI saves to its own output directory. A server that exposes a non-HIP backend can satisfy the device check: read its reported device and HIP diagnostic before describing the result as ROCm. A timeout does not cancel a queued job. Inspect the image dimensions and output and record the exact versions/driver; a successful HTTP response or queued job alone is not generation success.

## Next bounded animation experiment

Recover the exact approved eight-pose dummy source/provenance first. Use it for motion control, the A anchor for appearance, and a locally available licensed model and compatible pose-control mechanism in ComfyUI. Keep the same direction and camera across eight temporal frames. Compare the full cycle and phone-scale output against the anchor and dummy: alternate foot contact and crossing, level planted soles, arm counter-swing, stable head/torso and consistent coat, hair and sword. Export a review sheet and animated preview separately from runtime. Verify the actual artwork visually; pose controls and numeric checks cannot establish identity or animation quality. The necessary model, node compatibility, image generation and human review are not established by the smoke test.
