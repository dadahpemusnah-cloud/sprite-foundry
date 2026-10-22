# Pose model (V8.0b)

`pose_landmarker_full.task`: MediaPipe Pose Landmarker (full, float16), Apache License 2.0, by Google.
Downloaded from
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
on 2026-10-22 (sha256 in the commit message that added it).

The runtime (`vision_bundle.mjs`, `wasm/vision_wasm_internal.{js,wasm}`) comes from the npm package
`@mediapipe/tasks-vision` (Apache 2.0). `node tools/pose-files.mjs` copies all four into `dist/pose/`,
which is published next to `index.html` as `pose/...`.
