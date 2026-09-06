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
trap 'rm -rf "$TMP_HOME"' EXIT
PLUGIN_ROOT="$TMP_HOME/.local/share/krita/pykrita"
mkdir -p "$PLUGIN_ROOT" "$TMP_HOME/.config"
cp "$REPO_ROOT/tools/krita/crownless_recipe.desktop" "$PLUGIN_ROOT/"
cp -R "$REPO_ROOT/tools/krita/crownless_recipe" "$PLUGIN_ROOT/"
cat > "$TMP_HOME/.config/kritarc" <<'EOF'
[python]
enable_crownless_recipe=true
EOF

rm -f "$REPORT"
export HOME="$TMP_HOME"
export CROWNLESS_KRITA_RECIPE="$RECIPE"
export CROWNLESS_REPO_ROOT="$REPO_ROOT"

set +e
timeout 120s xvfb-run -a krita --nosplash >"$REPO_ROOT/qa-output/krita-504/krita.log" 2>&1
KRITA_STATUS=$?
set -e

if [[ ! -f "$REPORT" ]]; then
  cat "$REPO_ROOT/qa-output/krita-504/krita.log" >&2 || true
  echo "Krita exited without a recipe report (status $KRITA_STATUS)." >&2
  exit 67
fi

python3 - "$REPORT" <<'PY'
import json, sys
report = json.load(open(sys.argv[1], encoding="utf-8"))
if not report.get("ok"):
    print(report.get("traceback") or report.get("error") or "unknown Krita recipe error", file=sys.stderr)
    raise SystemExit(68)
print(f"Krita {report.get('kritaVersion', '?')} exported {report.get('runtimeExport')} ({report.get('width')}x{report.get('height')})")
PY
