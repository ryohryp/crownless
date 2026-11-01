# Pixel-art candidate export and verification (pilot)

Status: opt-in local workflow. No new paid service, no generator replacement, no automatic asset adoption.

## Roles

1. Visual Director resolves the approved identity Anchor and current Canon into a Generation Package. A different character's global reference must not become the subject's identity parent.
2. The existing local ComfyUI experiment can produce candidate poses; it is not an approved walk animation. Continue the existing Adventurer A v2 contact experiment in draft PR #1060 instead of repeating rejected v1 poses.
3. [Pixelorama](https://pixelorama.org/) is a free/open-source pixel editor, **not** an AI generator. Use it to revise individual pixels, manage frames, and export a native-resolution transparent PNG sprite sheet. Keep the editable `.pxo` source separately.
4. The existing `asset:quality` review performs deterministic image checks, then optional advisory Jev/phone checks. Human visual/motion review is still required before registration.

## Optional Pixelorama CLI export

Install the desktop Pixelorama executable on the creator's PC. On Windows, set `PIXELORAMA_BIN` to its installed executable path in that terminal (do not store a personal path in Git). For example in PowerShell:

```powershell
$env:PIXELORAMA_BIN = 'C:\path\to\Pixelorama.exe'
npm run asset:pixelorama -- --project 'art-source/path/to/frame-project.pxo' --output '.qa/candidates/adventurer-a-walk-frame.png'
```

This invokes Pixelorama's documented headless sprite-sheet export at native scale (`--scale 1`), using argument arrays rather than a shell command. Exports are allowed only beneath `.qa/candidates/`, `docs/assets/candidates/`, or `.visual-director/candidates/`, and existing outputs are not overwritten. Production asset paths and Canon are never changed.

**Verified on Linux and Windows with official Pixelorama v1.2.3:** A pixel-only six-frame `.pxo` fixture exported a 384×64 PNG at native scale and a 768×128 PNG at scale 2. Both passed the integer-grid/palette/alpha preflight. The Windows check uses the public repository's free standard GitHub-hosted Windows runner: [successful Windows E2E](https://github.com/ryohryp/crownless/actions/runs/41281614227). The test fixture was derived from the project's public CC-BY-4.0 example by removing shader-based layer effects; it is not an approved Crownless character. Pixelorama v1.2.3 has a CLI bug where `--output` may ignore the requested basename and export under the project's saved filename. The adapter uses an isolated staging directory, verifies exactly one PNG was produced, then copies it to the requested candidate path without overwrite. A headless export of the unmodified shader-effect example failed; do not assume effects render in headless mode. **The owner's particular Windows PC and a real Adventurer A `.pxo` have not been tested.**

CLI reference: https://pixelorama.org/user_manual/cli/

## Pixel-art preflight in asset:quality

For an unapproved candidate, add the optional `pixelArt` field to its existing quality manifest:

```json
{
  "pixelArt": {
    "nativeSize": [128, 192],
    "maxColors": 256,
    "alphaMode": "binary"
  }
}
```

The snippet is only the additional field, **not** a complete manifest. Choose `nativeSize` and a realistic `maxColors` for the specific game asset; do not assume the current approved reference already satisfies a new palette limit. `alphaMode` can be `binary` for hard pixel edges or `any` for artwork deliberately using partial transparency.

The deterministic gate rejects:

- a canvas that is not the native size or a matching integer multiple on both axes;
- upscale blocks whose pixels vary inside a supposed nearest-neighbor cell (blur/interpolation/grid misalignment);
- too many visible RGBA colors when `maxColors` is configured;
- partially transparent pixels when `alphaMode` is `binary`.

Invoke the existing workflow:

```bash
npm run asset:quality -- --manifest docs/visual/quality-gate-<candidate>.json --stage asset
```

Passing these checks **does not prove** appealing pixel clusters, correct gait, fixed foot pivot, costume identity, temporal continuity, or phone-scale readability. Check those manually in actual play; keep all outputs as Candidates until explicit approval. An AI image merely downscaled or palette-quantized after generation is not automatically authentic pixel art.

## Current integration boundary

- No PixelLab account, API, or new subscription is required.
- No Aseprite purchase or engine migration is required.
- Do not promote Candidate files or alter the Approved Anchor automatically.
- The v2 Adventurer A ComfyUI workflows in PR #1060 still need local owner-PC registration and human review. This pilot does not claim they have passed.
- After one successful real Pixelorama export and in-game review, consider lifting the generic deterministic checks into Visual Director Core. Avoid hard-coding Crownless-specific palette or frame sizes into the shared tool.
