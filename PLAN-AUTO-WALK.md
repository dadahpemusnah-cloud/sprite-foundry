# Auto Animate — four-direction walk: review and revised plan (draft)

Status: **draft, awaiting approval**. Written 2026-10-22. Based on a Stage 1 audit of the
published app (`index.html`, version 1792629047-f3d1), done by reading the code.

## 1. What the app already has (audit findings)

| The prompt asks for | Already in the app | Where (bundle module) |
|---|---|---|
| Procedural walk: legs in opposite phase, arms against them, feet planted | **Yes**, a keyed rig preset (contact/passing poses + easing), not a bare sine | `src/rig/anim.js`, template "Walk" in `src/rig/templates.js` |
| Frame count and fps settings | **Yes**: frames 1–64, fps 1–60, loop, retime | Template motions panel (`#tmFrames`, `#tmFps`) |
| Apply to all four directions | **Yes**: "add to: every direction with artwork" | `#tmAddTo` |
| Real front/back/side views (not faked) | **Yes**: one image per direction (up to 8), E↔W mirroring with marks (V4) | `src/import/directions.js`, `src/workshop/clips.js` |
| Preview before applying; never overwrite | **Yes**: "Previewing changes nothing. Adding makes a new animation" | template panel |
| Preview all directions together | **Yes**: rotation preview | `src/ui/rotation-preview.js` |
| Edit generated frames in the timeline/editor | **Yes**: frames go into the normal timeline; hand-edited frames are tracked | `src/core/timeline.js` |
| Validation | **Partly**: frame check, rig check, direction check, preflight | `src/rig/check.js`, `src/rig/directions-check.js`, `src/rig/preflight.js` |
| Phaser export | **Yes**: sheet + Aseprite-hash atlas JSON, one frame tag per row | `src/export/pipeline.js`, preset `phaser` |
| PNG / GIF / JSON / ZIP | **Yes** | `src/export/*` |

So most of the feature exists. The work is to **wrap and fill gaps**, not to write a new
`walkCycleGenerator`, which would break the prompt's own rules 3 and 4 (reuse; no rewrites).

## 2. Where the prompt does not fit this project

1. **"TypeScript engineer"**: the app is plain JavaScript bundled into one 18,800-line HTML file.
   The `src/` tree it was built from was lost with an old container; only the bundle remains
   (it keeps 81 `// src/...` module markers). **Decision needed**, see section 4.
2. **Animation names**: the app names rows by compass point, with the main direction unsuffixed:
   `walk`, `walk_n`, `walk_e`, `walk_w`. The prompt wants `walk_down/up/left/right`. Renaming
   rows would break saved projects and existing exports; an **export naming option** avoids that.
3. **Frame count**: the walk preset currently makes **8 frames** (10 fps in the V5 test export).
   12 frames at 10 fps = a 1.2 s loop. The key spacing must be checked at 12 frames
   (contact/down/passing/up at frames 0/3/6/9).
4. **Character cases** (prompt Stage 2):
   - A, rigged image import: supported, the main path.
   - Generated "Sprite type" characters (seeded generator): they have built-in walk frames but
     **one view only**. Four directions are not possible without artwork; the panel should say so.
   - 2.5D Workshop: hand-drawn frames per direction, no rig. This is case C: the panel should
     explain the preparation needed (rig an image per direction).
5. **"Regression of all existing functions"**: the V1–V4 automated suites were lost. A baseline
   must be **rebuilt first**, or this requirement cannot be met.
6. **"The actual Phaser test scene"**: none exists in the repo. Phaser installs from npm here
   (latest reported: 4.2.1). [UNCERTAIN] whether the app's `load.aseprite` JSON works unchanged in
   Phaser 4; it was written for Phaser 3's `anims.createFromAseprite`. Needs a test on the version
   your game uses.
7. **One undoable transaction across four directions**: [UNKNOWN] whether "add to every direction"
   is one undo step today. To be checked in Stage 1.
8. **WebKit** cannot run in these cloud sessions; Chromium only.

## 3. Revised plan

**Stage 0: source strategy** (decision, section 4).

**Stage 1: baseline (no feature changes)**
- Seeded export snapshots: every export preset for a fixed seed, with file hashes, so any
  change shows up.
- Editor smoke tests: draw, undo/redo, palette change, timeline duplicate/delete, save/open project.
- Keep the V5 Godot suite passing.
- Answer the unknowns: undo across directions, name-clash behaviour, walk keys at 12 frames.

**Stage 2: Auto Animate panel (a wrapper, no new engine)**
- One action: Walk · four directions (S, N, W, E) · 12 frames · 10 fps · loop.
- Runs the existing walk template on every direction that has artwork. Lists the directions that
  lack artwork instead of faking them; offers E↔W mirroring only where it is already allowed.
- Preview in the rotation preview; **Apply** adds the animations; a name clash asks before
  replacing; the whole apply is one undo step.

**Stage 3: walk calibration at 12 frames**
- Pose checkpoints at frames 0/3/6/9 (contact, down, passing, up), mirrored for the second step
  (6–11). Integer pixels in the final render (already true).
- Loop continuity: frame 11 → frame 0 must be as smooth as any other step.

**Stage 4: validation additions** (into the existing frame check, as warnings)
- Frames per direction = 12; total = 48; durations sum to 1.2 s.
- Ground contact: the lowest opaque row stays fixed; pivot unchanged.
- Duplicate frames: **warn**, never delete. Loop seam size compared with the other steps.
- A visual-review checklist (foot sliding, limbs crossing, weak silhouettes). Automated checks
  do not prove the walk looks natural.

**Stage 5: export and Phaser**
- Export option "direction names: compass (walk_e) / screen (walk_right)", applied to atlas tags,
  manifest, GIF and Godot/Unity names. Default stays compass, so existing users are unaffected.
- A Phaser test page (headless Chromium, Phaser from npm, pinned version): load the exported
  atlas, create the four animations, play each, and assert 12 frames, 10 fps and the right
  frame order.

**Stage 6: regression and docs**: all baselines, the V5 Godot suite, help text, README in exports.

Every stage ends with: files changed · what works · tests run · actual results · limits · next step.

## 4. Decisions needed

1. **Source strategy**:
   - (a) Rebuild `src/` from the bundle's 81 module markers plus a build step. Safer edits and
     real unit tests; costs about one stage up front. **Recommended.**
   - (b) Edit `index.html` directly. Faster to start, riskier, and harder to unit-test.
2. **Phaser version** your game uses (3.x or 4.x).
3. Do you have **front, back and side artwork** for the character? Four true directions need it;
   the app will not invent the back view.
4. Naming: is an export option (compass by default) acceptable, or must rows be named
   `walk_down` etc. inside the app as well?
