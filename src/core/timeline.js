  // src/core/timeline.js
  function createTimeline(sprite3) {
    const anims = {};
    for (const name of Object.keys(sprite3.anims)) {
      const meta = sprite3.animMeta && sprite3.animMeta[name] || {};
      anims[name] = { fps: meta.fps ?? null, loop: meta.loop ?? true, frames: sprite3.anims[name].map((spec) => ({ spec, px: null, dur: null })) };
    }
    return { order: Object.keys(sprite3.anims), anims };
  }
  var frameCount = (tl, name) => tl.anims[name] ? tl.anims[name].frames.length : 0;
  function frameMs(tl, name, i, globalFps) {
    const a = tl.anims[name], f = a.frames[i];
    return f.dur != null ? f.dur : 1e3 / (a.fps || globalFps);
  }
  var frameDurationMs = (tl, name, i, globalFps) => {
    const a = tl.anims[name], f = a.frames[i];
    return f.dur != null ? Math.round(f.dur) : Math.round(1e3 / (a.fps || globalFps));
  };
  var frameDelayCs = (tl, name, i, globalFps) => {
    const a = tl.anims[name], f = a.frames[i];
    return Math.max(2, f.dur != null ? Math.round(f.dur / 10) : Math.round(100 / (a.fps || globalFps)));
  };
  function framePixels(sprite3, frame, opts2) {
    return frame.px ? frame.px : renderFrame(sprite3, frame.spec, opts2);
  }
  var withAnim = (tl, name, fn) => {
    if (!tl.anims[name]) return tl;
    const next = fn(tl.anims[name]);
    return next === tl.anims[name] ? tl : { ...tl, anims: { ...tl.anims, [name]: next } };
  };
  var inRange = (a, i) => Number.isInteger(i) && i >= 0 && i < a.frames.length;
  function moveFrame(tl, name, from, to) {
    return withAnim(tl, name, (a) => {
      if (!inRange(a, from) || !inRange(a, to) || from === to) return a;
      const frames = a.frames.slice();
      const [f] = frames.splice(from, 1);
      frames.splice(to, 0, f);
      return { ...a, frames };
    });
  }
  function duplicateFrame(tl, name, i) {
    return withAnim(tl, name, (a) => {
      if (!inRange(a, i)) return a;
      const frames = a.frames.slice();
      frames.splice(i + 1, 0, { ...a.frames[i] });
      return { ...a, frames };
    });
  }
  function deleteFrame(tl, name, i) {
    return withAnim(tl, name, (a) => {
      if (!inRange(a, i) || a.frames.length <= 1) return a;
      const frames = a.frames.slice();
      frames.splice(i, 1);
      return { ...a, frames };
    });
  }
  function insertFrames(tl, name, at, newFrames) {
    return withAnim(tl, name, (a) => {
      const pos = Math.max(0, Math.min(a.frames.length, at));
      const frames = a.frames.slice();
      frames.splice(pos, 0, ...newFrames.map((f) => ({ spec: f.spec ?? null, px: f.px ?? null, dur: f.dur ?? null, ...f.data ? { data: f.data } : {} })));
      return { ...a, frames };
    });
  }
  function setFrame(tl, name, i, patch) {
    return withAnim(tl, name, (a) => {
      if (!inRange(a, i)) return a;
      const frames = a.frames.slice();
      frames[i] = { ...frames[i], ...patch };
      return { ...a, frames };
    });
  }
  var bakeFrame = (tl, name, i, px) => setFrame(tl, name, i, { px });
  function setFrameData(tl, name, i, data) {
    return withAnim(tl, name, (a) => {
      if (!inRange(a, i)) return a;
      const frames = a.frames.slice(), { data: _old, ...rest } = frames[i];
      frames[i] = data ? { ...rest, data } : rest;
      return { ...a, frames };
    });
  }
  function revertFrame(tl, name, i) {
    const a = tl.anims[name];
    if (!a || !inRange(a, i) || !a.frames[i].spec) return tl;
    return setFrame(tl, name, i, { px: null });
  }
  function setFrameDuration(tl, name, i, ms) {
    const dur = ms == null ? null : Number(ms);
    if (dur != null && !(Number.isFinite(dur) && dur > 0)) return tl;
    return setFrame(tl, name, i, { dur });
  }
  function setAnimFps(tl, name, fps) {
    const v = fps == null ? null : Number(fps);
    if (v != null && !(Number.isFinite(v) && v > 0)) return tl;
    return withAnim(tl, name, (a) => ({ ...a, fps: v }));
  }
  var setAnimLoop = (tl, name, loop) => withAnim(tl, name, (a) => ({ ...a, loop: !!loop }));
  function setAnimMode(tl, name, mode) {
    if (!PLAY_MODES.includes(mode)) return tl;
    return withAnim(tl, name, (a) => {
      if ((a.mode || "forward") === mode) return a;
      const { mode: _m, ...rest } = a;
      return mode === "forward" ? rest : { ...rest, mode };
    });
  }
  function setAnimRepeat(tl, name, repeat) {
    const v = Math.round(Number(repeat));
    if (!(v >= 1 && v <= MAX_REPEAT)) return tl;
    return withAnim(tl, name, (a) => {
      if ((a.repeat || 1) === v) return a;
      const { repeat: _r, ...rest } = a;
      return v === 1 ? rest : { ...rest, repeat: v };
    });
  }

