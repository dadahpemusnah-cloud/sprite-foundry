  // src/help/content.js
  var C = (label, at) => ({ label, at });
  var TUTORIALS = [
    {
      id: "generator",
      mode: "foundry",
      title: "Make a sprite with the generator",
      intro: "Make a game sprite from seeds, look at its animations, touch it up if you like, and export a sprite sheet. Nothing here needs an image of your own.",
      steps: [
        {
          title: "Choose what to make",
          go: "#typeSeg",
          controls: [C("Character", "#typeSeg"), C("Creature", "#typeSeg"), C("Ship", "#typeSeg"), C("Item", "#typeSeg"), C("RPG Hero", "#typeSeg"), C("12 px", "#sizeSeg"), C("32 px", "#sizeSeg")],
          do: "Under Sprite type, click Character, Creature, Ship, Item or RPG Hero. Under Sprite size, click a size such as 12 px or 32 px.",
          expect: "The preview in the middle shows a new sprite of that type, and the Variations row at the bottom fills with others like it.",
          watch: 'RPG Hero always uses a 28 px sprite, so the size buttons are switched off for it. "Imported" is for your own image (see the image tutorial). If you have edited pixels, the app asks before changing the type or size, because the sprite is rebuilt.',
          undo: "Click the type or size you had before. If the app asked you, Cancel keeps everything as it was."
        },
        {
          title: "Pick a variation you like",
          go: "#thumbs",
          controls: [C("New batch", "#batchBtn")],
          do: 'Scroll to "Variations \xB7 click one to load it" and click a thumbnail. Click New batch for a fresh set.',
          expect: "The clicked variation becomes the sprite in the preview.",
          watch: "Loading a variation replaces the current sprite. If it has edits, a box asks you first: Save project first, Discard edits and continue, or Cancel.",
          undo: "Choose Cancel in that box to keep your sprite."
        },
        {
          title: "Change its shape or colours (seeds)",
          go: "#shapeSeed",
          controls: [C("New shape", "#reshapeBtn"), C("New colours", "#recolorBtn"), C("Shape", "#shapeSeed"), C("Colour", "#colorSeed")],
          do: "Under Seeds, click New shape or New colours. You can also type a word into the Shape or Colour box.",
          expect: "A seed is a word that decides the shape or the colours. The same seeds always give the same sprite, so note them down to make it again.",
          watch: "Changing the shape seed rebuilds the sprite, and hand edits are lost (the app asks first if there are any).",
          undo: "Type the old seed back into the box."
        },
        {
          title: "RPG Hero only: class, parts and locks",
          go: "#heroGroup",
          appears: "when RPG Hero is the sprite type",
          controls: [C("Randomize unlocked", "#heroRoll"), C("Lock colours", "#lockColours")],
          do: "Choose a Class, then pick parts in the Parts list. Picking a part locks it. Click Randomize unlocked to re-roll the rest. Tick Lock colours to keep the colours while you re-roll.",
          expect: "Locked parts stay when you randomize or load a variation.",
          watch: "Unlocking a part gives the slot back to what the seed rolls."
        },
        {
          title: "Choose a palette and an outline",
          go: "#palette",
          controls: [C("Palette", "#palette"), C("PICO-8 \xB7 16", "#palette"), C("Custom palette", "#palette"), C("Tinted", "#outlineSeg"), C("Black", "#outlineSeg"), C("None", "#outlineSeg")],
          do: "Pick a Palette from the list (for example PICO-8 \xB7 16), and an Outline: Tinted, Black or None.",
          expect: "Every frame is redrawn with those colours. Palettes and outlines change how frames are drawn, not the stored pixels, so you can switch back freely.",
          watch: "Custom palette shows extra controls for your own colours."
        },
        {
          title: "Watch the animations",
          go: "#animSeg",
          controls: [C("Pause", "#playBtn"), C("8 fps", "#fps"), C("Clear", "#bgSeg"), C("Grass", "#bgSeg"), C("Onion skin", "#onion")],
          do: "Click an animation name above the preview (such as idle or walk). Use Pause/Play and the fps slider. A Background such as Grass helps you judge colours.",
          expect: "The frames strip under the preview shows every frame of that animation.",
          watch: "Onion skin draws the frames before (and after) faintly, to compare poses. It only affects the view."
        },
        {
          title: "Optional: touch up pixels",
          go: "#editBtn",
          controls: [C("Edit pixels", "#editBtn"), C("Base pose", "#targetSeg"), C("This frame", "#targetSeg"), C("Pencil", "#toolSeg"), C("Undo", "#undoBtn"), C("Discard edits", "#resetBtn"), C("Revert frame", "#revertFrame")],
          do: "Click Edit pixels. Choose Base pose (changes every frame built from it) or This frame (only the frame shown). Pick a tool such as Pencil and a colour, then draw on the preview.",
          expect: "The preview becomes an editor. Edits show at once in the strip and the sheet.",
          watch: "Changing the type, size or shape seed afterwards rebuilds the sprite (the app warns you).",
          undo: "Undo / Redo step through edits. Revert frame returns one frame to its generated pixels. Discard edits drops all pixel edits."
        },
        {
          title: "Check and export",
          go: "#findings",
          controls: [C("Sheet .png", "#pngBtn"), C("Atlas .json", "#jsonBtn"), C("Export .zip", "#presetBtn"), C("Export preset", "#exportPreset"), C("2\xD7", "#scaleSeg")],
          do: "In the right-hand column, tick the Sheet rows you want and choose an Export scale such as 2\xD7. Read the Frame check. Then click Sheet .png, or pick an Export preset (Phaser, Godot 4, Unity, \u2026) and click Export .zip.",
          expect: "Your browser saves the files. The zip includes manifest.json listing every file and its size.",
          watch: "Frame check errors (red) must be fixed before exporting; warnings only point at frames worth a look."
        },
        {
          title: "Save the project to keep working later",
          go: "#saveProject",
          controls: [C("Save project", "#saveProject"), C("Open project\u2026", "#openProject")],
          do: "Click Save project.",
          expect: "A .sfproj.json file is saved. It keeps everything editable: seeds, parts, edited pixels, the timeline and export choices. Open project\u2026 brings it back.",
          watch: "Your work is also kept in this browser between visits, but a project file is the safe copy."
        }
      ]
    },
    {
      id: "image",
      mode: "foundry",
      title: "Turn an image into an animated character",
      intro: 'Bring in a picture of a character, turn it into pixel art, mark its body parts and joints, and animate it by moving those parts. This is the "Image to pixel art" panel under the editor, steps 1 to 7.',
      note: "The rig only moves and turns the parts you mark. It cannot show the character's back or sides, or anything the image does not have. For another view, add that view as its own image (Directions). The automatic helpers (background removal, Rough guess, Suggest joints, Fill automatically) give a starting point to check, not a perfect result.",
      steps: [
        {
          title: "1 \xB7 Bring in the image and place it",
          go: "#importDrop",
          controls: [C("choose a file\u2026", "#importPick"), C("Whole image", "#cropAll"), C("anchor", "#placeAnchor"), C("feet (bottom centre)", "#placeAnchor"), C("Replace image\u2026", "#importReplace")],
          do: "Drop an image on the panel, or click choose a file\u2026. Drag on the image or use the Crop boxes to frame the character; Whole image resets the crop. Under Character position, keep anchor at feet (bottom centre) for a standing character.",
          expect: "The image appears with its crop box. The step 2 (background) panel opens below.",
          watch: "One character per image works best, standing on a plain background. The original file is kept in the project.",
          undo: "Replace image\u2026 starts again with a different picture."
        },
        {
          title: "2 \xB7 Remove the background",
          go: "#bgWork",
          appears: "after an image is loaded",
          controls: [C("method", "#bgMethod"), C("automatic", "#bgMethod"), C("Remove background", "#bgRun"), C("Keep", "#brKeep"), C("Remove", "#brRemove"), C("Undo stroke", "#brUndo"), C("removed area in red", "#bgView")],
          do: "Leave method on automatic and click Remove background. Then fix mistakes with the brush: Keep paints back what should stay, Remove paints away what should go. Set preview to removed area in red to see exactly what goes.",
          expect: "The character stands on a checkerboard (transparent).",
          watch: "Removal is a helper and can cut into the character or keep bits of floor; always check it. OpenCV GrabCut needs the OpenCV library: if it cannot load, the app says so and uses its own tools. A PNG that is already transparent can use keep transparency.",
          undo: "Undo stroke takes back the last brush stroke; Clear brush removes all brush strokes."
        },
        {
          title: "3 \xB7 Convert to pixel art",
          go: "#convWork",
          appears: "after the background step",
          controls: [C("size", "#convHeight"), C("48 px", "#convHeight"), C("colours 16", "#convColours"), C("downsample", "#convResample"), C("Slider", "#cvwSlider"), C("Use as sprite", "#convApply")],
          do: "Choose the sprite size (32, 48, 64 or 96 px tall) and the number of colours. Compare with Original, Pixel art or Slider. When it looks right, click Use as sprite.",
          expect: 'The converted character becomes the "Imported" sprite in the main editor, and step 4 (body parts) opens.',
          watch: 'headroom leaves space above the head for jumps and swings. If your image is already pixel art, use downsample "exact (already pixel art, 1:1)". Using the sprite again later keeps earlier versions.',
          undo: "Pick an earlier version and click Return to this version."
        },
        {
          title: "4 \xB7 Mark the body parts",
          go: "#partsWork",
          appears: "after Use as sprite",
          controls: [C("Rough guess", "#ptGuess"), C("Brush", "#ptBrush"), C("Eraser", "#ptErase"), C("Grow from strokes", "#ptGrow"), C("unassigned in pink", "#ptHighlight"), C("Add part", "#ptAdd"), C("Undo", "#ptUndo")],
          do: "Click Rough guess for a first split into head, torso, arms, legs and so on. Then choose a part in the list and paint with Brush (or Eraser, Lasso, Fill) to correct it. Or paint a few strokes per part and click Grow from strokes.",
          expect: "Each part is tinted its own colour. Pixels in no part show pink when unassigned in pink is ticked.",
          watch: `Rough guess is a guess: check every part, especially hands, weapons and capes. Tick a part's "not in this image" box if the character does not have it. Unassigned pixels never turn with a limb.`,
          undo: "Undo / Redo for each change; Clear all parts starts over."
        },
        {
          title: "5 \xB7 Place the joints and set the rig",
          go: "#rigWork",
          appears: "after body parts exist",
          controls: [C("joint", "#rigBone"), C("moves with", "#rigParent"), C("weapon held in", "#rigHolder"), C("Suggest joints", "#rigSuggest"), C("joint fill", "#rigBleed"), C("Undo", "#rigUndo")],
          do: "Drag each joint handle on the picture to where that part really turns (shoulder, elbow, hip, knee\u2026). Use moves with to say which part each one hangs from, and weapon held in for a weapon. In Layer order (front at the top), use \u25B2 \u25BC to say what is drawn in front.",
          expect: "Blue handles are suggestions that follow the parts; orange ones you moved by hand. The line under the heading says whether the rest pose matches the converted sprite exactly.",
          watch: "Parenting (what moves with what) and drawing order (what is in front) are separate. A hand can belong to the arm and still be drawn behind the torso. joint fill (0 to 4 px) closes small gaps at bends.",
          undo: "Undo / Redo in this step; Suggest joints puts every joint back to a suggestion."
        },
        {
          title: "Check the rig before animating",
          go: "#pfPanel",
          appears: "with parts and joints",
          controls: [C("Rig preflight", "#pfPanel"), C("stress test", "#rigStress"), C("Check every pose", "#rigStressAll"), C("Reset pose", "#rigResetPose"), C("show pixels not from the image", "#rigMade")],
          do: 'Read the Rig preflight at the top of step 6. Each "needs attention" line has a button that opens the place to fix it. In step 5, pick a stress test pose, or click Check every pose, to try hard poses.',
          expect: "Ready / needs attention / not applicable for each check; a list of problems per test pose (gaps, cut-off limbs, a part coming away from its parent).",
          watch: "The checks are helpers: they find common faults, not every one. Look at the previews too. Tick show pixels not from the image to see joint fill and painted areas in colour.",
          undo: "Test poses are previews only and are never saved. Reset pose returns to the exact rest pose."
        },
        {
          title: "6 \xB7 Animate: Template Motion or Manual",
          go: "#anTabs",
          appears: "with parts and joints",
          controls: [C("Template Motion", "#anTabs"), C("Manual", "#anTabs"), C("Add as new animation", "#tmAccept"), C("Cancel", "#tmCancel"), C("Make walk", "#anWalk"), C("Make key", "#anKeyAdd")],
          do: "In Template Motion, click a motion card (Walk, Idle, Sword attack\u2026), check the preview, change frames or speed if you like, and click Add as new animation. In Manual, start from a preset (Make walk, Make idle\u2026) or edit keys: pick a frame, choose a part, set its turn, and click Make key.",
          expect: "A new animation row appears in the main editor and in the sheet.",
          watch: 'A card is greyed out when the rig lacks the parts it needs, and it says which. "this animation faces" (right, left, the viewer) tells presets which way the drawing faces; it cannot turn the character around.',
          undo: "Cancel adds nothing. Undo / Redo in Template Motion and in Manual. Delete animation removes one."
        },
        {
          title: "7 \xB7 Repair hidden areas or edit frames",
          go: "#artWork",
          appears: "with parts and joints",
          controls: [C("New drawing from this part", "#arNew"), C("Fill automatically", "#arAuto"), C("Pencil", "#arPencil"), C("draw order", "#anOrder"), C("Re-render ticked frames from the rig", "#anRerender")],
          do: `When a turn shows a hole where the image had something in front, paint that part's hidden area in step 7 (or try Fill automatically). For a different look of a part, use New drawing from this part and pick it on a key ("drawing"). For one bad frame, edit it in the main editor (Edit pixels, This frame).`,
          expect: 'Painted and drawn pixels are marked "not in the image" in the frame check and the manifest.',
          watch: "Fill automatically is a helper; check its result. You draw what the image did not show; the app never invents it. Frames edited by hand keep their pixels when keys change.",
          undo: "Undo / Redo / Clear in step 7. Re-render ticked frames from the rig replaces hand-edited frames with the rig's frame again."
        },
        {
          title: "Export your animated character",
          go: "#exportPreset",
          controls: [C("Export preset", "#exportPreset"), C("Export .zip", "#presetBtn"), C("Save project", "#saveProject")],
          do: "Export as in the generator tutorial: tick Sheet rows, choose a scale, read the Frame check, then Export .zip with a preset. For Godot, the Godot preset also writes a cutout scene of the rig. Click Save project to keep the image, parts, joints and animations.",
          expect: "A zip with the sheet and data files for your engine.",
          watch: "The project file keeps the original image, so it can be large."
        }
      ]
    },
    {
      id: "workshop",
      mode: "workshop",
      title: "Draw and animate a sprite in the 2.5D Workshop",
      intro: "Draw one sprite by hand, pixel by pixel, in layers, frame by frame, with an isometric (2:1) guide. Switch to the Workshop with the button at the top of the page.",
      note: "The Workshop draws a flat pixel-art picture made to look three-dimensional (isometric). It is not a 3D model: each direction and each frame is drawn by you.",
      steps: [
        {
          title: "Open the Workshop and start a sprite",
          go: "#wsStart",
          controls: [C("2.5D Workshop", "#modeSwitch"), C("Sprite size", "#wsSize"), C("New sprite", "#wsCreate"), C("Open .aseprite", "#wsAseOpen")],
          do: "Click 2.5D Workshop at the top. Choose a Sprite size and click New sprite (or Open .aseprite to bring in an Aseprite file).",
          expect: "An empty canvas with one frame, three layers (Rear, Body, Front) and a palette of shading ramps.",
          watch: "Your Sprite Foundry sprite is not touched. Switch back with the Sprite Foundry button at the top."
        },
        {
          title: "Pick a layer and a colour",
          go: "#wsLayers",
          controls: [C("Add layer", "#wsLayerAdd"), C("Add", "#wsColourAdd"), C("Change selected", "#wsColourSet")],
          do: "In Layers (drawn back to front), choose the layer to draw on: Rear for things behind (far arm, cape), Body, Front for things in front (near arm, weapon). Click a colour in the Palette.",
          expect: "The message under the canvas says which layer you draw on.",
          watch: "A hidden or locked layer cannot be drawn on; the app says why. Changing the palette never repaints pixels already drawn."
        },
        {
          title: "Draw",
          go: "#wsTools",
          controls: [C("Pencil", "#wsTools"), C("Eraser", "#wsTools"), C("Fill", "#wsTools"), C("Highlight", "#wsTools"), C("Shadow", "#wsTools"), C("Line", "#wsTools"), C("isometric guide (2:1)", "#wsIso"), C("Light from", "#wsLight"), C("Undo", "#wsUndo")],
          do: 'Choose Pencil and draw on the canvas. Line with "snap lines to 2:1" makes clean isometric edges. Highlight and Shadow step a pixel lighter or darker along its colour ramp; light the sides facing the sun marker (Light from).',
          expect: "Each stroke is one undo step. The live preview beside the canvas keeps playing.",
          watch: "Keys: B pencil, E eraser, G fill, I eyedropper, H highlight, S shadow, L line, R rectangle, D dither, M select, K brush.",
          undo: "Undo / Redo (Ctrl+Z / Ctrl+Y)."
        },
        {
          title: "Optional: trace over a reference image",
          go: "#wsRefFile",
          controls: [C("Image to trace", "#wsRefFile"), C("Opacity", "#wsRefOpacity"), C("Remove", "#wsRefRemove")],
          do: "Under Reference image, choose an Image to trace. Set its Opacity, position (X, Y) and Scale.",
          expect: "The image shows faintly under your drawing.",
          watch: "It is never drawn into frames or exported; it is saved with the project.",
          undo: "Remove takes it away; each change is an undo step."
        },
        {
          title: "Add frames and play them",
          go: "#wsStrip",
          controls: [C("Add frame", "#wsFrameAdd"), C("Duplicate", "#wsFrameDup"), C("Linked copy", "#wsFrameLink"), C("Delete frame", "#wsFrameDel"), C("Frame time ms", "#wsDur"), C("FPS", "#wsFps"), C("onion skin", "#wsOnion"), C("Play", "#wsPlay")],
          do: "Click Duplicate to copy the frame and change the copy, or Add frame for an empty one. Set FPS, or a Frame time ms for one frame. Tick onion skin to see the previous frame faintly. Click Play.",
          expect: "The frames strip shows each frame; the preview plays them in order.",
          watch: "A Linked copy shares its drawing with the original: editing one changes both. Unlink makes it a separate copy.",
          undo: "Undo returns to the frame shown before the change."
        },
        {
          title: "More animations and directions",
          go: "#wsClipBar",
          controls: [C("Animation", "#wsAnim"), C("New", "#wsAnimNew"), C("Directions", "#wsDirs")],
          do: "Use Animation and New for another animation (walk, attack\u2026). Set Directions to 4 or 8 to draw the sprite facing several ways; tabs appear for each direction.",
          expect: "Each animation and direction has its own frames and becomes its own row in the sheet.",
          watch: 'Each direction is drawn by you. "Mirror to \u2026" can flip your own drawing to the opposite direction; the result is marked "mirrored by you", and asymmetric layers are named so you can fix them.'
        },
        {
          title: "Export the sheet",
          go: "#wsExport",
          controls: [C("Name", "#wsExName"), C("Scale", "#wsExScale"), C("Save PNG", "#wsSavePng"), C("Save JSON", "#wsSaveJson"), C("Save ZIP (PNG, JSON, README)", "#wsSaveZip"), C("Save .aseprite", "#wsSaveAse")],
          do: "Under Export sprite sheet, set a Name, the cell size and Scale. Click Save PNG and Save JSON, or Save ZIP (PNG, JSON, README).",
          expect: "A sheet with a transparent background, each frame in a cell with its feet on the bottom row.",
          watch: "Every layer is exported, also ones hidden in the editor. Save .aseprite writes a file Aseprite can open."
        },
        {
          title: "Save your work",
          go: "#saveProject",
          controls: [C("Sprite Foundry", "#modeSwitch"), C("Save project", "#saveProject")],
          do: "The Workshop is saved in the project file: switch to Sprite Foundry at the top and click Save project.",
          expect: "One .sfproj.json keeps both your Sprite Foundry sprite and your Workshop drawing.",
          watch: "Your work is also kept in this browser between visits."
        }
      ]
    }
  ];
  var MANUAL = [
    // ---------- Sprite Foundry: generator column ----------
    {
      id: "generator",
      mode: "foundry",
      title: "Generator: type, size, outline",
      go: "#typeSeg",
      summary: "Makes a sprite from seeds. The left column of the Sprite Foundry page.",
      items: [
        { ...C("Sprite type", "#typeSeg"), text: "Character, Creature, Ship, Item, RPG Hero, or Imported (your own image, made in Image to pixel art)." },
        { ...C("Sprite size", "#sizeSeg"), text: "12, 16, 24 or 32 px. RPG Hero is always 28 px; Imported uses the size chosen in step 3. Each frame has 2 px of room around the sprite." },
        { ...C("Outline", "#outlineSeg"), text: "Tinted, Black or None. Drawn around the figure in every frame." }
      ]
    },
    {
      id: "seeds",
      mode: "foundry",
      title: "Seeds and variations",
      go: "#shapeSeed",
      summary: "A seed is a word that decides the shape or the colours: the same seeds always make the same sprite.",
      items: [
        { ...C("Shape", "#shapeSeed"), text: "The shape seed. New shape picks a random one." },
        { ...C("Colour", "#colorSeed"), text: "The colour seed. New colours picks a random one." },
        { ...C("New shape", "#reshapeBtn"), text: "A new shape with the same colours." },
        { ...C("New colours", "#recolorBtn"), text: "New colours on the same shape." },
        { ...C("New batch", "#batchBtn"), text: "Variations \xB7 click one to load it: a row of sprites from other seeds. Loading one replaces the sprite (the app asks first if you have edits)." }
      ]
    },
    {
      id: "hero",
      mode: "foundry",
      title: "RPG Hero: class, parts and locks",
      go: "#heroGroup",
      appears: "when RPG Hero is the sprite type",
      summary: "RPG Hero is built from hand-drawn parts (head, body, weapon\u2026) chosen per class.",
      items: [
        { ...C("Class", "#heroGroup"), text: "The class decides which parts can be rolled." },
        { ...C("Randomize unlocked", "#heroRoll"), text: "Rolls every part you have not locked. Picking a part in the list locks it." },
        { ...C("Lock colours", "#lockColours"), text: "Keeps the colours while you roll parts or load variations." }
      ]
    },
    {
      id: "palette",
      mode: "foundry",
      title: "Palettes, custom colours and ramps",
      go: "#palette",
      summary: "The colours frames are drawn with. Changing them redraws frames; stored pixels are not repainted.",
      items: [
        { ...C("Palette", "#palette"), text: "Free colour, PICO-8 \xB7 16, Sweetie 16, Endesga 32, Game Boy \xB7 4, or Custom palette." },
        { ...C("Add colour", "#cpAdd"), text: "Custom palette: add a colour. From sprite takes the sprite's colours; Clear palette empties it." },
        { ...C("Hex list (paste or edit)", "#cpHex"), text: "Paste colour codes, for example a palette copied from lospec.com (the app makes no network calls)." },
        { ...C("Open palette file", "#cpPalFile"), text: "Read a GIMP .gpl, JASC .pal or .hex list file. Save palette writes one in the format chosen." },
        { ...C("Add ramp to palette", "#cpRampAdd"), text: "Ramp builder: shades of one base colour (steps, hue shift): lighter steps lean warm, darker ones cool." }
      ]
    },
    {
      id: "variants",
      mode: "foundry",
      title: "Colour variants",
      go: "#variantGroup",
      summary: "Other colourings of the same sprite (a red team, a night version). The drawing itself never changes.",
      items: [
        { ...C("Add variant", "#varAdd"), text: "Type a name and add it, then set new colours for some of the sprite's colours." },
        { ...C("Rename", "#varRename"), text: "Rename the variant shown." },
        { ...C("Remove", "#varDel"), text: "Remove the variant shown." }
      ],
      more: "The list at the top chooses which variant the preview shows. Exports add one sheet per variant (name_variant.png) that shares the JSON."
    },
    // ---------- Sprite Foundry: preview and timeline ----------
    {
      id: "preview",
      mode: "foundry",
      title: "Preview, playback and view options",
      go: "#stage",
      summary: "The middle column: the sprite playing its animations.",
      items: [
        { ...C("Animation", "#animSeg"), text: "Buttons above the preview choose the animation shown." },
        { ...C("Pause", "#playBtn"), text: "Play / Pause, and the fps slider next to it." },
        { ...C("Background", "#bgSeg"), text: "Clear, Grass, Night or Sand behind the sprite (view only)." },
        { ...C("Fit", "#zoomFit"), text: "\u2212 / Fit / + zoom the preview (view only)." },
        { ...C("Grid", "#gridToggle"), text: "A pixel grid over the preview." },
        { ...C("Onion skin", "#onion"), text: "Earlier frames (back) and later ones (ahead) drawn faintly, optionally tinted red / blue, with an opacity." },
        { ...C("Live preview", "#livePreview"), text: "While you edit pixels, a small preview keeps playing the animation (1\xD7, 2\xD7, 4\xD7)." },
        { ...C("Rotation preview", "#rotPreview"), text: "For a character with several directions: every direction playing the same animation in step." }
      ]
    },
    {
      id: "timeline",
      mode: "foundry",
      title: "Animation frames and timing",
      go: "#strip",
      summary: "The strip under the preview shows the frames of the animation. Click one to show it.",
      items: [
        { ...C("Move \u2190", "#moveLeft"), text: "Move \u2190 / Move \u2192 reorder the frame shown." },
        { ...C("Duplicate", "#dupFrame"), text: "Copy the frame next to itself. Delete removes it." },
        { ...C("Copy", "#copyFrame"), text: "Copy / Paste a frame, also into another sprite." },
        { ...C("Undo", "#tlUndo"), text: "Undo / Redo frame changes." },
        { ...C("Frame ms", "#frameDur"), text: "How long this frame shows. Empty follows the animation's fps." },
        { ...C("Animation fps", "#animFps"), text: "Speed of this animation." },
        { ...C("Plays", "#animMode"), text: "forward, reverse, ping-pong, or ping-pong from the end. With Loop off, \xD7 sets how many times it plays." },
        { ...C("Frame data for games", "#frameData"), text: "Per-frame pivot, hitboxes (deal damage), hurtboxes (take damage) and events (footstep, hit\u2026), exported for game engines." }
      ]
    },
    {
      id: "editor",
      mode: "foundry",
      title: "Pixel editing tools",
      go: "#editBtn",
      summary: "Edit pixels turns the preview into an editor.",
      items: [
        { ...C("Edit pixels", "#editBtn"), text: "Start or stop editing." },
        { ...C("Base pose", "#targetSeg"), text: "Base pose changes the sprite every frame is built from; This frame changes only the frame shown (it then keeps its own pixels)." },
        { ...C("Revert frame", "#revertFrame"), text: "Return the frame shown to its generated pixels." },
        { ...C("Pencil", "#toolSeg"), text: "Tools: Pencil, Eraser, Fill, Pick (eyedropper), Line, Rectangle, Dither, Select, Pan." },
        { ...C("Mirror", "#mirror"), text: "Paint on both sides of an axis at once (left \u2194 right, top \u2194 bottom, both)." },
        { ...C("Pixel-perfect", "#pixelPerfect"), text: "Options: Pixel-perfect lines, Snap lines to 2:1, Filled rectangle, Dither level." },
        { ...C("Sel-out", "#selOut"), text: "With a selection: Copy, Cut, Paste, Flip \u2194, Flip \u2195, Deselect. Sel-out shades a flat outline by what it encloses." },
        { ...C("Undo", "#undoBtn"), text: "Undo / Redo strokes. Discard edits drops every pixel edit." },
        { ...C("Layers \xB7 top first", "#layersPanel"), text: "Which layer (body part) new pixels join; Paint on the selected layer only." },
        { ...C("Replace", "#rcGo"), text: "Replace a colour in this frame, this animation or everywhere." }
      ]
    },
    // ---------- Sprite Foundry: export column ----------
    {
      id: "project",
      mode: "foundry",
      title: "Project: save and open",
      go: "#saveProject",
      summary: "A project file (.sfproj.json) keeps everything editable, including the image work and the Workshop.",
      items: [
        { ...C("Save project", "#saveProject"), text: "Save a project file." },
        { ...C("Open project\u2026", "#openProject"), text: "Open one. It replaces the current work (the app asks first if there are unsaved changes)." }
      ],
      more: "Work is also kept in this browser between visits. Files from a newer version of the app are refused rather than half-opened."
    },
    {
      id: "check",
      mode: "foundry",
      title: "Sheet rows, scale, sheet preview and frame check",
      go: "#findings",
      summary: "What goes into the export, and a check of every frame before it.",
      items: [
        { ...C("Sheet rows", "#animList"), text: "Tick the animations that become rows of the sheet." },
        { ...C("Export scale", "#scaleSeg"), text: "1\xD7, 2\xD7, 4\xD7 or 8\xD7 pixel size." },
        { ...C("Sheet preview", "#sheetCanvas"), text: "The whole sheet as it will be saved, with its size in pixels." },
        { ...C("Frame check", "#findings"), text: "Errors (must be fixed before exporting), warnings and notes per frame; click one to go to that frame. For imported characters it also checks joints, gaps, clipping, parts that come away from the body or are left behind, neighbouring frames that look the same, and pixels not in the image. It also warns when one animation has different frame counts, speeds or loop settings in different directions, when a loop jumps from its last frame back to the first, and when a frame has all four corners filled (background not removed). Duplicate frames are only warned about, never deleted. None of this tells whether a motion looks natural: watch it for sliding feet and crossing limbs." }
      ]
    },
    {
      id: "export",
      mode: "foundry",
      title: "Export formats and settings",
      go: "#exportPreset",
      summary: "Files for games and other tools.",
      items: [
        { ...C("Sheet .png", "#pngBtn"), text: "The sprite sheet image." },
        { ...C("Atlas .json", "#jsonBtn"), text: "Frame positions and times (Aseprite hash layout; Phaser loads it)." },
        { ...C("GIF of current", "#gifBtn"), text: "An animated GIF of the animation shown." },
        { ...C("Aseprite .aseprite", "#aseBtn"), text: "Every animation as a tag, for Aseprite." },
        { ...C("Full pack .zip", "#zipBtn"), text: "Sheet, JSON, GIFs and single frames in one zip." },
        { ...C("Export preset", "#exportPreset"), text: "Phaser, Full pack, Individual PNG frames, Animated GIF previews, Godot 4, Unity, or a trimmed packed atlas. Export .zip writes it with manifest.json." }
      ],
      more: "The Godot and Unity files are checked against their formats; they have not been opened in those engines here. A command line (tools/sf-cli.mjs) writes the same files from a saved project."
    },
    // ---------- Sprite Foundry: Image to pixel art ----------
    {
      id: "directions",
      mode: "foundry",
      title: "Directions (imported characters)",
      go: "#dirBar",
      appears: "after an imported sprite exists",
      summary: "A character can have one image per direction. Steps 1 to 7 work on the direction chosen here.",
      items: [
        { ...C("Add direction", "#dirAddBtn"), text: "Choose a direction under add, then add it; it needs its own image (nothing is rotated or mirrored)." },
        { ...C("Remove this direction", "#dirRemove"), text: "Deletes that direction's image, parts, rig and animations (the app asks first)." },
        { ...C("main image shows", "#dirMain"), text: "Which way the main image faces." }
      ]
    },
    {
      id: "import",
      mode: "foundry",
      title: "1 \xB7 Source image",
      go: "#importDrop",
      summary: "Bring in a picture and frame the character.",
      items: [
        { ...C("choose a file\u2026", "#importPick"), text: "Or drop an image file on the panel." },
        { ...C("Whole image", "#cropAll"), text: "Crop: x, y, width, height (or drag on the image)." },
        { ...C("Fit", "#ivFit"), text: "Preview zoom: \u2212 / Fit / + zoom the picture (view only)." },
        { ...C("anchor", "#placeAnchor"), text: "Character position: feet (bottom centre) or centre, with shift x / y." },
        { ...C("Replace image\u2026", "#importReplace"), text: "Start again with another image." }
      ]
    },
    {
      id: "background",
      mode: "foundry",
      title: "2 \xB7 Background",
      go: "#bgWork",
      appears: "after an image is loaded",
      summary: "Separate the character from its background.",
      items: [
        { ...C("method", "#bgMethod"), text: "automatic, OpenCV GrabCut, edge flood-fill, colour key, keep transparency." },
        { ...C("Remove background", "#bgRun"), text: "Runs the method; tolerance and GrabCut passes tune it." },
        { ...C("Keep", "#brKeep"), text: "Mask brush: Keep / Remove / Off, size, Undo stroke, Clear brush." },
        { ...C("preview", "#bgView"), text: "cut-out on checkerboard, or removed area in red." }
      ]
    },
    {
      id: "convert",
      mode: "foundry",
      title: "3 \xB7 Pixel art",
      go: "#convWork",
      appears: "after the background step",
      summary: "Turn the cut-out into a pixel-art sprite.",
      items: [
        { ...C("size", "#convHeight"), text: "32, 48, 64 or 96 px; headroom and floor leave space above and below." },
        { ...C("colours 16", "#convColours"), text: "Number of colours, or a palette; contrast, saturation, ordered dithering, clean up." },
        { ...C("downsample", "#convResample"), text: "average, majority, or exact (already pixel art, 1:1)." },
        { ...C("lock palette (keep these exact colours)", "#convLock"), text: "Keeps the colours shown." },
        { ...C("Original", "#cvwOrig"), text: "Compare view: Original, Pixel art, Slider." },
        { ...C("Use as sprite", "#convApply"), text: "Make it the Imported sprite. Earlier versions can be restored (Return to this version)." }
      ]
    },
    {
      id: "parts",
      mode: "foundry",
      title: "4 \xB7 Body parts",
      go: "#partsWork",
      appears: "after Use as sprite",
      summary: "Say which pixels belong to which body part. The rig moves these parts.",
      items: [
        { ...C("Rough guess", "#ptGuess"), text: "A first split from the figure's shape; always check it." },
        { ...C("Brush", "#ptBrush"), text: "Tools: Brush, Eraser, Lasso, Fill, with brush and fill tolerance sizes." },
        { ...C("Grow from strokes", "#ptGrow"), text: "Paint a few strokes per part, then grow them to the edges (grow with OpenCV or local)." },
        { ...C("show", "#ptShow"), text: "all parts tinted, chosen part only, image only; unassigned in pink." },
        { ...C("Add part", "#ptAdd"), text: 'A new part (a cape, a tail). Each row: choose to paint it, rename it, "not in this image", \xD7 delete.' },
        { ...C("Duplicate as back limb", "#ptBack"), text: "A darker copy of an arm or leg drawn behind the body (user-made, marked as such)." },
        { ...C("Undo", "#ptUndo"), text: "Undo / Redo; Clear all parts." }
      ]
    },
    {
      id: "rig",
      mode: "foundry",
      title: "5 \xB7 Joints and layers",
      go: "#rigWork",
      appears: "after body parts exist",
      summary: "Where each part turns, what it moves with, and what is drawn in front.",
      items: [
        { ...C("joint", "#rigBone"), text: "The joint to edit; drag its handle on the picture." },
        { ...C("moves with", "#rigParent"), text: "The part this one hangs from." },
        { ...C("weapon held in", "#rigHolder"), text: "The hand (or body) holding a weapon part." },
        { ...C("Suggest joints", "#rigSuggest"), text: "Every joint back to a suggestion from the parts." },
        { ...C("turn 0\xB0", "#rigTurn"), text: "Test pose: turn the chosen joint to check it (preview only). Reset pose." },
        { ...C("stress test", "#rigStress"), text: "Hard test poses checked for gaps, cut-off limbs, parts coming away and draw-order problems; Check every pose. Preview only." },
        { ...C("Layer order (front at the top)", "#rigOrder"), text: "\u25B2 \u25BC change what is drawn in front, for every frame." },
        { ...C("joint fill", "#rigBleed"), text: "0 to 4 px of colour spread under neighbours to close gaps at bends." },
        { ...C("unassigned pixels stay unassigned on purpose (they move with the whole body)", "#rigKeepUn"), text: "Tells the preflight the unassigned pixels are intended." },
        { ...C("show pixels not from the image", "#rigMade"), text: "Tints joint fill and painted pixels in the pose preview." }
      ]
    },
    {
      id: "preflight",
      mode: "foundry",
      title: "Rig preflight",
      go: "#pfPanel",
      appears: "with parts and joints",
      summary: "At the top of step 6: is the rig ready to animate? Ready / needs attention / not applicable for pixels in parts, hierarchy, joint placement, parts for the chosen motion, the weapon in a hand, and the rest pose. Each problem has a button to the step that fixes it.",
      items: [{ ...C("Rig preflight", "#pfPanel"), text: "Read-only: it never changes the rig." }]
    },
    {
      id: "manual",
      mode: "foundry",
      title: "6 \xB7 Manual animation",
      go: "#anManual",
      appears: "with parts and joints",
      summary: "Keyframes: poses at some frames; the frames between are filled in.",
      items: [
        { ...C("this animation faces", "#anFacing"), text: "right, left or the viewer; presets use it. It cannot turn the character." },
        { ...C("Make walk", "#anWalk"), text: "Presets: Make idle, Make walk, Make sword attack, Make run, Make jump, Make hurt, Make death." },
        { ...C("animation", "#anName"), text: "The animation edited; frames, fps, stretch keys, loop, smooth turns, Delete animation." },
        { ...C("Make key", "#anKeyAdd"), text: "Key at this frame: Make key / Delete key, then (how motion leaves it), hold frames, Copy pose, Paste pose, Mirror L\u2194R, Undo, Redo." },
        { ...C("part", "#anBone"), text: "Pose: the part, its turn (or drag on the preview), nudge x / y, body x / y, drawing, draw order, smear." },
        { ...C("draw order", "#anOrder"), text: "From this key to the next: the part in front of, or behind, every other part." },
        { ...C("Make it trail", "#anFollow"), text: "Secondary motion: the part trails behind what it hangs from (cape, hair, tail)." },
        { ...C("Re-render ticked frames from the rig", "#anRerender"), text: "Frames edited by hand keep their pixels; this replaces them with the rig's frame." },
        { ...C("show pixels not from the image", "#anMade"), text: "Tints joint fill, hidden areas, drawings, back limbs and smears; says when a frame was edited by hand." }
      ]
    },
    {
      id: "template",
      mode: "foundry",
      title: "6 \xB7 Template Motion",
      go: "#anTabs",
      appears: "with parts and joints",
      summary: "Ready-made motions fitted to your rig, previewed before anything is added.",
      items: [
        { ...C("Template Motion", "#anTabs"), text: "The tab beside Manual." },
        { ...C("Template motions", "#anTemplate"), text: "Filter by category, click a card (greyed out cards say which parts are missing)." },
        { ...C("frames", "#tmFrames"), text: "Motion settings: frames, speed fps, loop; Undo, Redo, Defaults." },
        { ...C("add to", "#tmAddTo"), text: "this direction, or every direction with artwork." },
        { ...C("Add as new animation", "#tmAccept"), text: "Adds it under the name in new animation. Cancel adds nothing." }
      ]
    },
    {
      id: "art",
      mode: "foundry",
      title: "7 \xB7 Drawings and hidden areas",
      go: "#artWork",
      appears: "with parts and joints",
      summary: "Your own art for what the image does not show.",
      items: [
        { ...C("part", "#arPart"), text: "The part to draw for; edit chooses its hidden area or one of its drawings." },
        { ...C("New drawing from this part", "#arNew"), text: "An alternate drawing of the part (an open hand), picked on keys. Rename, Delete drawing." },
        { ...C("Pencil", "#arPencil"), text: "Pencil / Eraser with the palette; Undo, Redo, Clear." },
        { ...C("Fill automatically", "#arAuto"), text: "Hidden area: guesses what is behind a part (OpenCV inpaint or nearest colour); check the result." }
      ]
    },
    // ---------- 2.5D Workshop ----------
    {
      id: "ws-start",
      mode: "workshop",
      title: "Workshop: start, open, undo",
      go: "#wsStart",
      summary: "The 2.5D Workshop page (button at the top). One hand-drawn sprite.",
      items: [
        { ...C("New sprite", "#wsCreate"), text: "An empty sprite of the Sprite size chosen (32, 48, 64 or 96 px)." },
        { ...C("Open .aseprite", "#wsAseOpen"), text: "Bring in an Aseprite file (layers, tags, frame times); what cannot come in is listed." },
        { ...C("Undo", "#wsUndo"), text: "Undo / Redo every change (Ctrl+Z / Ctrl+Y)." }
      ]
    },
    {
      id: "ws-anims",
      mode: "workshop",
      title: "Workshop: animations and directions",
      go: "#wsClipBar",
      appears: "after New sprite",
      summary: "Several animations, each in 1, 4 or 8 directions.",
      items: [
        { ...C("Animation", "#wsAnim"), text: "The animation shown; New, Rename, Remove." },
        { ...C("Directions", "#wsDirs"), text: "1, 4 (S, E, N, W) or 8. Tabs choose the direction you draw." },
        { ...C("Mirror", "#wsMirrorDir"), text: '"Mirror to \u2026" flips your own drawing to the opposite direction, marked "mirrored by you".' },
        { ...C("This frame in every direction", "#wsViews"), text: "With several directions: the same frame in each direction side by side." },
        { ...C("Workshop rotation preview", "#wsRotPreview"), text: "Every direction with a drawing, playing in step (around, or in a row)." }
      ]
    },
    {
      id: "ws-frames",
      mode: "workshop",
      title: "Workshop: frames and playback",
      go: "#wsStrip",
      appears: "after New sprite",
      summary: "The frames of the animation shown.",
      items: [
        { ...C("Add frame", "#wsFrameAdd"), text: "Add frame, Duplicate, Linked copy (shares its drawing), Unlink, Delete frame, \u25C0 Move, Move \u25B6." },
        { ...C("Frame time ms", "#wsDur"), text: "This frame's time; empty follows FPS." },
        { ...C("Play", "#wsPlay"), text: "Play / Stop; loop, plays (forward, reverse, ping-pong\u2026), \xD7, FPS." },
        { ...C("onion skin", "#wsOnion"), text: "Earlier (and with next frame too, later) frames faintly; back, ahead, tint, opacity." },
        { ...C("Workshop live preview", "#wsLive"), text: "Keeps playing beside the canvas while you draw." }
      ]
    },
    {
      id: "ws-tools",
      mode: "workshop",
      title: "Workshop: drawing tools and view",
      go: "#wsTools",
      appears: "after New sprite",
      summary: "Tools for the canvas.",
      items: [
        { ...C("Pencil", "#wsTools"), text: "Pencil (B), Eraser (E), Fill (G), Eyedropper (I), Highlight (H), Shadow (S), Line (L), Rectangle (R), Dither (D), Select (M), Brush (K)." },
        { ...C("pixel-perfect", "#wsPerfect"), text: "Options: pixel-perfect, snap lines to 2:1, filled rectangle, dither, dither the brush, mirror." },
        { ...C("Brush from selection", "#wsMakeBrush"), text: "With a selection: Copy, Cut, Paste, Flip \u2194, Flip \u2195, Deselect, Sel-out, and a stamp brush from the selection." },
        { ...C("Zoom", "#wsZoom"), text: "Zoom, pixel grid, isometric guide (2:1)." },
        { ...C("Light from", "#wsLight"), text: "Where the light comes from (the sun marker); Highlight and Shadow follow colour ramps." }
      ]
    },
    {
      id: "ws-ref",
      mode: "workshop",
      title: "Workshop: reference image",
      go: "#wsRefFile",
      appears: "after New sprite",
      summary: "A picture under your drawing to trace. Never exported.",
      items: [
        { ...C("Image to trace", "#wsRefFile"), text: "Choose the image; then show, Opacity, X, Y, Scale, Remove." }
      ]
    },
    {
      id: "ws-layers",
      mode: "workshop",
      title: "Workshop: layers",
      go: "#wsLayers",
      appears: "after New sprite",
      summary: "Layers (drawn back to front): Rear, Body, Front to start with.",
      items: [
        { ...C("Add layer", "#wsLayerAdd"), text: "Up to 8 named layers. Each row: choose it, Hide, Lock, \u25B2 \u25BC, Rename, \u2715." }
      ]
    },
    {
      id: "ws-palette",
      mode: "workshop",
      title: "Workshop: palette, ramps, variants, replace",
      go: "#wsSwatches",
      appears: "after New sprite",
      summary: "The colours you draw with.",
      items: [
        { ...C("Add", "#wsColourAdd"), text: "Add, Change selected, Remove selected colour. Changing the palette never repaints drawn pixels." },
        { ...C("Use palette", "#wsPalLoad"), text: "Load a preset Palette; Open palette file, Save palette." },
        { ...C("Add ramp", "#wsRampAdd"), text: "Ramp builder (steps, hue shift)." },
        { ...C("Add variant", "#wsVarAdd"), text: "Colour variants, exported as extra sheets; Rename, Remove." },
        { ...C("Replace", "#wsReplace"), text: "Replace the current colour in this frame, this animation or every animation." }
      ]
    },
    {
      id: "ws-rig",
      mode: "workshop",
      title: "Workshop: animate with the rig",
      go: "#wsRigSend",
      appears: "after New sprite",
      summary: "Send a drawn frame to Image to pixel art, to give it parts and joints and use Template Motion.",
      items: [{ ...C("Use this frame in Image to pixel art", "#wsToRig"), text: "Converted pixel for pixel; your drawing here is not changed." }]
    },
    {
      id: "ws-export",
      mode: "workshop",
      title: "Workshop: export and UI slices",
      go: "#wsExport",
      appears: "after New sprite",
      summary: "Export sprite sheet (transparent background).",
      items: [
        { ...C("Name", "#wsExName"), text: "File name; Cell size, Columns, Spacing, Margin, Scale." },
        { ...C("Add slice from selection", "#wsSliceAdd"), text: "UI slices: a named rectangle (a button, a panel), with 9-slice insets; exported in the JSON and as a Godot StyleBoxTexture." },
        { ...C("Save PNG", "#wsSavePng"), text: "Save PNG, Save JSON, Save ZIP (PNG, JSON, README), Save .aseprite." }
      ]
    }
  ];
  var GLOSSARY = [
    ["Sprite", "A small picture of a character or object used in a game."],
    ["Frame", "One picture of an animation. Playing frames one after another makes the motion."],
    ["Animation", "A set of frames that play in order, such as idle, walk or attack."],
    ["Sprite sheet", "One image holding all frames in a grid, with a JSON file saying where each frame is. Game engines load it."],
    ["Seed", "A word that decides the generator's shape or colours. The same seed always gives the same result."],
    ["Palette", "The set of colours a sprite uses."],
    ["Colour ramp", "Shades of one colour from light to dark, used for highlights and shadows."],
    ["Pivot", "The point a game places and turns the sprite around; here the bottom centre (the feet) unless you set one per frame."],
    ["Joint", "The point where a body part turns, such as an elbow or a knee."],
    ["Rig", "The body parts of an imported character, their joints, and what each part moves with."],
    ["Key (keyframe)", "A frame where you set a pose. The frames between keys are filled in from them."],
    ["Onion skin", "Earlier (or later) frames drawn faintly under the current one, to compare poses."],
    ["Hitbox", "A rectangle on a frame where an attack deals damage."],
    ["Hurtbox", "A rectangle on a frame where the character can be hit."],
    ["FPS", "Frames per second: how fast an animation plays."],
    ["2.5D / isometric", "A flat drawing made to look three-dimensional, with lines at a 2:1 slope. The Workshop draws 2.5D pixel art, not a 3D model."],
    ["Variant", "The same sprite in other colours."],
    ["9-slice", "A UI picture cut into 9 pieces so the corners stay sharp when it stretches."],
    ["Hidden area", "Pixels a part covers in the image. When the part moves they show; you paint them in step 7."]
  ];
  var LIMITS = [
    "The 2.5D Workshop draws a flat sprite that looks isometric; it is not a 3D model. Every direction and frame is drawn by you.",
    "Image rigging moves and turns the parts you assign. One image cannot show the back, the sides, or details it does not contain: add an image per direction, or paint hidden areas yourself.",
    "Background removal, Rough guess, Suggest joints, Fill automatically, the rig preflight and the frame check are helpers. They give a starting point and catch common problems; check their results.",
    'Nothing in Help changes your sprite: tutorials are instructions only, and "Show me" only scrolls to the control.'
  ];

