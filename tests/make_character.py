# Draws a simple front-facing humanoid on a white background for the import pipeline.
from PIL import Image, ImageDraw
import sys
W, H = 300, 600
im = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(im)
skin, shirt, pants, shoe, hair = (232,190,150), (60,110,200), (60,60,80), (90,50,30), (70,40,20)
sleeveL, sleeveR, legR = (200,60,60), (60,170,80), (120,90,150)  # distinct, so draw-order errors show
d.ellipse((110, 30, 190, 120), fill=skin)            # head
d.rectangle((110, 25, 190, 60), fill=hair)           # hair
d.rectangle((140, 118, 160, 135), fill=skin)         # neck
d.rectangle((100, 135, 200, 300), fill=shirt)        # torso
d.rectangle((60, 140, 98, 300), fill=sleeveL)          # left arm
d.rectangle((202, 140, 240, 300), fill=sleeveR)        # right arm
d.rectangle((62, 300, 96, 340), fill=skin)           # left hand
d.rectangle((204, 300, 238, 340), fill=skin)         # right hand
d.rectangle((105, 300, 147, 520), fill=pants)        # left leg
d.rectangle((153, 300, 195, 520), fill=legR)        # right leg
d.rectangle((95, 520, 147, 550), fill=shoe)          # left shoe
d.rectangle((153, 520, 205, 550), fill=shoe)         # right shoe
im.save(sys.argv[1])
