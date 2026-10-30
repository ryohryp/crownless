# Adventurer A — two-contact v2 (review-only experiment)

The first ChatGPT ComfyUI Local MCP near/far jobs both ran successfully but did not pass motion review: near remained mostly standing and far exaggerated a lunge and exposed the knee. Retain the approved Adventurer A identity anchor unchanged. Do not ship any generated candidate.

## Changes

- Two opposite contact guides at x=230 and x=282, both feet at y=400 (52px separation instead of nearly 100px). Fixed 62px leg segments in the guide.
- Narrower feathered lower-body mask: (175,304,361,438), Gaussian radius 7, preserving most upper garments.
- Masked denoise 0.65, OpenPose strength 1.25 with end 0.95. Prompts explicitly prohibit exposed knees, oversized lunges and leftward boots.
- Keep the original near/far workflows unchanged. The two new allowed names are adventurer-a-near-contact-v2 and adventurer-a-far-contact-v2.

## On the Windows owner PC

Use the existing checkout of the `feat/adventurer-a-comfy-poc` branch with `contact_v2.py`, `register_contact_v2.ps1` and the approved anchor. **Recommended:** From the repository root, run the helper below in Windows PowerShell. It displays a file picker for the *existing* `adventurer-a-near-contact.json` (already registered through MCP), validates the paired v1 JSONs, and registers v2 using the known, previously tested TheRock/ComfyUI paths. It never modifies v1 and does not run any ComfyUI jobs:

    powershell -NoProfile -STA -ExecutionPolicy Bypass -File scripts/adventurer-a-walk/register_contact_v2.ps1

If the file picker is unavailable or those paths have moved, pass `-McpWorkflowDir 'YOUR_EXISTING_MCP_ALLOWLIST_FOLDER'` or use the manual command below. This is a local script that has **not** been tested on the user's actual Windows PC; inspect it before running.

Manual alternative (from Crownless root):

    $python = 'I:\02_AI\ComfyUI-Crownless\therock-gfx1030-test\Scripts\python.exe'
    $comfy = 'I:\02_AI\ComfyUI-Crownless\ComfyUI_windows_portable\ComfyUI'
    $allowlist = 'REPLACE_WITH_YOUR_COMFYUI_LOCAL_WORKFLOW_ALLOWLIST_FOLDER'
    & $python scripts/adventurer-a-walk/contact_v2.py --study 'I:\02_AI\ComfyUI-Crownless\contact-v2-study' --anchor 'docs/assets/adventurer-a-approved-anchor-v1.png' --comfy $comfy --workflow-dir $allowlist

Use a previously unused study path. The script validates the pinned approved anchor and model hashes, refuses existing v2 workflow and input paths, creates a separate staged input set and registers two API-format JSONs. It does not submit a job or change existing v1 workflows.

After installation, list ComfyUI Local workflows in ChatGPT, run near-v2 once and retrieve its image; only if satisfactory run far-v2. Check grounded boots, true opposite near/far contact, toe direction, covered knees and consistent costume. If either fails, stop; do not blindly expand to eight frames.

## Tests

    python -m unittest discover -s test -p 'test_adventurer_contact_v2.py'

Checks authored geometry and graph inputs only. Model compliance, running GPU outputs, temporal motion and phone-scale appearance remain unverified until the user-PC jobs are executed and inspected.
