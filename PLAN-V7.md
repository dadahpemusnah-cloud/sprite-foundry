# Sprite Foundry — V7 plan (draft): richer generator, real motion, more directions

Status: **V7.2 Adventurer built into the app** (preview shown before publishing); V7.1 done (Chibi classes, gear, faces, headwear). Written 2026-10-22. V6.1 (Unity cutout) is on hold.

## Decisions (2026-10-22)
1. Reference sheets: open source; used only as motion reference, no pixels copied.
2. Fourth motion: read as **Sneak** (same rhythm as the walk, smaller leg movement: measured frame-to-frame
   change 2093 vs the walk's 2421 and the run's 3607, legs kept close). [UNCERTAIN: the sheet is unnamed]
3. 8 directions straight away. 4. 32 px (the references' cell size; fits a 36×36 frame). 5. V7 first.

## Progress
- **V7.0 done**: sprite type **Chibi**. One design from the seeds (9 hair styles, 5 outfits, sleeves,
  belt, blush, colour ramps) drawn as 15 body parts in S, N, E, SE, NE; W, SW, NW are the mirrors with
  left and right parts swapped. Each direction is stored exactly as a 32 px PNG converted 1:1 (step 3),
  with parts (step 4), joints and drawing order (step 5) and the covered parts of each limb as hidden
  areas (step 7), so it saves, reopens and edits like an imported character. Idle, walk, run and sneak,
  8 frames each, in all 8 directions (33 rows with the rest pose). New: Sneak template; Run builds itself
  at other frame counts (no loop jump); Auto Animate covers all 8 directions and Walk/Run/Sneak/Idle.
  The chibi's head is kept nearly level when the body leans. Variations row shows 12 chibis turning.
  Fixed on the way: an unchanged seed no longer rebuilds the sprite (it swallowed clicks).
  Tests: `tests/chibi.mjs`; all 14 groups pass with Godot 4.3; export baseline unchanged.
  Limits: Frame check keeps up to 5 "held frame" warnings on idle; the chibi's Godot cutout scenes are
  written but not loaded in Godot by the tests (the Godot test imports an image).
- **V7.1 done**: Chibi class picker (Villager, Knight, Mage, Archer, Rogue, Warrior, Zombie, Random).
  Headwear: cap, helmet, pointed hat, hood, headband, bandana. Faces: 4 eye styles, 3 mouths, glasses,
  freckles, blush. Normal or stocky build. Gear: sword, axe, dagger or staff in the right hand, shield or
  bow in the left, drawn after mirroring so it stays in its own hand, rigged to that hand (shield and
  bow are parts of their own). A class with gear gets attack, cast or bow (8 frames) in all 8
  directions. Nothing is drawn above row 3, so a run's lift is not cut off. Run, sneak and every
  motion that fits a held item now keep any part held in a hand (not only "weapon") inside the frame;
  a chibi motion that still cuts something off has its arm turns scaled down (to at most half).
  Tests: tests/chibi.mjs checks every class in every direction (gear touches its hand, rows 3-30),
  combat motions, and a frame check with nothing but held idle and bow frames; sweeps of 7 classes ×
  7 seeds and 12 random seeds gave 0 warnings. All 14 groups pass with Godot 4.3; export baseline
  unchanged. Making a chibi now takes about 5 s.
  Known: the archer is always of normal build (a stocky one's bow left the frame when the arm was held out).

- **V7.2 Adventurer (in the app)**: sprite type **Adventurer**, 48 px, rendered from a 3D model of
  signed-distance shapes (orthographic camera tilted 22°, 8 real views, 5-tone shading, inner lines,
  pixel-exact faces). Six classes with their own pose and face: Fighter, Paladin, Barbarian, Rogue,
  Wizard, Druid. Each direction is stored like a chibi's (PNG 1:1, parts, joints projected from the
  model, hidden areas from per-part renders, drawing order by depth), with idle, walk, run and attack
  (or cast for Wizard and Druid), 8 frames each, in all 8 directions. Shared builder `riggedDirection`
  (chibi and adventurer). New on the way: feet settled on the ground per frame from the true leg
  position (hidden pixels too; a model-made rig reports it as `stats.feet`, which the frame check
  uses); a staff slides in the hand rather than leave the frame; capes and robes sway; front/back
  walks roll the hips a little; the robe is cut flat at the hem (its round end reached the frame edge).
  The direction comparison and the "quarter turn" joint test are skipped for model-made rigs (views of
  one model; foreshortening is not a mistake). The ground line ignores a held weapon or shield when
  no leg is in sight. Fixed: the settle step kept `follow`, so the app applied follow-through twice.
  Tests: `tests/adventurer.mjs` (6 classes: rows, 8 frames, frame check, walks, preflight, Godot
  pack, save and reopen, guard). Making one takes about 8-16 s.
  Known: Druid cast facing W, frame 4: 7 px of the crook cut off; held idle frames remain on some
  classes; a robe hides the legs in side views, so the Wizard's walk reads as a glide there.

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
