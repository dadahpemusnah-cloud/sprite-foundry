#!/usr/bin/env bash
# Mutation check for the Godot cutout tests: every seeded bug in tests/mutate.py must make the check fail.
# usage: GODOT=<godot4 binary> tests/run-mutants.sh
set -uo pipefail
W=$(mktemp -d); survived=0
python3 tests/mutate.py "$W/mut" > /dev/null
for m in "$W"/mut/*.html; do
  n=$(basename "$m" .html)
  if SF_SPARSE=1 SF_ANIMS=anIdle,anWalk,anAttack tests/run-godot-check.sh "$W/$n" chromium "$m" > "$W/$n.log" 2>&1 &&
     SF_IMAGE=tests/character-side.png SF_ANIMS=anIdle tests/run-godot-check.sh "$W/$n-side" chromium "$m" >> "$W/$n.log" 2>&1; then
    echo "SURVIVED $n"; survived=1
  else echo "killed   $n: $(grep -m1 -E 'FAIL|Error' "$W/$n.log" | cut -c1-90)"; fi
done
exit $survived
