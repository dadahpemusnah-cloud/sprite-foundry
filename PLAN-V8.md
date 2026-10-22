# Sprite Foundry — V8 plan: one picture in, an animated character out

Status: **V8.0 built** (preview shown before publishing). Written 2026-10-22.

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
- **V8.1 back and side views from the front alone.** Measure the converted front (part widths,
  heights, colours), build a 3D figure from it with the Adventurer renderer, render the other views,
  keep the front exactly as drawn, label the made views. [PLAUSIBLE: depth is estimated]
- **V8.2 accuracy pass** on several kinds of character (the user's own examples wanted).

## Limits
- Best on a full-body, upright, front-facing character on a plain or transparent background.
- Busy backgrounds would need GrabCut (OpenCV download) or brush fixes by hand.
