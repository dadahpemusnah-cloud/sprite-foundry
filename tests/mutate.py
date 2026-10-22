"""Writes mutated copies of index.html for the V5 mutation check. Each mutation must apply exactly once."""
import sys, os
src = open("index.html").read()
M = {
  "rot-sign":   ('fmt: (v) => fl(deg(v)) });\n    for (const id of bones) if (used.off', 'fmt: (v) => fl(deg(-v)) });\n    for (const id of bones) if (used.off'),
  "no-pad":     ('`offset = Vector2(${f6(pic.x - pad - origin[0])}', '`offset = Vector2(${f6(pic.x - origin[0])}'),
  "joint-pos":  ('`position = Vector2(${f6(pv[0] - base[0])}, ${f6(pv[1] - base[1])})`', '`position = Vector2(${f6(pv[0])}, ${f6(pv[1] - base[1])})`'),
  "z-flip":     ('const zOf = (id) => 2 * Math.max(0, z.indexOf(id)) + 1;', 'const zOf = (id) => 99 - 2 * Math.max(0, z.indexOf(id));'),
  "ease-swap":  ('var TRANSITION = { linear: 1, easeIn: 2, easeOut: 0.5, step: 0 };', 'var TRANSITION = { linear: 1, easeIn: 0.5, easeOut: 2, step: 0 };'),
  "off-scale":  ('return [o[0] / B, o[1] / B];', 'return [o[0], o[1]];'),
  "time-scale": ('times.push(t / 1e3);', 'times.push(t / 1e2);'),
  "tilt-pivot": ('const tilt = [pad + N / 2 - pivot.x, pad + N - pivot.y];', 'const tilt = [N / 2 - pivot.x, N - pivot.y];'),
}
os.makedirs(sys.argv[1], exist_ok=True)
for name, (a, b) in M.items():
    n = src.count(a)
    assert n == 1, f"{name}: pattern found {n} times"
    open(os.path.join(sys.argv[1], name + ".html"), "w").write(src.replace(a, b))
    print(name)
