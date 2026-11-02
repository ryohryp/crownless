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
