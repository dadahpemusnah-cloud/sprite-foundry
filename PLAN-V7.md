# Sprite Foundry — V7 plan (draft): richer generator, real motion, more directions

Status: **draft, waiting on decisions** (below). Written 2026-10-22. V6.1 (Unity cutout) is on hold.

## The request
1. Is the generator limited to the sprites it makes today (Character, Creature, Ship, Item, RPG Hero)?
2. More pixel art.
3. Each type should have its own motions, like the reference sheets (8 directions × 8 frames:
   walk, idle, run, and one motion not yet named).

## Where the generator stands (from the code)
| Type | How it is drawn | Views | Animations today |
|---|---|---|---|
| Character | Procedural from seeds: 7 hair styles, 4 weapons, cape, shield, beard, belt, colour ramps | Front only | idle, walk, attack, jump, hurt: 4–5 frames, parts nudged 1–2 px |
| Creature | Procedural blob, pattern, eyes, legs | Front only | idle, walk, hop, attack, hurt (same nudge style) |
| Ship | Procedural, symmetric | Top-down | fly, boost, bank, hurt (flame + shift) |
| Item | Procedural (several kinds) | One | float, shine, spin |
| RPG Hero | 26 hand-drawn parts, 6 classes + custom, 28 px | Front only | idle, walk, run, attack, jump, hurt, death (nudges) |

The **rig system** (joints, turning limbs, Walk/Run/Idle/Attack/Jump/Hurt/Death presets, Auto
Animate, frame check, all exports) only works for **Imported** characters. That is the gap: the
generator has variety without real motion, the rig has real motion without generated art.

## Reference sheets
256×256 px, 8×8 cells of 32 px; rows are directions, columns are frames (measured: frames differ
far less along a row, most of all in the idle sheet). Motions: walk, idle, run, and a fourth
(legs close together, small sway) to be named. Used **only as motion reference**, never copied.

## Approach (recommended)
Make generated characters **rigged from birth**: the generator draws each body part separately,
with joints, for each direction, from one design (colours, hair, clothes, gear). The existing rig
presets then animate them. A back or side view is drawn from the same design, not guessed from
a picture, so this keeps the "never fake views" rule.

## Stages
- **V7.0 Chibi base + 4 directions.** New "Chibi" body (about 32 px, big head, like the
  references) drawn as parts with joints, in down / up / left / right. Idle, walk and run at 8
  frames per direction through the rig and Auto Animate. Exports unchanged.
  Tests: parts cover every pixel; rest pose exact; feet on the ground; seeded snapshots.
- **V7.1 More variety on that base.** Hair, faces, outfits, hats, gear, body shapes, skin and
  palette sets; RPG Hero classes move onto the base. A "randomise unlocked" for every slot.
- **V7.2 8 directions.** Diagonal (3/4) views drawn per part; the app already handles 8
  directions for imported characters.
- **V7.3 Motions per type.** Character: attack, jump, hurt, death and the fourth reference motion.
  Creature by body plan (slime squash-and-stretch, flyer flap, four-legged trot). Ship: bank,
  thrust, fire, explode. Item: bob, spin, sparkle, pickup.
- The existing Character / Creature / Ship / Item / RPG Hero stay as they are (export baseline
  unchanged) until a replacement is better.

## Limits
- Pixel art from a generator looks rule-made; it will not match a hand-drawn pack. [PLAUSIBLE]
- Turning limbs at 32 px can leave gaps or jaggies; the generator can draw parts to hide this,
  but diagonals are the hardest part. [PLAUSIBLE]
- Checks catch gaps, ground and jumps, not whether a motion looks good: you review it by eye.

## Decisions needed
1. Where do the reference sheets come from, and may they be used as motion reference?
2. What is the fourth motion (the sheet with legs close together)?
3. Start with 4 directions (recommended) or 8?
4. Sprite size: 32 px like the references?
5. Order: V7 now, Unity cutout (V6.1) after?
