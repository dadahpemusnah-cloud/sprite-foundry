"""Compares Godot-placed cutout frames with the exported sheet: silhouette IoU and colour agreement per frame.
usage: python3 compare_cutout.py <pack dir> <raster dir>  (exit 1 if a frame is below the thresholds)"""
import json, sys, os, re
from PIL import Image
pack, ras = sys.argv[1], sys.argv[2]
m = json.load(open(os.path.join(pack, "manifest.json")))
sheet = Image.open(os.path.join(pack, m["sheet"]["file"])).convert("RGBA")
s, W, H = m["scale"], m["logicalFrame"]["w"], m["logicalFrame"]["h"]
ow, oh = m["outputFrame"]["w"], m["outputFrame"]["h"]
# animations the export README lists with "flash frames": the cutout scene does not carry the
# flash tint (documented), so their colour is not compared, only the silhouette
readme = open(os.path.join(pack, "README.txt")).read() if os.path.exists(os.path.join(pack, "README.txt")) else ""
flash = set(re.findall(r"^\s+(\S+): .*flash frames", readme, re.M))
worst, bad = 1.0, []
for a in m["animations"]:
    for i in range(a["frames"]):
        f = os.path.join(ras, f"{a['name']}_{i}.png")
        if not os.path.exists(f):
            continue
        g = Image.open(f).convert("RGBA")
        inter = union = same = 0
        for y in range(H):
            for x in range(W):
                sp = sheet.getpixel((i * ow + x * s + s // 2, a["row"] * oh + y * s + s // 2))
                gp = g.getpixel((x, y))
                A, B = sp[3] > 127, gp[3] > 127
                inter += A and B; union += A or B
                same += A and B and max(abs(sp[k] - gp[k]) for k in range(3)) <= 8
        iou = inter / union if union else 1.0
        col = same / inter if inter else 1.0
        worst = min(worst, iou)
        exact = a["name"] == "pose"  # rest pose: Godot places the untouched part pictures, so it must match exactly
        ok = (iou >= 0.999 and col >= 0.999) if exact else (iou >= 0.85 and (col >= 0.85 or a["name"] in flash))
        flag = "" if ok else "  <-- below threshold"
        if flag: bad.append((a["name"], i))
        print(f"{a['name']:>8} {i}: silhouette IoU {iou:.3f}  colour match {col:.3f}{flag}")
print("WORST IoU %.3f" % worst, "FAIL %s" % bad if bad else "PASS")
sys.exit(1 if bad else 0)
