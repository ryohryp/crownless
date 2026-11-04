# Adventurer A: 3D reference controls → ComfyUI Local MCP

Status: **registration helper ready, Windows-side install and new GPU run not yet verified**. This is a strictly review-only continuation of the real 3D reference pair. Do not replace the approved Adventurer A anchor or game assets.

## What changed

The previous 3D POC produced genuine fixed-camera GLB reference poses A (near leg forward) and B (far leg forward), a comparison image and 512×512 OpenPose hints. The approved image identity remains `docs/assets/adventurer-a-approved-anchor-v1.png`.

The new `scripts/adventurer-a-walk/register_3d_contact_mcp.py` uses **those exact existing OpenPose images**, checks their decoded pixel SHA-256, checks the approved anchor and pinned pixel checkpoint, OpenPose, IP-Adapter and CLIP-Vision model hashes, and stages a fresh input subdirectory. It reuses the proven `run_poc.workflow()` graph builder and the prior lower-leg inpainting mask. It registers two new uniquely named workflows:

- `adventurer-a-3d-contact-a`
- `adventurer-a-3d-contact-b`

No extra FLUX/Klein model download, new 3D dependencies, new GPU setup or paid service is required **for this registration**. Existing v1/v2 workflows are untouched.

## One-time Windows-side action (from the PR checkout)

1. Download the already generated `crownless_adventurer_a_3d_contact_poc.zip` from the ChatGPT conversation, **extract** it on the owner Windows PC. The required files inside `exports/` are `pose-a-openpose.png` and `pose-b-openpose.png`. This is the same earlier POC, not regenerated artwork.
2. Ensure that the current `feat/adventurer-a-comfy-poc` branch contains `register_3d_contact_mcp.py` and `register_3d_contact_mcp.ps1`. Preserve unrelated working-tree modifications.
3. From the **repository root**, run:

```powershell
powershell -NoProfile -STA -ExecutionPolicy Bypass -File scripts/adventurer-a-walk/register_3d_contact_mcp.ps1
```

The Windows helper asks the owner to select the existing `adventurer-a-near-contact.json` **from the actual ComfyUI Local MCP allowlist folder**, then `pose-a-openpose.png` from the previously extracted ZIP. Alternatively supply `-McpWorkflowDir` and `-PoseGuideDir` explicitly. The Windows helper verifies that the selected MCP folder contains the existing approved-anchor v1 workflow entries. The Python exporter refuses mismatched inputs and conflicts before it writes anything.

This operation **only registers workflows** and does not queue a job. If the MCP server needs to reload the allowlist, follow its local operator instructions without enabling any public ComfyUI listener; the observed `127.0.0.1:8188` must stay loopback-only.

## Next ChatGPT phase: run a single bounded comparison

1. `list_workflows` must include `adventurer-a-3d-contact-a`. If missing, STOP and inspect the Windows registration result. Do not re-run v1/v2.
2. `queue_status`, then `run_workflow('adventurer-a-3d-contact-a')` once, `get_result(prompt_id)`, and `get_image(prompt_id,0)`.
3. Inspect the **actual** image: camera-facing direction, same Adventurer A identity, near leg forward, level planted boot soles, rightward toes, stable coat and knee coverings.
4. Run B only if A has a credible appearance/step. Compare both with the approved anchor and the 3D references. A different knee shape alone is not an alternating walk.
5. Record each job ID, status, image and visual verdict in Draft PR #1060. Reject poor outputs and keep gameplay assets untouched.

### Validation boundary

Automated tests cover graph wiring, distinct controls and safe allowlist writes. They do not measure whether the existing SD1.5 OpenPose model actually understands leg depth or obeys the 3D reference; it still receives **projected 2D pose hints**. This is a bounded test of whether the 3D-authored control improves on v1/v2, **not** a guarantee of successful walking motion. If leg reversal still fails, try a depth-rendering/control channel rather than repeatedly tuning the same OpenPose graph.

CI and Windows GPU runtime must be reported separately. A green test is not proof of playable animation.
