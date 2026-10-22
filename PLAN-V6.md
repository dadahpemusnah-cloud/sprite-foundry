# Sprite Foundry — V6 plan (draft)

Status: **draft, awaiting approval**. Written 2026-10-22.
Combines the earlier V6 draft (Unity cutout, fixes, V5 test follow-ups) with the
"Auto Animate — four-direction walk" request.

## Basis

The original competitor analysis and the PLAN-V1…V5 documents were lost with an old cloud
container. This plan comes from an audit of the published app (`index.html`, version
1792629047-f3d1), done by reading its code, and from the V5 verification (`tests/run-godot-check.sh`).
If the original analysis turns up, it overrides anything below.

## Where the app stands

| Area | Today | Gap |
|---|---|---|
| Walk animation | Keyed rig preset: legs in opposite phase, arms against them, feet planted (`src/rig/anim.js`, template "Walk") | Makes **8 frames**; there is no one-click four-direction walk |
| Directions | Up to 8 directions, each with its own artwork; E↔W mirroring (V4); rotation preview | Template panel wrongly says diagonals are "not supported yet" (bug) |
| Template motions | Frames 1–64, fps, loop, preview-before-add, "add to every direction with artwork" | Undo across directions and name-clash behaviour unchecked |
| Animation names | `walk` (main direction), `walk_n`, `walk_e`, `walk_w` | No `walk_down/up/left/right` naming for games that expect it |
| Validation | Frame check, rig check, direction check, preflight | No per-direction frame-count, ground-contact, loop-seam or duplicate-frame checks |
| Phaser | Sheet + Aseprite-hash atlas JSON, one frame tag per row | No runtime test; Phaser 4 compatibility [UNCERTAIN] |
| Godot | SpriteFrames + cutout scene, verified in Godot 4.3 (V5) | — |
| Unity | Sheet + slicing + sprite-swap clips | **No cutout export** |
| Aseprite | `.aseprite` with tags and frame times | One flattened layer |
| Tests | V5 Godot suite in the repo | V1–V4 suites lost; no WebKit in cloud sessions |
| Code | One bundled 18,800-line HTML file, plain JavaScript | `src/` tree lost (81 module markers remain in the bundle) |

## Rules for every stage

- Keep the existing editor, tools, palettes, animation rows, undo/redo and exports working.
- Reuse the existing data model, rig presets and export pipeline. No parallel engines or exporters.
- Never fake views: front, back and side need their own artwork. No duplicated frames called a walk.
- Each stage ends with: files changed · what works · tests run · actual results · limits · next step;
  then commit and push to GitHub; republish the artifact when user-facing code changed.

## Stages

### Stage 0: source strategy (decision)
- **(a) Recommended:** rebuild `src/` from the bundle's module markers, plus a build step that
  reproduces `index.html`, checked by an identical-output or identical-behaviour test.
- (b) Edit `index.html` directly: faster to start, riskier, hard to unit-test.

### Stage 1: baseline and quick fixes
- Seeded export snapshots: every preset for a fixed seed, with file hashes.
- Editor smoke tests: draw, undo/redo, palette, timeline duplicate/delete, save/open project.
- V5 Godot suite stays green. Follow-ups: run all **seven** presets, plus a side-view character
  with an animation that never reorders parts.
- Fix: remove the stale "Diagonal directions … not supported yet" line (`src/ui/template-panel.js`).
- Answer the unknowns: is "add to every direction" one undo step? What happens on a name
  clash? Where do the walk keys fall at 12 frames?

### Stage 2: Auto Animate panel (four-direction walk)
- One action: **Walk · four directions (S, N, W, E) · 12 frames · 10 fps · loop** (48 frames,
  1.2 s loop). It wraps the existing walk template; there is no new generator.
- Character cases:
  - **A**, rigged image per direction: supported.
  - **B**, a direction without its own image: listed as "needs artwork"; E↔W mirroring is
    offered only where it is already allowed.
  - **C**, seeded generator sprites (one view) and the 2.5D Workshop (no rig): the panel explains
    the preparation needed instead of faking views.
- Preview in the rotation preview first. **Apply** adds animations; a name clash asks before
  replacing; the whole apply is one undo step. Frames stay editable in the timeline and editor.

### Stage 3: walk calibration at 12 frames
- Pose checkpoints at frames 0/3/6/9 (contact, down, passing, up), mirrored for the second step.
- Stable ground contact and pivot; integer pixels in the final render.
- The loop seam (frame 11 → 0) is as smooth as any other step.

### Stage 4: validation additions (warnings in the existing frame check)
- 12 frames per direction, 48 total, durations sum to 1.2 s; consistent frame size; correct keys and order.
- Ground contact: the lowest opaque row is fixed; pivot unchanged; transparent background; no clipping.
- Duplicate frames: **warn, never delete**. Loop-seam size compared with the other steps.
- A visual-review checklist (foot sliding, limbs crossing, weak silhouettes). Automated checks
  do not prove the walk looks natural.

### Stage 5: export naming and Phaser runtime test
- Export option **direction names: compass (`walk_e`) / screen (`walk_right`)**, used in atlas
  tags, manifest, GIF and Godot/Unity names. Default stays compass, so existing users are unaffected.
- Phaser test page (headless Chromium, Phaser from npm, pinned to your version): load the
  exported atlas, create the four animations, play each, and assert 12 frames, 10 fps and frame order.

### Stage 6: Unity cutout export (large; parity with V5 Godot)
- Move the shared part-cutting and key-planning out of `godot-cutout.js` into a common module.
- Write a prefab (GameObject per part, parented like the rig, SpriteRenderer per part, root at
  the pivot), part PNGs with `.png.meta`, an AnimationClip per animation (`m_EulerCurves`,
  `m_PositionCurves`, `m_PPtrCurves` for drawing swaps, `m_SortingOrder` curves) and an AnimatorController.
- Easing: ease in, ease out and ease in-out are cubics, so each can be written exactly with
  Hermite tangents [PLAUSIBLE; needs one check in Unity]. Unity is y-up: negate y and rotation.
- Verification: YAML structure check, a Python replay compared against the sheet (as in V5), and
  mutation checks. The Unity Editor cannot run in cloud sessions [PLAUSIBLE, not attempted], so
  **you open it once in Unity**; until then the README says "not yet opened in Unity".

### Stage 7: regression and docs
- All baselines, the V5 Godot suite, the Phaser test, the Unity checks; help text; export READMEs.

## Deferred to V7
- Layered `.aseprite` export (one layer per part).
- Spine / DragonBones JSON [UNCERTAIN demand].
- Performance work on the 902 KB page: measure load time first.

## Order and size (rough)
Stage 0 medium · Stage 1 small–medium · Stages 2–5 medium (the walk feature) · Stage 6 large ·
Stage 7 small. Stages 2–5 can ship as **V6.0**, Stage 6 as **V6.1**, so the walk does not wait on Unity.

## Still owed from earlier versions (needs your machine)
Firefox (VC++ Redistributable) · OpenCV GrabCut in the published page · save/reopen a project
from the published page · Godot export in the Godot editor · Unity pack and Phaser packed atlas
in their engines.

## Decisions needed
1. Source strategy: (a) rebuild `src/` (recommended) or (b) edit `index.html`.
2. Phaser version your game uses (3.x or 4.x).
3. Do you have front, back and side artwork for the character?
4. Naming: an export option (compass by default), or `walk_down` etc. inside the app too?
5. Do you have Unity installed for the one manual check in Stage 6?
