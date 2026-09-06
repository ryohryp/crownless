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

readarray -t PATHS < <(python3 - "$RECIPE" <<'PY'
import json, sys
r = json.load(open(sys.argv[1], encoding="utf-8"))
for key in ("sourceRuntime", "baseSnapshot", "editableSource", "runtimeExport", "report"):
    print(r[key])
PY
)
SOURCE_RUNTIME="$REPO_ROOT/${PATHS[0]}"
BASE_SNAPSHOT="$REPO_ROOT/${PATHS[1]}"
REPORT="$REPO_ROOT/${PATHS[4]}"

if [[ ! -f "$SOURCE_RUNTIME" ]]; then
  echo "runtime source is missing: $SOURCE_RUNTIME" >&2
  exit 65
fi
mkdir -p "$(dirname "$BASE_SNAPSHOT")" "$(dirname "$REPORT")"
if [[ ! -f "$BASE_SNAPSHOT" ]]; then
  cp "$SOURCE_RUNTIME" "$BASE_SNAPSHOT"
  echo "Captured immutable phase-1 base snapshot: ${PATHS[1]}"
fi

TMP_HOME="$(mktemp -d)"
KRITA_WRAPPER_PID=""
cleanup() {
  if [[ -n "$KRITA_WRAPPER_PID" ]] && kill -0 "$KRITA_WRAPPER_PID" 2>/dev/null; then
    kill "$KRITA_WRAPPER_PID" 2>/dev/null || true
  fi
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
rm -f "$REPORT" "$IMPORT_MARKER"
export CROWNLESS_KRITA_RECIPE="$RECIPE"
export CROWNLESS_REPO_ROOT="$REPO_ROOT"
export CROWNLESS_KRITA_IMPORT_MARKER="$IMPORT_MARKER"

# Opening the immutable base on startup forces a real document window. Keep the
# process under a hard timeout, but stop it as soon as the plugin writes its
# deterministic report; the shell owns process lifetime rather than relying on
# Krita's GUI shutdown path.
set +e
timeout 120s xvfb-run -a krita --nosplash -platform xcb "$BASE_SNAPSHOT" >"$REPO_ROOT/qa-output/krita-504/krita.log" 2>&1 &
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
if [[ -f "$REPORT" ]] && kill -0 "$KRITA_WRAPPER_PID" 2>/dev/null; then
  kill "$KRITA_WRAPPER_PID" 2>/dev/null || true
fi
wait "$KRITA_WRAPPER_PID"
KRITA_STATUS=$?
KRITA_WRAPPER_PID=""
set -e

if [[ ! -f "$REPORT" ]]; then
  cat "$REPO_ROOT/qa-output/krita-504/krita.log" >&2 || true
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
print(f"Krita {report.get('kritaVersion', '?')} exported {report.get('runtimeExport')} ({report.get('width')}x{report.get('height')}, launch={report.get('launchReason', '?')})")
PY
