# Forest HD-2D candidate v0.2 — review only

**Status:** unapproved generated backdrop for the existing `gemini-feel-lab.html` action expedition. Do not treat this as Visual Canon, approved Pixelorama source art, or a character animation set.

- **Image:** [`forest-hd2d-v0.2.png`](forest-hd2d-v0.2.png), 1672 × 940 RGB PNG, generated with the built-in ChatGPT/Codex image-generation tool; no additional image API or PixelLab subscription.
- **Generation parent:** text-only Crownless Visual Director `prepare_non_character_generation` package for project `crownless`, asset `background`. No previous generated candidate, outdated board, or actor source used as an image parent.
- **Prompt intent:** original 16:9 side-on forest clearing with a traversable lower-half floor and a distant medieval stone ruin; Western medieval fantasy × sumi-e/washi in crisp, muted, limited-palette pixel clusters with atmospheric depth. No actors, labels, UI, real-world routes or magical spectacle. See `docs/visual-canon.md` and `docs/visual/GLOBAL_VISUAL_STYLE.md` for the current constraints.
- **Experimental integration:** open `/gemini-feel-lab.html?art=hd2d` and toggle **景観: 試作 / 従来**. The normal route without `art=hd2d` loads neither the candidate image nor its rendering path.
- **Conserved:** world camera and coordinates, bridge platform geometry, player/enemy/item drawing, forest discovery spots, gestures, combat rules and save behavior.
- **Limitations:** the background is a **single raster image**, not editable native pixel layers/frames, a seamless terrain tile set, or a true parallax scene. The generated image has finer details than a strict 320×180 tile-grid sprite. The existing procedural actors are not visually matched. Review at 360/390/430 CSS px before any adoption.
- **Evaluation status:** targeted Node tests and HTTP asset route verified. This execution environment had no Playwright Chromium, and the attempted browser download failed, so real mobile screenshots/touch acceptance and Jev Vision are pending. The generated image is a candidate, not accepted art.

## Next check

1. Compare the opt-in scene against the unchanged route on an actual phone, including tap-to-investigate and swipe combat while following the camera.
2. Check foreground/background collision visual alignment (especially the bridge), actor silhouette contrast, background readability, loading time, and 360/390/430px frames.
3. If the candidate helps, use a local Pixelorama project and an audited Pixelorama MCP adapter to author a proper sprite/tile source and layers. Do not migrate the whole engine or install a paid generation service until the bottleneck is demonstrated.
