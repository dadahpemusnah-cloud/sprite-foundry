// Copies the pose model files the page loads (src/ui/pose-detect.js) into dist/pose/:
// vision_bundle.mjs, wasm/vision_wasm_internal.js and .wasm (npm @mediapipe/tasks-vision) and
// pose_landmarker_full.task (vendor/pose). Publish them next to index.html as pose/<same path>.
import fs from 'node:fs';
const out = 'dist/pose', mp = 'node_modules/@mediapipe/tasks-vision';
export const POSE_FILES = { 'vision_bundle.mjs': `${mp}/vision_bundle.mjs`, 'wasm/vision_wasm_internal.js': `${mp}/wasm/vision_wasm_internal.js`, 'wasm/vision_wasm_internal.wasm': `${mp}/wasm/vision_wasm_internal.wasm`, 'pose_landmarker_full.task': 'vendor/pose/pose_landmarker_full.task' };
if (import.meta.url === `file://${process.argv[1]}`) {
  fs.mkdirSync(`${out}/wasm`, { recursive: true });
  for (const [to, from] of Object.entries(POSE_FILES)) fs.copyFileSync(from, `${out}/${to}`);
  console.log(`pose files in ${out}: ${Object.keys(POSE_FILES).join(', ')}`);
}
