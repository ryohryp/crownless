import json
import os
import traceback
from pathlib import Path

from krita import Extension, Krita
from PyQt5.QtCore import QByteArray, QObject, QRect, Qt, QTimer, pyqtSignal, pyqtSlot
from PyQt5.QtWidgets import QApplication


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


def _parse_rgb(value):
    text = value.strip().lstrip("#")
    if len(text) != 6:
        raise ValueError(f"fill must be #RRGGBB, got {value!r}")
    return tuple(int(text[index:index + 2], 16) for index in (0, 2, 4))


def _calm_wash_channels(width, height, fill, fill_opacity):
    red, green, blue = _parse_rgb(fill)
    alpha_rows = []
    for y in range(height):
        t = 1.0 if height <= 1 else y / (height - 1)
        if t <= 0.38:
            strength = 0.45 * (t / 0.38)
        else:
            strength = 0.45 + 0.55 * ((t - 0.38) / 0.62)
        alpha_rows.append(max(0, min(255, round(255 * fill_opacity * strength))))
    pixel_count = width * height
    return {
        "blue": bytes((blue,)) * pixel_count,
        "green": bytes((green,)) * pixel_count,
        "red": bytes((red,)) * pixel_count,
        "alpha": b"".join(bytes((alpha,)) * width for alpha in alpha_rows),
    }


def _write_rgba_u8_channels(node, width, height, fill, fill_opacity):
    if node.colorModel() != "RGBA" or node.colorDepth() != "U8":
        raise RuntimeError(
            f"correction paint layer must be RGBA/U8, got {node.colorModel()}/{node.colorDepth()}"
        )

    channels = list(node.channels())
    diagnostics = [
        {"name": channel.name(), "position": int(channel.position()), "size": int(channel.channelSize())}
        for channel in channels
    ]
    if len(channels) != 4 or any(item["size"] != 1 for item in diagnostics):
        raise RuntimeError(f"unexpected RGBA/U8 channel layout: {diagnostics}")

    values = _calm_wash_channels(width, height, fill, fill_opacity)
    fallback_by_position = {0: "blue", 1: "green", 2: "red", 3: "alpha"}
    rect = QRect(0, 0, width, height)
    written = []
    for channel in channels:
        lower_name = str(channel.name()).lower()
        key = next((candidate for candidate in values if candidate in lower_name), None)
        if key is None:
            key = fallback_by_position.get(int(channel.position()))
        if key is None:
            raise RuntimeError(f"cannot map Krita channel {channel.name()!r} at position {channel.position()}")
        payload = QByteArray.fromRawData(values[key])
        if payload.size() != width * height:
            raise RuntimeError(f"invalid {key} channel payload size: {payload.size()}")
        channel.setPixelData(payload, rect)
        written.append(key)

    readback = node.pixelData(0, 0, width, height)
    expected_size = width * height * 4
    if readback.size() != expected_size:
        raise RuntimeError(
            f"correction pixel readback size mismatch: {readback.size()} != {expected_size}; channels={diagnostics}"
        )
    if not any(bytearray(readback)):
        raise RuntimeError(f"correction pixel readback is empty; channels={diagnostics}")
    return diagnostics, written


def run_recipe():
    recipe_env = os.environ.get("CROWNLESS_KRITA_RECIPE", "")
    repo_env = os.environ.get("CROWNLESS_REPO_ROOT", "")
    report_path = None
    report = {"ok": False, "phase": "editing", "operations": [], "launchReason": "qt-main-thread"}

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

        overlay = doc.createNode(str(correction.get("name", "foreground-calm-wash")), "paintlayer")
        # childNodes() is bottom-up. Explicitly place the correction above the
        # opaque generated base so its persisted paint pixels participate in the
        # merged projection instead of being completely hidden underneath it.
        if overlay is None or not root.addChildNode(overlay, base_layer):
            raise RuntimeError("could not create correction paint layer above base")
        doc.setActiveNode(overlay)
        channel_layout, written_channels = _write_rgba_u8_channels(
            overlay, width, band_height, fill, fill_opacity
        )
        overlay.setOpacity(layer_opacity)
        overlay.setVisible(False)
        overlay.setVisible(True)
        overlay.move(0, start_y)
        report["operations"].append("create-correction-layer")
        report["operations"].append("write-correction-pixels")
        report["operations"].append("verify-correction-readback")
        report["operations"].append("transform-layer")
        report["operations"].append("local-correction")
        _stage("after-local-correction")

        doc.refreshProjection()
        QApplication.processEvents()
        if hasattr(doc, "waitForDone"):
            doc.waitForDone()
        QApplication.processEvents()

        layer_order = [node.name() for node in root.childNodes()]
        if layer_order.index(overlay.name()) <= layer_order.index(base_layer.name()):
            raise RuntimeError(f"correction layer is not above base: {layer_order}")

        _stage("before-save")
        if not doc.saveAs(str(editable_path)):
            raise RuntimeError(f"Krita failed to save editable source: {editable_path}")
        report["operations"].append("save-editable-source")

        report.update({
            "ok": True,
            "phase": "editable-saved",
            "kritaVersion": app.version(),
            "width": width,
            "height": height,
            "baseSnapshot": str(base_path.relative_to(repo_root)),
            "editableSource": str(editable_path.relative_to(repo_root)),
            "runtimeExport": str(export_path.relative_to(repo_root)),
            "layerOrderBottomUp": layer_order,
            "correction": {
                "mode": "paintlayer-channel-pixels",
                "startY": start_y,
                "height": band_height,
                "layerOpacity": layer_opacity,
                "fill": fill,
                "fillOpacity": fill_opacity,
                "colorModel": overlay.colorModel(),
                "colorDepth": overlay.colorDepth(),
                "channelLayout": channel_layout,
                "writtenChannels": written_channels,
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
    def setup(self):
        return

    def createActions(self, window):
        return


class _QueuedAutorun(QObject):
    requested = pyqtSignal()

    def __init__(self):
        super().__init__()
        application = QApplication.instance()
        if application is None:
            raise RuntimeError("Krita QApplication is not available")
        self.moveToThread(application.thread())
        self.requested.connect(self._schedule, Qt.QueuedConnection)

    @pyqtSlot()
    def _schedule(self):
        _stage("gui-thread-ready")
        QTimer.singleShot(250, run_recipe)


_marker("CROWNLESS_KRITA_IMPORT_MARKER", "loaded")
_AUTORUN = None
if os.environ.get("CROWNLESS_KRITA_AUTORUN") == "1":
    _AUTORUN = _QueuedAutorun()
    _AUTORUN.requested.emit()
