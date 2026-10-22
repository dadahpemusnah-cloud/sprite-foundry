#!/usr/bin/env bash
# End-to-end V5 check: page export (Chromium or WebKit) → Godot 4 import → structure check → per-frame fidelity.
# usage: tests/run-godot-check.sh <work dir> [chromium|webkit] [page.html]
set -euo pipefail
W=$1; ENGINE=${2:-chromium}; export SF_HTML=${3:-index.html}
G=${GODOT:?set GODOT to a Godot 4 binary}
HERE=$(cd "$(dirname "$0")" && pwd)
rm -rf "$W"; mkdir -p "$W"
node "$HERE/godot-export.mjs" "$W/pack" "$ENGINE"
cp -r "$W/pack" "$W/proj"; cp "$HERE"/godot/*.gd "$W/proj/"
printf 'config_version=5\n[application]\nconfig/name="cutout-check"\n' > "$W/proj/project.godot"
timeout 300 "$G" --headless --import --path "$W/proj" > "$W/import.log" 2>&1
SCENE=$(cd "$W/proj" && ls *_rig*.tscn | head -1)
timeout 120 "$G" --headless --path "$W/proj" -s check_cutout.gd -- "$SCENE" 2>&1 | grep -E '^(anim|sprites|animations|FAIL|RESULT|SCRIPT ERROR|ERROR)' | tee "$W/check.log"
grep -q 'RESULT PASS' "$W/check.log"
timeout 300 "$G" --headless --path "$W/proj" -s raster_cutout.gd -- "$SCENE" manifest.json "$W/raster" > "$W/raster.log" 2>&1
python3 "$HERE/godot/compare_cutout.py" "$W/pack" "$W/raster" | tail -1
