# Sprite Foundry — V6 plan (draft)

Status: **draft, awaiting approval**. Written 2026-10-22.

## Why this plan is built from the code, not the old analysis

The competitor analysis and the PLAN-V1…V5 documents lived in an earlier cloud container
and were lost with it. This draft is built from:

- the published app (`index.html`, version 1792629047-f3d1) — what it does today, read from the code;
- the V5 verification done this session (`tests/run-godot-check.sh`);
- the handoff note, which listed "Unity export, additional platforms, performance" as V6+ ideas
  without detail.

If you still have the original analysis or plan, it should override anything below.

## Where the app stands

| Area | Today | Gap |
|---|---|---|
| Godot | Sheet + SpriteFrames `.tres`; **cutout scene** (rig as nodes, AnimationPlayer) — verified in Godot 4.3 in V5 | — |
| Unity | Sheet + `.png.meta` slicing + sprite-swap AnimationClips (`src/export/unity-anim.js`) | **No cutout export.** A rigged character reaches Unity only as flat frames |
| Aseprite | `.aseprite` export: every animation as a tag, frame times, frame data | **One flattened layer** (`#aseBtn` tooltip). Parts/layers are lost |
| Directions | 8 directions with their own artwork, mirroring (V4) | Template motions panel wrongly says diagonals "are not supported yet" (bug, below) |
| Tests | V5 Godot suite is in the repo | V1–V4 suites were lost; no WebKit available in cloud sessions |

## Proposed V6 scope

### V6.1 — Fix the stale diagonal message (bug, small)

`src/ui/template-panel.js` (bundle line ~14668) always appends
"Diagonal directions (SE, NE, NW, SW) are not supported yet." The line above it already lists
missing directions from `DIRECTIONS`, which includes the diagonals. Remove the stale line;
check the panel with an 8-direction character in the browser.

### V6.2 — Unity cutout export (main item; parity with V5)

Same idea as the Godot cutout scene, written as Unity text assets:

- **Prefab** (`.prefab`): a GameObject per rig part, parented like the rig; Transform at the joint;
  child SpriteRenderer with the part picture; root at the pivot.
- **Part sprites**: one PNG per part (reuse `cutParts` / `shareBox` from `godot-cutout.js`) with
  `.png.meta` (pixels-per-unit, pivot, point filter) — the existing meta writer already does slicing.
- **AnimationClip** per animation: rotation in `m_EulerCurves`, offsets in `m_PositionCurves`,
  drawing swaps in `m_PPtrCurves`, draw order as `m_SortingOrder` float curves; an
  **AnimatorController** listing the clips.
- **Easing**: Unity keys are cubic Hermite curves with in/out tangents. The app's ease in (u²),
  ease out (1−(1−u)²) and ease in-out (smoothstep) are all cubics, so each can be written
  exactly as one key pair with the right tangents. [PLAUSIBLE — the maths is standard; that Unity's
  default (non-weighted) tangents behave as plain Hermite needs checking in Unity.] Custom curves,
  secondary motion and uneven frame times get a key per frame, as in Godot.
- **Coordinate flip**: Unity is y-up; positions get y negated and rotations negated.
- Refactor: move the shared part-cutting and key-planning out of `godot-cutout.js` into a common
  module both exporters use, so a fix lands in both.

**Verification plan and its limit.** The Unity Editor cannot run in these cloud sessions (licence
sign-in, multi-GB install) [PLAUSIBLE — not attempted]. So:
1. Parse the generated YAML and check structure (every curve path names a real GameObject,
   every fileID/guid resolves, key times inside clip length).
2. A Python replay: evaluate the Hermite curves at each frame time, place the part pictures, and
   compare against the sheet — the same silhouette/colour comparison as V5, rest pose exact.
3. Mutation check as in V5 (rotation sign, y-flip, tangents, pivot, sorting order).
4. **You** open the export in Unity once and play each clip. Until then it ships marked
   "not yet opened in Unity" in its README, like the Godot pack was.

### V6.3 — V5 test follow-ups (small)

- A character with a **side view** and an animation that **never reorders parts**, so the static
  draw order is exercised by pixels (V5 only caught it through the rest-pose invariant).
- Run all **seven** animation presets through the Godot check (V5 covered idle, walk, attack).
- Run the suite in **WebKit** on a machine where Playwright's WebKit can be installed.

### Deferred to V7 (listed so they are not forgotten)

- **Layered `.aseprite` export** — one Aseprite layer per part instead of one flattened layer.
  Valuable, but verifying needs Aseprite (paid) or a careful format check; the app's own
  `.aseprite` importer in the Workshop can be the first round-trip test.
- **Spine / DragonBones JSON** — would reach more engines, but these are large formats and a
  separate project. [UNCERTAIN whether users of this app need them; no evidence either way.]
- **Performance** — the page is one 902 KB file; measure load time before deciding anything.

## Order and size (rough)

1. V6.1 diagonal message — small.
2. V6.3 test follow-ups — small/medium; makes the V6.2 refactor safer.
3. V6.2 Unity cutout — large: shared-module refactor, then prefab, clips, controller, tests.

Each step: change → V5 Godot suite still passes → new tests → commit and push to GitHub →
republish the artifact.

## Open checks still owed from earlier versions (need your machine)

- Firefox (needs the VC++ Redistributable on your PC).
- OpenCV GrabCut in the published page (cdnjs is blocked in cloud sessions, so it was not checked here).
- Save a project and reopen it from the published page.
- Godot export opened in the Godot **editor** (V5 checked it headless only).
- Unity pack and Phaser packed atlas opened in their engines.

## Decisions needed from you

1. Approve this scope, or reorder it (for example layered Aseprite before Unity cutout).
2. Do you have Unity installed, to do the one manual check V6.2 depends on?
