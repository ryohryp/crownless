# Adventurer A: ComfyUI Local MCP two-contact pilot (review only)

This extends the existing [ComfyUI proof of concept](adventurer-a-comfy-local.md).
It does **not** add a new image model, replace the approved anchor, or merge
generated sprites into the game. The purpose is to call two opposing contact
poses from ChatGPT's already-connected **ComfyUI Local** MCP without allowing
arbitrary graphs to be submitted in chat.

## Preconditions

- The Windows 11 / RX 6800 ComfyUI instance is running on **loopback only**
  (`127.0.0.1:8188`). Never expose that unauthenticated port to the Internet.
- The existing ComfyUI Local MCP currently lists only `smoke`; it has
  `list_workflows`, `run_workflow`, `get_result`, `get_image` and
  `queue_status`. It deliberately **cannot write or upload new workflows**.
- A local Crownless checkout has the approved anchor
  `docs/assets/adventurer-a-approved-anchor-v1.png` and this branch's
  `scripts/adventurer-a-walk/` scripts.
- The tested pixel checkpoint, OpenPose ControlNet, IP-Adapter SD1.5 and
  CLIP-Vision H files are already present, with hashes verified by the exporter.
- The **ComfyUI Local MCP server's configured workflow allowlist directory**
  is known. This is **not necessarily** the ComfyUI UI workflows folder.
  Never guess this location; read the local MCP server configuration.

## One-time export on the user's Windows PC

Run from the Crownless repository root using the local TheRock Python that
already successfully ran the POC. Use a *new* study folder; do not claim this
procedurally reconstructed guide is the previously approved walking dummy.

```powershell
$python = 'I:\02_AI\ComfyUI-Crownless\therock-gfx1030-test\Scripts\python.exe'
$comfy = 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable\ComfyUI'
$study = 'I:\02_AI\ComfyUI-Crownless\mcp-contact-study'
$allowlist = 'REPLACE_WITH_THE_EXISTING_COMFYUI_LOCAL_MCP_WORKFLOWS_DIRECTORY'

& $python scripts/adventurer-a-walk/pose_study_ik.py $study docs/assets/adventurer-a-approved-anchor-v1.png
& $python scripts/adventurer-a-walk/export_mcp_workflows.py `
  --study $study `
  --anchor docs/assets/adventurer-a-approved-anchor-v1.png `
  --comfy $comfy `
  --workflow-dir $allowlist
```

If the study directory already exists, choose a new empty path.
The exporter verifies the anchor, pixel checkpoint, ControlNet, IP-Adapter and
CLIP-Vision file hashes and verifies the prepared reference image against the
approved identity anchor. It copies only four required images into
`ComfyUI/input/crownless-mcp-adventurer-a-v1/`. It writes two API-format JSON
files into the **owner-provisioned** MCP allowlist. It refuses to overwrite
files whose contents differ. No models, approved images or game runtime
assets are changed.

## ChatGPT MCP execution after provision

1. Call `list_workflows`; expect **`adventurer-a-near-contact`** and
   **`adventurer-a-far-contact`** in addition to `smoke`.
2. Check `queue_status`. Run the near-contact workflow once, then
   `get_result(prompt_id)` and `get_image(prompt_id, 0)`.
3. Review the first image before running the far-contact workflow. Repeat
   `get_result` / `get_image`; compare same-character identity and boot
   grounding / leg reversal. Do not fire multiple jobs blindly on timeout.
4. Both results stay **unapproved candidates**. Do not promote to Canon,
   rewrite approved inputs, or integrate in Crownless without human review.

These graphs use the existing `run_poc.workflow` builder with the approved
anchor as img2img source, IP-Adapter, the verified pixel checkpoint, OpenPose,
and the already-tested feathered lower-body mask. The near/far prompt describes
opposite grounded contacts. This is a controlled A/B pilot, **not** evidence
that either image will anatomically comply or produce a usable walking loop.

## Verification

Run `python -m unittest discover -s test -p 'test_adventurer_walk_mcp_export.py'`
in the repository environment with Pillow. Unit tests verify the graph
inputs and protective non-overwrite behavior. They do **not** establish
model runtime compatibility or visual quality. The actual Windows-generated
images and separate human review remain essential.
