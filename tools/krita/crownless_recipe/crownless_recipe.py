import json
import os
import traceback
from pathlib import Path

from krita import Extension, Krita


def _marker(env_name, text):
    value = os.environ.get(env_name, "")
    if not value:
        return
    path = Path(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text + "\n", encoding="utf-8")


def _resolve(repo_root, value):
    path = Path(value)
    if not path.is_absolute():
        path = repo_root / path
    return path.resolve()


def _write_report(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _stage(name):
    _marker("CROWNLESS_KRITA_STAGE_MARKER", name)


def run_recipe():
    recipe_env = os.environ.get("CROWNLESS_KRITA_RECIPE", "")
    repo_env = os.environ.get("CROWNLESS_REPO_ROOT", "")
    report_path = None
    report = {"ok": False, "phase": "editing", "operations": [], "launchReason": "plugin-import"}

    try:
        _stage("autorun-entered")
        if not recipe_env or not repo_env:
            raise RuntimeError("CROWNLESS_KRITA_RECIPE and CROWNLESS_REPO_ROOT are required")

        repo_root = Path(repo_env).resolve()
        recipe_path = Path(recipe_env).resolve()
        recipe = json.loads(recipe_path.read_text(encoding="utf-8"))

        base_path = _resolve(repo_root, recipe["baseSnapshot"])
        editable_path = _resolve(repo_root, recipe["editableSource"])
        export_path = _resolve(repo_root, recipe["runtimeExport"])
        report_path = _resolve(repo_root, recipe["report"])

        if not base_path.is_file():
            raise RuntimeError(f"required input is missing: {base_path}")
        editable_path.parent.mkdir(parents=True, exist_ok=True)
        export_path.parent.mkdir(parents=True, exist_ok=True)

        app = Krita.instance()
        app.setBatchmode(True)
        _stage("before-open-document")

        # Reuse the startup document if Krita has already opened it; otherwise
        # open the immutable snapshot explicitly. Import-time autorun is gated by
        # CROWNLESS_KRITA_AUTORUN, so interactive Krita sessions never execute it.
        doc = None
        for candidate in app.documents():
            try:
                filename = candidate.fileName()
                if filename and Path(filename).resolve() == base_path:
                    doc = candidate
                    break
            except Exception:
                continue
        if doc is None:
            doc = app.openDocument(str(base_path))
        if doc is None:
            raise RuntimeError(f"Krita could not open {base_path}")
        app.setActiveDocument(doc)
        _stage("after-open-document")
        report["operations"].append("open-document")

        width = int(doc.width())
        height = int(doc.height())
        if width <= 0 or height <= 0:
            raise RuntimeError("opened document has invalid dimensions")

        root = doc.rootNode()
        children = root.childNodes()
        if not children:
            raise RuntimeError("opened bitmap has no base layer")
        base_layer = children[0]
        base_layer.setName("generated-base")
        base_layer.setLocked(True)
        report["operations"].append("select-and-lock-base-layer")

        imported = doc.createFileLayer("generated-base-reference", str(base_path), "None", "Bicubic")
        if imported is None or not root.addChildNode(imported, base_layer):
            raise RuntimeError("could not import base image as a file layer")
        imported.setVisible(False)
        imported.setOpacity(255)
        report["operations"].append("import-image-as-layer")
        report["operations"].append("set-layer-visibility-opacity")

        correction = recipe.get("correction", {})
        start_ratio = float(correction.get("startYRatio", 0.76))
        height_ratio = float(correction.get("heightRatio", 0.24))
        layer_opacity = max(0, min(255, int(correction.get("opacity", 72))))
        fill = str(correction.get("fill", "#d5c6a4"))
        fill_opacity = max(0.0, min(1.0, float(correction.get("fillOpacity", 0.42))))
        start_y = max(0, min(height - 1, round(height * start_ratio)))
        band_height = max(1, min(height - start_y, round(height * height_ratio)))

        overlay = doc.createVectorLayer(str(correction.get("name", "foreground-calm-wash")))
        if overlay is None or not root.addChildNode(overlay, imported):
            raise RuntimeError("could not create correction vector layer")

        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{band_height}" viewBox="0 0 {width} {band_height}">
  <defs>
    <linearGradient id="calm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{fill}" stop-opacity="0"/>
      <stop offset="0.38" stop-color="{fill}" stop-opacity="{fill_opacity * 0.45:.4f}"/>
      <stop offset="1" stop-color="{fill}" stop-opacity="{fill_opacity:.4f}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="{width}" height="{band_height}" fill="url(#calm)"/>
</svg>'''
        shapes = overlay.addShapesFromSvg(svg)
        if not shapes:
            raise RuntimeError("Krita did not create the correction shape")
        overlay.setOpacity(layer_opacity)
        overlay.setVisible(False)
        overlay.setVisible(True)
        overlay.move(0, start_y)
        report["operations"].append("create-correction-layer")
        report["operations"].append("transform-layer")
        report["operations"].append("local-correction")
        _stage("after-local-correction")

        doc.refreshProjection()
        if hasattr(doc, "waitForDone"):
            doc.waitForDone()

        _stage("before-save")
        if not doc.saveAs(str(editable_path)):
            raise RuntimeError(f"Krita failed to save editable source: {editable_path}")
        report["operations"].append("save-editable-source")

        # Export is deliberately performed by a fresh Krita CLI process in the
        # shell runner. Krita 5.2 can block exportImage() while Python plugins are
        # still being imported, whereas its documented KRA -> PNG CLI exporter
        # runs after normal application initialization and exits deterministically.
        report.update({
            "ok": True,
            "phase": "editable-saved",
            "kritaVersion": app.version(),
            "width": width,
            "height": height,
            "baseSnapshot": str(base_path.relative_to(repo_root)),
            "editableSource": str(editable_path.relative_to(repo_root)),
            "runtimeExport": str(export_path.relative_to(repo_root)),
            "correction": {
                "startY": start_y,
                "height": band_height,
                "layerOpacity": layer_opacity,
                "fill": fill,
                "fillOpacity": fill_opacity,
            },
        })
        _write_report(report_path, report)
        _stage("editable-saved")
    except Exception as exc:
        report["error"] = str(exc)
        report["traceback"] = traceback.format_exc()
        if report_path is None:
            fallback_root = Path(repo_env).resolve() if repo_env else Path.cwd()
            report_path = fallback_root / "qa-output/krita-504/krita-run-report.json"
        _write_report(report_path, report)
        _stage("failed")


class CrownlessRecipeExtension(Extension):
    """Interactive no-op shell so the resource remains a normal Krita plugin."""

    def setup(self):
        return

    def createActions(self, window):
        return


_marker("CROWNLESS_KRITA_IMPORT_MARKER", "loaded")
if os.environ.get("CROWNLESS_KRITA_AUTORUN") == "1":
    run_recipe()
