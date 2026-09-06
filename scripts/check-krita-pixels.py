#!/usr/bin/env python3
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "qa-output/krita-504/krita-run-report.json"

report = json.loads(REPORT.read_text(encoding="utf-8"))
base_path = ROOT / report["baseSnapshot"]
runtime_path = ROOT / report["runtimeExport"]

base = Image.open(base_path).convert("RGBA")
runtime = Image.open(runtime_path).convert("RGBA")
if base.size != runtime.size:
    raise SystemExit(f"pixel QA failed: size changed {base.size} -> {runtime.size}")

diff = ImageChops.difference(base, runtime)
bbox = diff.getbbox()
if bbox is None:
    raise SystemExit("pixel QA failed: runtime pixels are identical to the frozen base")

start_y = int(report.get("correction", {}).get("startY", 0))
left, top, right, bottom = bbox
if top < max(0, start_y - 2):
    raise SystemExit(
        f"pixel QA failed: correction escaped expected foreground band: bbox={bbox}, startY={start_y}"
    )

stats = ImageStat.Stat(diff)
mean_abs = sum(stats.mean[:3]) / 3.0
changed = 0
for pixel in diff.getdata():
    if pixel[0] or pixel[1] or pixel[2] or pixel[3]:
        changed += 1
changed_ratio = changed / (base.width * base.height)

# The phase-1 wash is intentionally restrained, but it must be materially
# visible after Krita reopens/exports the KRA rather than merely changing PNG
# encoding metadata. Keep the bounds broad enough for later visual tuning.
if changed_ratio < 0.01:
    raise SystemExit(f"pixel QA failed: only {changed_ratio:.3%} of pixels changed")
if mean_abs < 0.05:
    raise SystemExit(f"pixel QA failed: mean absolute RGB delta is only {mean_abs:.4f}")
if mean_abs > 18:
    raise SystemExit(f"pixel QA failed: correction is unexpectedly destructive ({mean_abs:.2f})")

result = {
    "ok": True,
    "base": str(base_path.relative_to(ROOT)),
    "runtime": str(runtime_path.relative_to(ROOT)),
    "size": list(base.size),
    "changedBoundingBox": list(bbox),
    "changedPixelRatio": changed_ratio,
    "meanAbsoluteRgbDelta": mean_abs,
}
out = ROOT / "qa-output/krita-504/pixel-qa-report.json"
out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(
    "Krita pixel QA OK: "
    f"bbox={bbox}, changed={changed_ratio:.2%}, mean RGB delta={mean_abs:.3f}"
)
