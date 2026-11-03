---
name: crownless-visual-design
description: Create or review Crownless visuals for a readable Western medieval fantasy × Japanese sumi-e on washi game experience.
---

# Crownless Visual Design

Use this Skill when creating or reviewing Crownless visuals.

## Goal

Create a coherent medieval fantasy world in the approved sumi-e/washi visual language that works clearly on a smartphone.

Prioritize:

- readability during play,
- clear distinction between enemies, loot, locations, and actions,
- atmosphere that supports danger, discovery, and reward,
- consistency across generated assets.

Do not preserve old Crownless art styles unless they improve the current game.

Generate only the assets needed for the current playable slice. Evaluate visuals inside the actual game, not in isolation.

If the visual direction is undefined, establish the smallest useful direction and let real play decide what survives.

## Current source and image QA

Read AGENTS.md, current docs/visual-canon.md and specialized visual Canon, then use docs/visual/asset-quality-gate.md for new/changed important PNG/JPEG assets. Newer map guidance overrides older map prescriptions; approved actor identity anchors remain binding. No automatic Canon promotion.

## Adventurer A walk-cycle workflow

Use this workflow when **creating or revising the 8-frame Adventurer A walk**. For detailed findings and acceptance criteria, see `docs/visual/adventurer-a-eight-frame-walk-research.md`. Keep the Approved Visual Anchor `docs/assets/adventurer-a-approved-anchor-v1.png` and `docs/visual/CHARACTER_VISUAL_CANON.md` authoritative for character identity, camera and appearance.

**Do not generate eight finished character illustrations first and assume they form a valid walk.** Advance in order; when a gate fails, correct that stage instead of generating another costume sheet.

1. **Contact A/B motion keys (gate 1).** Establish opposing near-/far-leg contact poses with a short natural stride, equal leg lengths, fixed right-facing oblique three-quarter camera, common ground line and stable foot pivot. Record hip/knee/ankle/shoulder/elbow/wrist positions. Frame 1 vs frame 5 must visibly exchange leading/supporting legs and opposing arms. Review these *two* poses before creating in-betweens.
2. **Eight-pose simplified motion base (gate 2).** Build `Contact A → Down A → Passing A → Up A → Contact B → Down B → Passing B → Up B`. Both sides must show proper weight transfer and alternating foot lift. Keep grounded feet planted in world space while supporting weight; for in-place sprite review, their apparent travel must match root motion. Down is lower, Up is higher; no teleporting knee/foot, drifting baseline, or discontinuity at 4→5 or 8→1. Swing the arms opposite the legs through shoulders and elbows, without leaving the right fist forward for most of the loop. Inspect the uncostumed 8-frame animation before proceeding.
3. **Independently drawn character cels (gate 3).** After the motion is judged plausible, draw all eight poses using the approved Adventurer A identity: charcoal hair with a silver forelock and short stubble, navy split coat, ivory rolled sleeves, belts/pouches, worn brown boots and back-sheathed sword. Preserve the same camera, proportions, scale, origin and clothing identity. Do not puppet-translate a static illustration or recycle a rejected sprite as artwork. Layer near/far limbs and split coat correctly. Shade the **far side darker** and the **near side brighter** under a consistent light direction, without changing the depth order as limbs cross.

**Source-truth boundary:** `CHARACTER_VISUAL_CANON.md` records user acceptance of an older color-coded eight-pose dummy's *gait and timing only*, not its costume rendering. Its original image has **not been located** in the currently inspected repository. `scripts/adventurer-a-walk/pose_study.py` and `pose_study_ik.py` explicitly describe their replacement guides as *unapproved approximations*. Do not claim to have recovered or used the original approved dummy. The previously rejected rigid `adventurer-a-handcluster-v1` puppet is not a valid appearance source.

**Review gates are independent:**

- *Technical*: use the existing `docs/visual/adventurer-a-walk-review.html` and `scripts/adventurer-a-walk/pixel-atlas-review.js` workflow. Current native target: 128×192 per cel, eight temporal frames, at most 64 colors, binary alpha, no blank/identical cels. Verify Pixelorama editable source, transparent atlas and GIF decode/loop integrity.
- *Motion and art*: inspect near/far contact reversal, stable foot contact and bone lengths, sensible Down/Up, genuine leg–arm counter-swing, all transitions including 8→1, coherent sword/coat/face, visible near/far shading, and actual phone-scale legibility. Technical pass **never** implies visual acceptance.
- *Initial review setting*: eight equally timed frames at 8 fps, compact walking stride. Treat this as a review default, not permanent Canon; adjust timing only after pose mechanics pass.

Keep all outputs as review candidates until explicit human approval. Never auto-replace Canon, game/runtime assets, or merge/deploy based solely on passing checks. For ChatGPT presentation, follow the existing GIF-only handoff section below; do not duplicate its rules here.

## ChatGPT animation GIF preview (ChatGPT handoff)

Apply this when the user asks to **show, preview, check, or revise animation** in ChatGPT. **GIF is the only delivery format unless the user explicitly requests another format.** Do not create MP4, extra previews, or download bundles as a workaround for a display issue.

1. **Create or reuse the intended GIF.** When a GIF is already available and correct, reuse it; do not regenerate artwork or re-export without a reason. If exporting from individual cels, use intentional per-frame durations, preserve aspect ratio, and set infinite loop (`loop=0`).
2. **Check the exact artifact** in the active container session, not just the sprite sheet. Verify that the path exists, the file is nonempty, Pillow decodes it as GIF, `n_frames >= 2`, and frames can all be loaded. Confirm the desired frame ordering and timing where possible. Fail closed and fix/export the GIF before sharing if any check fails.
3. **Embed the checked GIF in the user-visible answer**, using its **exact verified** sandbox path:
   `![冒険者A・歩行アニメーション](sandbox:/mnt/data/<actual-output-path>/walk_preview.gif)`
   Follow it with a single fallback link pointing to that **same** file:
   `[GIFを開く](sandbox:/mnt/data/<actual-output-path>/walk_preview.gif)`
   Paths in this Skill are placeholders, not evidence that a particular file exists. **Never send only** `/mnt/data/...`, never invent a sandbox URL, and never claim that writing a file path embeds an image.
4. If inline playback does not appear in the user's client, **do not claim that the app rendered it**, and do not claim an MP4 fixes GIF delivery. Re-verify the GIF and its link, then ask for the exact client behavior only if troubleshooting remains necessary. Provide other media **only if the user asks**.
5. Keep delivery validation distinct from animation acceptance: a technically sound looping GIF does not prove natural motion, contact, identity consistency, native pixel quality, or successful playback in a particular app.

Minimal local GIF integrity check (requires Pillow):

```bash
python -c 'from pathlib import Path; from PIL import Image; p=Path("/mnt/data/ACTUAL/walk_preview.gif"); assert p.is_file() and p.stat().st_size>0, p; im=Image.open(p); assert im.format=="GIF" and getattr(im,"n_frames",1)>1; [im.seek(i) or im.convert("RGBA").load() for i in range(im.n_frames)]; print("GIF OK:",im.n_frames,"frames",im.size,"loop",im.info.get("loop"))'
```

Replace `/mnt/data/ACTUAL/walk_preview.gif` with the path actually produced and verified in the **current** session. Do not treat the command's success as confirmation of ChatGPT app-side playback.
