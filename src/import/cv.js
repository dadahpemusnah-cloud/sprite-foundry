  // src/import/cv.js
  var OPENCV_VERSION = "4.10.0-release.1";
  var OPENCV_URL = `https://cdn.jsdelivr.net/npm/@techstark/opencv-js@${OPENCV_VERSION}/dist/opencv.js`;
  function grabCutMask(cv, img, hints, opts2) {
    const w2 = img.width, h = img.height, d = img.data, iterations = opts2 && opts2.iterations || 5;
    const KEEP = 1, REMOVE = 2;
    const src = new cv.Mat(h, w2, cv.CV_8UC3), mask = new cv.Mat(h, w2, cv.CV_8UC1);
    const bgd = new cv.Mat(), fgd = new cv.Mat();
    try {
      const s = src.data, m = mask.data, ring = Math.max(2, Math.round(Math.min(w2, h) * 0.02));
      for (let p = 0, y = 0; y < h; y++) for (let x = 0; x < w2; x++, p++) {
        s[p * 3] = d[p * 4];
        s[p * 3 + 1] = d[p * 4 + 1];
        s[p * 3 + 2] = d[p * 4 + 2];
        let v = cv.GC_PR_FGD;
        if (x < ring || y < ring || x >= w2 - ring || y >= h - ring) v = cv.GC_PR_BGD;
        if (d[p * 4 + 3] < 128) v = cv.GC_BGD;
        if (hints && hints[p] === KEEP) v = cv.GC_FGD;
        else if (hints && hints[p] === REMOVE) v = cv.GC_BGD;
        m[p] = v;
      }
      const K = 5, model = (isFg) => {
        const pts = [];
        for (let p = 0; p < w2 * h; p++) {
          const v = m[p], fg = v === cv.GC_FGD || v === cv.GC_PR_FGD;
          if (fg === isFg) pts.push(p);
        }
        if (!pts.length) return null;
        const col = (p, c) => s[p * 3 + c], lum2 = (p) => col(p, 0) * 0.299 + col(p, 1) * 0.587 + col(p, 2) * 0.114;
        const sorted = pts.slice().sort((a, b) => lum2(a) - lum2(b) || a - b);
        const ctr = Array.from({ length: K }, (_, k) => {
          const p = sorted[Math.min(sorted.length - 1, Math.floor((k + 0.5) / K * sorted.length))];
          return [col(p, 0), col(p, 1), col(p, 2)];
        });
        const lab = new Uint8Array(pts.length);
        for (let it = 0; it < 10; it++) {
          const sum = Array.from({ length: K }, () => [0, 0, 0, 0]);
          pts.forEach((p, i) => {
            let best = 0, bd = Infinity;
            for (let k = 0; k < K; k++) {
              const d2 = (col(p, 0) - ctr[k][0]) ** 2 + (col(p, 1) - ctr[k][1]) ** 2 + (col(p, 2) - ctr[k][2]) ** 2;
              if (d2 < bd) {
                bd = d2;
                best = k;
              }
            }
            lab[i] = best;
            const q = sum[best];
            q[0] += col(p, 0);
            q[1] += col(p, 1);
            q[2] += col(p, 2);
            q[3]++;
          });
          sum.forEach((q, k) => {
            if (q[3]) ctr[k] = [q[0] / q[3], q[1] / q[3], q[2] / q[3]];
          });
        }
        const out2 = new cv.Mat(1, K * 13, cv.CV_64FC1), md = out2.data64F;
        for (let k = 0; k < K; k++) {
          let n = 0;
          const mu = [0, 0, 0], c = new Array(9).fill(0);
          pts.forEach((p, i) => {
            if (lab[i] !== k) return;
            n++;
            for (let a = 0; a < 3; a++) {
              mu[a] += col(p, a);
              for (let b = 0; b < 3; b++) c[a * 3 + b] += col(p, a) * col(p, b);
            }
          });
          md[k] = n / pts.length;
          for (let a = 0; a < 3; a++) md[K + k * 3 + a] = n ? mu[a] / n : 0;
          for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) md[K * 4 + k * 9 + a * 3 + b] = n ? c[a * 3 + b] / n - mu[a] / n * (mu[b] / n) + (a === b ? 0.01 : 0) : a === b ? 0.01 : 0;
        }
        return out2;
      };
      const b0 = model(false), f0 = model(true);
      if (b0 && f0) {
        b0.copyTo(bgd);
        f0.copyTo(fgd);
        b0.delete();
        f0.delete();
        cv.grabCut(src, mask, new cv.Rect(0, 0, w2, h), bgd, fgd, iterations, cv.GC_EVAL);
      } else {
        if (b0) b0.delete();
        if (f0) f0.delete();
        cv.grabCut(src, mask, new cv.Rect(0, 0, w2, h), bgd, fgd, iterations, cv.GC_INIT_WITH_MASK);
      }
      const out = new Uint8Array(w2 * h), r = mask.data;
      for (let p = 0; p < out.length; p++) out[p] = r[p] === cv.GC_FGD || r[p] === cv.GC_PR_FGD ? 1 : 0;
      return out;
    } finally {
      src.delete();
      mask.delete();
      bgd.delete();
      fgd.delete();
    }
  }
  if (HINT_KEEP !== 1 || HINT_REMOVE !== 2) throw new Error("hint values changed: update grabCutMask");
  function watershedParts(cv, img, map) {
    const w2 = img.width, h = img.height, d = img.data, UN = 255, BG = 1e3;
    const src = new cv.Mat(h, w2, cv.CV_8UC3), markers = new cv.Mat(h, w2, cv.CV_32S);
    try {
      const s = src.data, m = markers.data32S;
      for (let p = 0; p < w2 * h; p++) {
        s[p * 3] = d[p * 4];
        s[p * 3 + 1] = d[p * 4 + 1];
        s[p * 3 + 2] = d[p * 4 + 2];
        m[p] = map[p] === 0 ? BG : map[p] === UN ? 0 : map[p];
      }
      cv.watershed(src, markers);
      const out = Uint8Array.from(map), r = markers.data32S;
      for (let p = 0; p < w2 * h; p++) if (map[p] === UN && r[p] > 0 && r[p] < BG) out[p] = r[p];
      return out;
    } finally {
      src.delete();
      markers.delete();
    }
  }
  function inpaintRGBA(cv, img, mask, radius) {
    const w2 = img.width, h = img.height, d = img.data;
    const src = new cv.Mat(h, w2, cv.CV_8UC3), m = new cv.Mat(h, w2, cv.CV_8UC1), dst = new cv.Mat();
    try {
      const s = src.data, k = m.data;
      for (let p = 0; p < w2 * h; p++) {
        s[p * 3] = d[p * 4];
        s[p * 3 + 1] = d[p * 4 + 1];
        s[p * 3 + 2] = d[p * 4 + 2];
        k[p] = mask[p] ? 255 : 0;
      }
      cv.inpaint(src, m, dst, radius || 3, cv.INPAINT_TELEA);
      const out = new Uint8ClampedArray(w2 * h * 4), r = dst.data;
      for (let p = 0; p < w2 * h; p++) {
        out[p * 4] = r[p * 3];
        out[p * 4 + 1] = r[p * 3 + 1];
        out[p * 4 + 2] = r[p * 3 + 2];
        out[p * 4 + 3] = 255;
      }
      return out;
    } finally {
      src.delete();
      m.delete();
      dst.delete();
    }
  }
  function cvReady(c) {
    return new Promise((resolve, reject) => {
      if (!c) {
        reject(new Error("the OpenCV script did not define cv"));
        return;
      }
      if (c instanceof Promise) {
        c.then((v) => resolve({ cv: v }), reject);
        return;
      }
      if (c.Mat) {
        resolve({ cv: c });
        return;
      }
      const timer = setInterval(() => {
        if (c.Mat) {
          clearInterval(timer);
          resolve({ cv: c });
        }
      }, 50);
    });
  }
  function cvErrorText(cv, err) {
    if (typeof err === "number" && cv && cv.exceptionFromPtr) {
      try {
        return cv.exceptionFromPtr(err).msg;
      } catch (e) {
      }
    }
    return String(err && err.message || err);
  }
  var WORKER_SRC = `"use strict";
const cvReady = ${cvReady.toString()};
const cvErrorText = ${cvErrorText.toString()};
const grabCutMask = ${grabCutMask.toString()};
const watershedParts = ${watershedParts.toString()};
const inpaintRGBA = ${inpaintRGBA.toString()};
let cv = null;
self.onmessage = async e => {
  const m = e.data;
  try {
    if (m.type === 'load') { importScripts(m.url); cv = (await cvReady(self.cv)).cv; postMessage({ id: m.id, ok: true }); }
    else if (m.type === 'grabcut') { const mask = grabCutMask(cv, m.img, m.hints, m.opts); postMessage({ id: m.id, ok: true, mask }, [mask.buffer]); }
    else if (m.type === 'inpaint') { const out = inpaintRGBA(cv, m.img, m.mask, m.radius); postMessage({ id: m.id, ok: true, mask: out }, [out.buffer]); }
    else if (m.type === 'watershed') { const mask = watershedParts(cv, m.img, m.map); postMessage({ id: m.id, ok: true, mask }, [mask.buffer]); }
  } catch (err) { postMessage({ id: m.id, ok: false, error: cvErrorText(cv, err) }); }
};`;
  function createCv({ url = OPENCV_URL, timeoutMs = 18e4, onState = () => {
  } } = {}) {
    const api = { state: "idle", mode: null, error: null, load, grabCut, watershed, inpaint };
    let loading = null, worker = null, mainCv = null, nextId = 1;
    const pending = /* @__PURE__ */ new Map();
    const set = (state2, extra = {}) => {
      Object.assign(api, { state: state2 }, extra);
      onState(api);
    };
    function call(msg, transfer = []) {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        worker.postMessage({ ...msg, id }, transfer);
      });
    }
    const withTimeout = (p, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + " timed out")), timeoutMs))]);
    async function loadWorker() {
      const blobUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
      worker = new Worker(blobUrl);
      worker.onmessage = (e) => {
        const p = pending.get(e.data.id);
        if (!p) return;
        pending.delete(e.data.id);
        e.data.ok ? p.resolve(e.data) : p.reject(new Error(e.data.error));
      };
      const failAll = (msg) => {
        for (const p of pending.values()) p.reject(new Error(msg));
        pending.clear();
      };
      worker.onerror = (e) => {
        e.preventDefault && e.preventDefault();
        failAll(e.message || "worker error");
      };
      await withTimeout(call({ type: "load", url }), "loading OpenCV");
    }
    function loadMain() {
      return withTimeout(new Promise((resolve, reject) => {
        if (window.cv) {
          cvReady(window.cv).then(resolve, reject);
          return;
        }
        const el2 = document.createElement("script");
        el2.src = url;
        el2.async = true;
        el2.onload = () => cvReady(window.cv).then(resolve, reject);
        el2.onerror = () => reject(new Error("the OpenCV script could not be downloaded"));
        document.head.appendChild(el2);
      }), "loading OpenCV");
    }
    function load() {
      if (loading) return loading;
      set("loading");
      loading = (async () => {
        try {
          await loadWorker();
          set("ready", { mode: "worker" });
          return api;
        } catch (e) {
          if (worker) worker.terminate();
          worker = null;
          api.workerError = String(e.message || e);
        }
        try {
          mainCv = (await loadMain()).cv;
          set("ready", { mode: "main" });
        } catch (e) {
          set("failed", { error: String(e.message || e) });
        }
        return api;
      })();
      return loading;
    }
    async function grabCut(img, hints, opts2) {
      await load();
      if (api.state !== "ready") throw new Error("OpenCV is not available: " + api.error);
      if (api.mode === "worker") {
        const copy2 = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
        const r = await call({ type: "grabcut", img: copy2, hints: hints ? Uint8Array.from(hints) : null, opts: opts2 }, [copy2.data.buffer]);
        return r.mask;
      }
      try {
        return grabCutMask(mainCv, img, hints, opts2);
      } catch (e) {
        throw new Error(cvErrorText(mainCv, e));
      }
    }
    async function inpaint(img, mask, radius = 3) {
      await load();
      if (api.state !== "ready") throw new Error("OpenCV is not available: " + api.error);
      if (api.mode === "worker") {
        const copy2 = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
        const r = await call({ type: "inpaint", img: copy2, mask: Uint8Array.from(mask), radius }, [copy2.data.buffer]);
        return r.mask;
      }
      try {
        return inpaintRGBA(mainCv, img, mask, radius);
      } catch (e) {
        throw new Error(cvErrorText(mainCv, e));
      }
    }
    async function watershed(img, map) {
      await load();
      if (api.state !== "ready") throw new Error("OpenCV is not available: " + api.error);
      if (api.mode === "worker") {
        const copy2 = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
        const r = await call({ type: "watershed", img: copy2, map: Uint8Array.from(map) }, [copy2.data.buffer]);
        return r.mask;
      }
      try {
        return watershedParts(mainCv, img, map);
      } catch (e) {
        throw new Error(cvErrorText(mainCv, e));
      }
    }
    return api;
  }

