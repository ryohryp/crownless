#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-$(pwd)}"
RECIPE="${2:-tools/krita/recipes/ruined-watchtower-phase1.json}"
REPO_ROOT="$(cd "$REPO_ROOT" && pwd)"
if [[ "$RECIPE" != /* ]]; then RECIPE="$REPO_ROOT/$RECIPE"; fi

if ! command -v krita >/dev/null 2>&1; then
  echo "Krita is required for this workflow; refusing to substitute another renderer." >&2
  exit 66
fi
if ! command -v xvfb-run >/dev/null 2>&1; then
  echo "xvfb-run is required for headless Krita." >&2
  exit 66
fi
if ! command -v setsid >/dev/null 2>&1; then
  echo "setsid is required to own the headless Krita process group." >&2
  exit 66
fi

readarray -t PATHS < <(python3 - "$RECIPE" <<'PY'
import json, sys
r = json.load(open(sys.argv[1], encoding="utf-8"))
for key in ("sourceRuntime", "baseSnapshot", "editableSource", "runtimeExport", "report"):
    print(r[key])
PY
)
SOURCE_RUNTIME="$REPO_ROOT/${PATHS[0]}"
BASE_SNAPSHOT="$REPO_ROOT/${PATHS[1]}"
EDITABLE_SOURCE="$REPO_ROOT/${PATHS[2]}"
RUNTIME_EXPORT="$REPO_ROOT/${PATHS[3]}"
REPORT="$REPO_ROOT/${PATHS[4]}"

if [[ ! -f "$SOURCE_RUNTIME" ]]; then
  echo "runtime source is missing: $SOURCE_RUNTIME" >&2
  exit 65
fi
mkdir -p "$(dirname "$BASE_SNAPSHOT")" "$(dirname "$EDITABLE_SOURCE")" "$(dirname "$RUNTIME_EXPORT")" "$(dirname "$REPORT")"
if [[ ! -f "$BASE_SNAPSHOT" ]]; then
  cp "$SOURCE_RUNTIME" "$BASE_SNAPSHOT"
  echo "Captured immutable phase-1 base snapshot: ${PATHS[1]}"
fi

TMP_HOME="$(mktemp -d)"
KRITA_WRAPPER_PID=""
stop_krita_group() {
  if [[ -n "$KRITA_WRAPPER_PID" ]] && kill -0 "$KRITA_WRAPPER_PID" 2>/dev/null; then
    kill -TERM -- "-$KRITA_WRAPPER_PID" 2>/dev/null || true
    for _ in $(seq 1 30); do
      if ! kill -0 "$KRITA_WRAPPER_PID" 2>/dev/null; then
        break
      fi
      sleep 0.1
    done
    if kill -0 "$KRITA_WRAPPER_PID" 2>/dev/null; then
      kill -KILL -- "-$KRITA_WRAPPER_PID" 2>/dev/null || true
    fi
  fi
}
cleanup() {
  stop_krita_group
  rm -rf "$TMP_HOME"
}
trap cleanup EXIT

export HOME="$TMP_HOME"
export XDG_DATA_HOME="$TMP_HOME/.local/share"
export XDG_CONFIG_HOME="$TMP_HOME/.config"
export XDG_CACHE_HOME="$TMP_HOME/.cache"
export TMPDIR="$TMP_HOME/tmp"
mkdir -p "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$TMPDIR"

PLUGIN_ROOT="$XDG_DATA_HOME/krita/pykrita"
mkdir -p "$PLUGIN_ROOT"
cp "$REPO_ROOT/tools/krita/crownless_recipe.desktop" "$PLUGIN_ROOT/"
cp -R "$REPO_ROOT/tools/krita/crownless_recipe" "$PLUGIN_ROOT/"
cat > "$XDG_CONFIG_HOME/kritarc" <<'EOF'
[python]
enable_crownless_recipe=true
EOF

IMPORT_MARKER="$REPO_ROOT/qa-output/krita-504/plugin-imported.txt"
STAGE_MARKER="$REPO_ROOT/qa-output/krita-504/krita-stage.txt"
EDIT_LOG="$REPO_ROOT/qa-output/krita-504/krita-edit.log"
EXPORT_LOG="$REPO_ROOT/qa-output/krita-504/krita-export.log"
EXPORT_TMP="$REPO_ROOT/qa-output/krita-504/runtime-export.tmp.png"
rm -f "$REPORT" "$IMPORT_MARKER" "$STAGE_MARKER" "$EXPORT_TMP"
export CROWNLESS_KRITA_RECIPE="$RECIPE"
export CROWNLESS_REPO_ROOT="$REPO_ROOT"
export CROWNLESS_KRITA_IMPORT_MARKER="$IMPORT_MARKER"
export CROWNLESS_KRITA_STAGE_MARKER="$STAGE_MARKER"
export CROWNLESS_KRITA_AUTORUN=1

# Phase A: real Krita Python API performs document/layer/import/transform/local
# correction and saves the editable KRA. The plugin writes a phase report as soon
# as the source is safely on disk; the shell then owns shutdown.
set +e
setsid timeout 120s xvfb-run -a krita --nosplash -platform xcb "$BASE_SNAPSHOT" >"$EDIT_LOG" 2>&1 &
KRITA_WRAPPER_PID=$!
for _ in $(seq 1 1200); do
  if [[ -f "$REPORT" ]]; then
    break
  fi
  if ! kill -0 "$KRITA_WRAPPER_PID" 2>/dev/null; then
    break
  fi
  sleep 0.1
done
if [[ -f "$REPORT" ]]; then
  stop_krita_group
fi
wait "$KRITA_WRAPPER_PID" 2>/dev/null
KRITA_STATUS=$?
KRITA_WRAPPER_PID=""
set -e

if [[ ! -f "$REPORT" ]]; then
  cat "$EDIT_LOG" >&2 || true
  if [[ -f "$STAGE_MARKER" ]]; then
    echo "Last Krita recipe stage: $(cat "$STAGE_MARKER")" >&2
  fi
  if [[ -f "$IMPORT_MARKER" ]]; then
    echo "Krita imported the Crownless plugin but no recipe report was produced (status $KRITA_STATUS)." >&2
  else
    echo "Krita did not import the Crownless plugin (status $KRITA_STATUS)." >&2
    echo "Plugin root: $PLUGIN_ROOT" >&2
    echo "kritarc:" >&2
    cat "$XDG_CONFIG_HOME/kritarc" >&2 || true
  fi
  exit 67
fi

python3 - "$REPORT" <<'PY'
import json, sys
report = json.load(open(sys.argv[1], encoding="utf-8"))
if not report.get("ok"):
    print(report.get("traceback") or report.get("error") or "unknown Krita recipe error", file=sys.stderr)
    raise SystemExit(68)
if report.get("phase") != "editable-saved":
    print(f"unexpected Krita edit phase: {report.get('phase')}", file=sys.stderr)
    raise SystemExit(68)
PY
if [[ ! -s "$EDITABLE_SOURCE" ]]; then
  echo "Krita reported success but editable source is missing/empty: $EDITABLE_SOURCE" >&2
  exit 68
fi

# Phase B: use Krita's documented CLI KRA -> PNG exporter in a fresh process.
# Export to a temporary file first so a failure can never corrupt the current
# runtime asset. Only an independently successful export is moved into place.
unset CROWNLESS_KRITA_AUTORUN
cat > "$XDG_CONFIG_HOME/kritarc" <<'EOF'
[python]
enable_crownless_recipe=false
EOF
printf '%s\n' "cli-export-started" > "$STAGE_MARKER"
set +e
timeout 60s xvfb-run -a krita "$EDITABLE_SOURCE" --export --export-filename "$EXPORT_TMP" >"$EXPORT_LOG" 2>&1
EXPORT_STATUS=$?
set -e
if [[ $EXPORT_STATUS -ne 0 || ! -s "$EXPORT_TMP" ]]; then
  cat "$EXPORT_LOG" >&2 || true
  echo "Krita CLI export failed closed (status $EXPORT_STATUS); runtime asset was not replaced." >&2
  exit 69
fi
mv "$EXPORT_TMP" "$RUNTIME_EXPORT"
printf '%s\n' "complete" > "$STAGE_MARKER"

python3 - "$REPORT" <<'PY'
import json, sys
path = sys.argv[1]
report = json.load(open(path, encoding="utf-8"))
ops = report.setdefault("operations", [])
if "export-runtime-asset" not in ops:
    ops.append("export-runtime-asset")
report["phase"] = "complete"
report["ok"] = True
report["exportMode"] = "krita-cli"
with open(path, "w", encoding="utf-8") as handle:
    json.dump(report, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
print(f"Krita {report.get('kritaVersion', '?')} saved {report.get('editableSource')} and exported {report.get('runtimeExport')} ({report.get('width')}x{report.get('height')}, mode={report.get('exportMode')})")
PY
