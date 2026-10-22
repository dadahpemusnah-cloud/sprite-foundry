# Sprite Foundry

Single-page pixel-art sprite generator, published as a claude.ai artifact
(https://claude.ai/artifact/4JLKVQW2UiUfrcx2M7HnGG). Plain JavaScript, no framework.

- Edit `src/**.js` (one file per module, joined in `src/order.json` order) and `page/head.html`
  (markup + CSS) / `page/tail.html`. Then `npm run build` writes `index.html`.
- Never edit `index.html` by hand: `npm run check:build` fails if it differs from the build.
- Modules share one scope (they are concatenated inside one IIFE, not imported). A name defined
  in one module is visible in later ones; keep new names unique.
- Test hooks for browser tests live on `window.__sf` (end of `src/app.js`).
- Plans: `PLAN-V6.md`.
- Tests: `npm test` (build check, export baseline, editor smoke, template directions, Godot cutout;
  the Godot steps need `GODOT=<godot4 binary>`, e.g. Godot_v4.3-stable_linux.x86_64 from the
  godotengine GitHub releases). `tests/run-mutants.sh` checks the Godot tests still catch seeded bugs.
- An intended export change: `node tests/baseline-exports.mjs --update`, and say why in the commit.
- cdnjs is blocked in cloud sessions: browser tests serve JSZip from node_modules (see tests/godot-export.mjs).
