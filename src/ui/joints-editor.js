  // src/ui/joints-editor.js
  // V8.0b: the joints Convert used, on the character, per direction. Drag a joint that is off; or,
  // when the pose model found nothing (or you press Click them all again), click the 14 joints in
  // order. "Use these joints" cuts the body parts again and remakes that direction's animations.
  var JOINT_LINES = [["head", "neck"], ["neck", "shoulderL"], ["neck", "shoulderR"], ["shoulderL", "elbowL"], ["elbowL", "wristL"], ["shoulderR", "elbowR"], ["elbowR", "wristR"], ["shoulderL", "hipL"], ["shoulderR", "hipR"], ["hipL", "hipR"], ["hipL", "kneeL"], ["kneeL", "ankleL"], ["hipR", "kneeR"], ["kneeR", "ankleR"]];
  function initJointsEditor({ $: $2, imageOf, onUse }) {
    const canvas = $2("#qcJointsCanvas"), ctx = canvas.getContext("2d");
    // per direction: { pts: {name: [x, y]} (work px), source: "model" | "click" | "guess", note, S }
    const st = { dirs: {}, dir: null, drag: null, img: null, scale: 1 };
    const cur = () => st.dirs[st.dir];
    const missing = () => POSE_CLICKS.filter(([k]) => !(cur().pts && cur().pts[k]));
    async function show(dir) {
      st.dir = dir;
      const d = cur();
      $2("#qcJoints").hidden = false;
      $2("#qcJointsDir").replaceChildren(...Object.keys(st.dirs).map((k) => new Option(`${DIRECTION_LABEL[k]} (${k})`, k)));
      $2("#qcJointsDir").value = dir;
      const im = await imageOf(dir);
      if (st.dir !== dir || !im) return;
      const src = document.createElement("canvas");
      src.width = src.height = im.S;
      src.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(im.rgba), im.S, im.S), 0, 0);
      st.img = src;
      d.S = im.S;
      st.scale = Math.max(0.5, Math.min(2, 360 / im.S));
      canvas.width = canvas.height = Math.round(im.S * st.scale);
      render();
    }
    function render() {
      const d = cur();
      if (!d || !st.img) return;
      const k = st.scale, todo = missing();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(st.img, 0, 0, canvas.width, canvas.height);
      const p = d.pts || {};
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#16a34a";
      for (const [a, b] of JOINT_LINES) if (p[a] && p[b]) {
        ctx.beginPath();
        ctx.moveTo(p[a][0] * k, p[a][1] * k);
        ctx.lineTo(p[b][0] * k, p[b][1] * k);
        ctx.stroke();
      }
      for (const [name, v] of Object.entries(p)) {
        ctx.fillStyle = /L$/.test(name) ? "#dc2626" : /R$/.test(name) ? "#2563eb" : "#111827";
        ctx.beginPath();
        ctx.arc(v[0] * k, v[1] * k, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
      $2("#qcJointsInfo").textContent = todo.length ? `Click ${todo[0][1]} (${POSE_CLICKS.length - todo.length + 1} of ${POSE_CLICKS.length}).${d.note ? " " + d.note : ""}` : `${d.source === "model" ? "Found by the pose model" : d.source === "click" ? "Placed by you" : "Guessed"}${d.note ? ": " + d.note : ""}. Drag a joint that is off (red: left of the picture, blue: right), then Use these joints.`;
      $2("#qcJointsUse").disabled = !!todo.length;
    }
    const at = (e) => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) * (canvas.width / r.width) / st.scale, (e.clientY - r.top) * (canvas.height / r.height) / st.scale];
    };
    canvas.addEventListener("pointerdown", (e) => {
      const d = cur();
      if (!d || !st.img) return;
      const p = at(e), todo = missing();
      if (todo.length) {
        d.pts = { ...d.pts || {}, [todo[0][0]]: p };
        d.source = "click";
        render();
        return;
      }
      let best = null, bd = 12 / st.scale;
      for (const [name, v] of Object.entries(d.pts)) {
        const dd = Math.hypot(v[0] - p[0], v[1] - p[1]);
        if (dd < bd) {
          bd = dd;
          best = name;
        }
      }
      if (best) {
        st.drag = best;
        canvas.setPointerCapture(e.pointerId);
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!st.drag) return;
      cur().pts[st.drag] = at(e);
      if (cur().source === "model") cur().source = "click";
      render();
    });
    canvas.addEventListener("pointerup", () => {
      st.drag = null;
    });
    $2("#qcJointsDir").addEventListener("change", (e) => show(e.target.value));
    $2("#qcJointsClick").addEventListener("click", () => {
      cur().pts = null;
      cur().note = "";
      render();
    });
    $2("#qcJointsUse").addEventListener("click", () => {
      if (!missing().length) onUse(st.dir, JSON.parse(JSON.stringify(cur().pts)));
    });
    return {
      // set the joints of a direction (pts null: to be clicked)
      set(dir, pts, source, note = "") {
        st.dirs[dir] = { pts, source, note };
      },
      clear() {
        st.dirs = {};
        st.dir = null;
        $2("#qcJoints").hidden = true;
      },
      show,
      info: () => ({ dir: st.dir, dirs: JSON.parse(JSON.stringify(st.dirs)), todo: st.dir ? missing().map(([k]) => k) : [] })
    };
  }
