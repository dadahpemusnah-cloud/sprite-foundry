# Draws a simple humanoid on a white background for the import pipeline.
# usage: make_character.py <out.png> [front|back|side]   (side faces right)
from PIL import Image, ImageDraw
import sys
out, view = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "front")
W, H = 300, 600
im = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(im)
skin, shirt, pants, shoe, hair = (232,190,150), (60,110,200), (60,60,80), (90,50,30), (70,40,20)
sleeveL, sleeveR, legR = (200,60,60), (60,170,80), (120,90,150)  # distinct, so draw-order errors show
if view in ("front", "back"):
    if view == "back":
        sleeveL, sleeveR = sleeveR, sleeveL                 # seen from behind, the sides swap
        d.ellipse((110, 30, 190, 120), fill=hair)           # back of the head
    else:
        d.ellipse((110, 30, 190, 120), fill=skin)           # face
        d.rectangle((110, 25, 190, 60), fill=hair)          # hair
    d.rectangle((140, 118, 160, 135), fill=skin)            # neck
    d.rectangle((100, 135, 200, 300), fill=shirt)           # torso
    d.rectangle((60, 140, 98, 300), fill=sleeveL)           # left arm
    d.rectangle((202, 140, 240, 300), fill=sleeveR)         # right arm
    d.rectangle((62, 300, 96, 340), fill=skin)              # hands
    d.rectangle((204, 300, 238, 340), fill=skin)
    d.rectangle((105, 300, 147, 520), fill=pants)           # legs
    d.rectangle((153, 300, 195, 520), fill=legR)
    d.rectangle((95, 520, 147, 550), fill=shoe)             # shoes
    d.rectangle((153, 520, 205, 550), fill=shoe)
else:  # side view facing right: narrow body, near arm in front, legs a step apart
    d.ellipse((115, 30, 195, 120), fill=skin)               # head in profile
    d.rectangle((115, 25, 175, 60), fill=hair)
    d.rectangle((115, 60, 140, 100), fill=hair)             # hair at the back
    d.rectangle((145, 118, 165, 135), fill=skin)            # neck
    d.rectangle((125, 135, 185, 300), fill=shirt)           # torso, side on
    d.rectangle((120, 300, 155, 520), fill=pants)           # far leg
    d.rectangle((150, 300, 185, 520), fill=legR)            # near leg
    d.rectangle((120, 520, 165, 550), fill=shoe)            # shoes point right
    d.rectangle((150, 520, 200, 550), fill=shoe)
    d.rectangle((140, 140, 172, 300), fill=sleeveR)         # near arm over the torso
    d.rectangle((142, 300, 170, 340), fill=skin)            # hand
im.save(out)
