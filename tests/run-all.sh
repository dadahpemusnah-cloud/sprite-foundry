#!/usr/bin/env bash
# Full regression: build check, export baseline, editor smoke, template directions, direction
# switch races, Auto Animate, Godot cutout
# (front view with all 7 presets + sparse keys; side view idle). Godot steps need GODOT=<godot4 binary>.
# usage: tests/run-all.sh [chromium|webkit]
set -uo pipefail
export SF_ENGINE=${1:-chromium}
W=$(mktemp -d); fail=0
step() { local name=$1; shift; if "$@" > "$W/$name.log" 2>&1; then echo "PASS  $name  $(tail -1 "$W/$name.log")"; else echo "FAIL  $name  (log: $W/$name.log)"; tail -5 "$W/$name.log"; fail=1; fi; }
step build      node tools/check-build.mjs
step exports    node tests/baseline-exports.mjs
step editor     node tests/editor-smoke.mjs
step tmpl-dirs  node tests/template-dirs.mjs
step dir-switch node tests/direction-switch.mjs
step auto-anim  node tests/auto-animate.mjs
step walk-12   node tests/walk-quality.mjs
step frame-chk  node tests/frame-check.mjs
if [ -n "${GODOT:-}" ]; then
  step godot-front env SF_SPARSE=1 SF_ANIMS=anIdle,anWalk,anAttack,anRun,anJump,anHurt,anDeath tests/run-godot-check.sh "$W/gf" "$SF_ENGINE"
  step godot-side  env SF_IMAGE=tests/character-side.png SF_ANIMS=anIdle tests/run-godot-check.sh "$W/gs" "$SF_ENGINE"
else echo "SKIP  godot (set GODOT to a Godot 4 binary)"; fi
exit $fail
