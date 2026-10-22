  // src/core/playback.js
  var PLAY_MODES = ["forward", "reverse", "pingpong", "pingpongReverse"];
  var MODE_LABEL = { forward: "forward", reverse: "reverse", pingpong: "ping-pong", pingpongReverse: "ping-pong, starting at the end" };
  var ASEPRITE_DIRECTION = { forward: "forward", reverse: "reverse", pingpong: "pingpong", pingpongReverse: "pingpong_reverse" };
  var MAX_REPEAT = 99;
  var PING = (m) => m === "pingpong" || m === "pingpongReverse";
  var asepriteRepeat = (mode, loop, repeat = 1) => loop ? 0 : PING(mode) ? 2 * repeat : repeat;
  function fromAsepriteRepeat(mode, r) {
    if (!r) return { loop: true, repeat: 1 };
    if (!PING(mode)) return { loop: false, repeat: Math.min(MAX_REPEAT, r) };
    return { loop: false, repeat: Math.min(MAX_REPEAT, Math.ceil(r / 2)), ...r % 2 ? { odd: true } : {} };
  }
  function playOrder(n, mode = "forward") {
    const f = Array.from({ length: n }, (_, i) => i), r = f.slice().reverse();
    if (n < 3 && (mode === "pingpong" || mode === "pingpongReverse")) return mode === "pingpong" ? f : r;
    if (mode === "reverse") return r;
    if (mode === "pingpong") return [...f, ...r.slice(1, -1)];
    if (mode === "pingpongReverse") return [...r, ...f.slice(1, -1)];
    return f;
  }
  function playSequence(n, { mode = "forward", loop = true, repeat = 1 } = {}) {
    const cycle = playOrder(n, mode);
    if (loop) return cycle;
    const out = [];
    for (let k = 0; k < Math.max(1, repeat); k++) out.push(...cycle);
    if ((mode === "pingpong" || mode === "pingpongReverse") && n >= 3) out.push(cycle[0]);
    return out;
  }
  function step(pos, n, opts2) {
    const seq = playSequence(n, opts2);
    if (pos + 1 < seq.length) return { pos: pos + 1, frame: seq[pos + 1], done: false };
    if (opts2.loop) return { pos: 0, frame: seq[0], done: false };
    return { pos, frame: seq[pos], done: true };
  }
  var posOf = (frame, n, opts2) => Math.max(0, playSequence(n, opts2).indexOf(frame));
  var modeOf = (a) => a && PLAY_MODES.includes(a.mode) ? a.mode : "forward";
  var repeatOf = (a) => a && Number.isInteger(a.repeat) && a.repeat >= 1 ? Math.min(MAX_REPEAT, a.repeat) : 1;
  var playOpts = (a) => ({ mode: modeOf(a), loop: !!(a && a.loop), repeat: repeatOf(a) });

