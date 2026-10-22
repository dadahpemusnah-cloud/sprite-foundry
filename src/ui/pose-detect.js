  // src/ui/pose-detect.js
  // V8.0b: finds the body pose in a character picture with MediaPipe Pose Landmarker (Apache 2.0),
  // run in the browser. Its files are published next to the page under pose/ (vision_bundle.mjs,
  // wasm/vision_wasm_internal.js and .wasm, pose_landmarker_full.task); see tools/pose-files.mjs.
  // Nothing leaves the browser. If the files cannot load, Convert falls back to clicked joints.
  var POSE_BASE = "pose/";
  var poseModel = null;
  function loadPoseModel() {
    if (!poseModel) poseModel = (async () => {
      const base = new URL(POSE_BASE, document.baseURI).href;
      const vision = await import(base + "vision_bundle.mjs");
      const files = await vision.FilesetResolver.forVisionTasks(base + "wasm");
      return vision.PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: base + "pose_landmarker_full.task", delegate: "CPU" }, runningMode: "IMAGE", numPoses: 1 });
    })().catch((e) => {
      poseModel = null;
      throw e;
    });
    return poseModel;
  }
  // the 33 landmarks of the character in a work image (RGBA, S×S), or null when no body is found
  async function detectPose(rgba, S) {
    const model = await loadPoseModel(), src = document.createElement("canvas"), c = document.createElement("canvas");
    // on white, as a picture would be, and at least 512 px (a small sprite's work image is 128 px)
    const Z = Math.max(S, 512);
    src.width = src.height = S;
    c.width = c.height = Z;
    src.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(rgba), S, S), 0, 0);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, Z, Z);
    ctx.drawImage(src, 0, 0, Z, Z);
    const r = model.detect(c), lm = r && r.landmarks && r.landmarks[0];
    return lm ? lm.map((l) => ({ x: l.x, y: l.y, visibility: l.visibility == null ? 1 : l.visibility })) : null;
  }
