# Sprite Foundry — V8 plan: one picture in, an animated character out

Status: **V8.0 and V8.0b built** (preview shown before publishing). Written 2026-10-22.

## The request (from the sketch)
Upload one image of a character, press Convert, and get a sprite sheet with idle, walk, run, back,
left, right, hurt, death, attack and defence, which then animates.

## Decisions (2026-10-22)
1. The system makes the back view itself. 2. The system makes the side views itself.
3. It should be "smart and accurate".

What "accurate" can mean here: a front picture does not contain the back or the sides, so any system
(including large AI image models) has to infer them. The aim is views that match the front: same
colours, proportions and outfit, and are labelled as made by the system. [ESTABLISHED]

## Stages
- **V8.0 done: Convert in one click.** A Convert box at the top of Image to pixel art: a front
  image (needed) and a side image facing right (optional). It runs steps 1-6 through the same panels
  a person uses (background: the image's transparency, else edge flood-fill; pixel art; Rough guess;
  Suggest joints) and makes idle, walk, run, attack, defence (Block), hurt and death in every view.
  The side image becomes the right view and its mirror the left view (said in the result).
  New template **Punch** (an attack without a weapon); a view whose weapon is not in a hand punches.
  It asks before replacing a character, and checks the images open before anything is replaced.
  Tests: `tests/quick-convert.mjs` (front; front + side with a mirrored left; guard; damaged file).
  Converting front + side takes about 9 s.
  Known: the parts are a rough guess from body proportions (an upright figure facing you); the
  frame check still reports what the guess and the motions get wrong (e.g. a body jump in the side
  walk, the death fall cut off at the frame edge on the test character). No back view yet.
- **V8.0b done: smart joints (A + C).** Convert finds the joints with MediaPipe Pose Landmarker (full
  model, Apache 2.0, run in the browser; files published next to the page under pose/, gathered by
  `tools/pose-files.mjs`). The body parts are cut along the joints (`src/import/pose.js`: every pixel
  goes to the bone it is nearest to, limbs first, so an arm across the chest is its own part) and the
  rig's pivots are the joints (fixed). When no body is found, the model is unsure (< 50%) or cannot
  load, the rough guess is kept and the Joints editor asks for 14 clicks; any joint can be dragged and
  "Use these joints" cuts the parts again and remakes that view's animations.
  Tested on the user's Iori Yagami image (SNK art; kept out of the repo): 96% sure, every joint right,
  attack (punch) and defence now move the arms. The model found no body in the app's blocky test
  character nor in 48 px Adventurer renders (chibi proportions): those go to clicking.
  Known: the motions are made for arms hanging down; a picture in a strong pose (arms raised, wide
  stance) gives small idle and walk moves and a punch that swings outwards. A calmer pose animates better.
  Tests: `tests/quick-convert.mjs` (served page: the model loads; 14 clicks; a dragged joint; given landmarks).
- **V8.1 back and side views from the front alone.** Measure the converted front (part widths,
  heights, colours), build a 3D figure from it with the Adventurer renderer, render the other views,
  keep the front exactly as drawn, label the made views. [PLAUSIBLE: depth is estimated]
- **V8.2 accuracy pass** on several kinds of character (the user's own examples wanted).

## Limits
- Best on a full-body, upright, front-facing character on a plain or transparent background.
- Busy backgrounds would need GrabCut (OpenCV download) or brush fixes by hand.
