  // src/workshop/frames.js
  var copyFrame = (f) => ({ dur: f.dur, layers: Object.fromEntries(Object.keys(f.layers).map((l) => [l, f.layers[l].slice()])) });
  function addFrame(ws, i) {
    if (ws.frames.length >= MAX_FRAMES) return ws;
    const next = nextWorkshop(ws);
    next.frames.splice(i + 1, 0, blankFrame(ws.size, layerIds(ws)));
    return next;
  }
  function duplicateFrame2(ws, i) {
    if (ws.frames.length >= MAX_FRAMES || !ws.frames[i]) return ws;
    const next = nextWorkshop(ws);
    next.frames.splice(i + 1, 0, copyFrame(ws.frames[i]));
    return next;
  }
  function linkFrame(ws, i) {
    if (ws.frames.length >= MAX_FRAMES || !ws.frames[i]) return ws;
    const f = ws.frames[i], next = nextWorkshop(ws);
    next.frames.splice(i + 1, 0, { dur: f.dur, layers: f.layers });
    return next;
  }
  var linkedWith = (ws, i) => ws.frames[i] ? ws.frames.flatMap((g, j) => j !== i && g.layers === ws.frames[i].layers ? [j] : []) : [];
  function unlinkFrame(ws, i) {
    if (!linkedWith(ws, i).length) return ws;
    const next = nextWorkshop(ws);
    next.frames[i] = copyFrame(ws.frames[i]);
    return next;
  }
  function deleteFrame2(ws, i) {
    if (ws.frames.length <= 1 || !ws.frames[i]) return ws;
    const next = nextWorkshop(ws);
    next.frames.splice(i, 1);
    return next;
  }
  function moveFrame2(ws, i, d) {
    const j = i + d;
    if (!ws.frames[i] || j < 0 || j >= ws.frames.length) return ws;
    const next = nextWorkshop(ws);
    [next.frames[i], next.frames[j]] = [next.frames[j], next.frames[i]];
    return next;
  }
  function setFrameDuration2(ws, i, ms) {
    if (!ws.frames[i]) return ws;
    const v = ms === null || ms === "" ? null : Math.round(Number(ms));
    if (v !== null && !(v >= 10 && v <= 1e4)) return ws;
    if (ws.frames[i].dur === v) return ws;
    const next = nextWorkshop(ws);
    next.frames[i] = { ...next.frames[i], dur: v };
    return next;
  }
  function setFps(ws, fps) {
    const v = Math.round(Number(fps));
    if (!(v >= 1 && v <= 60) || v === ws.fps) return ws;
    const next = nextWorkshop(ws);
    next.fps = v;
    return next;
  }
  function setLoop(ws, loop) {
    if (!!loop === ws.loop) return ws;
    const next = nextWorkshop(ws);
    next.loop = !!loop;
    return next;
  }
  function setMode(ws, mode) {
    if (!PLAY_MODES.includes(mode) || (ws.mode || "forward") === mode) return ws;
    const next = nextWorkshop(ws);
    if (mode === "forward") delete next.mode;
    else next.mode = mode;
    return next;
  }
  function setRepeat(ws, repeat) {
    const v = Math.round(Number(repeat));
    if (!(v >= 1 && v <= MAX_REPEAT) || (ws.repeat || 1) === v) return ws;
    const next = nextWorkshop(ws);
    if (v === 1) delete next.repeat;
    else next.repeat = v;
    return next;
  }

