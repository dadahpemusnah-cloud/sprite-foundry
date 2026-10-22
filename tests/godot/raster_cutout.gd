# Draws every frame of every animation of an exported cutout scene on the CPU, at 1x,
# the way Godot places the sprites (nearest sampling, z_index order). Output: <out>/<anim>_<i>.png
# Run: godot --headless --path <project> -s raster_cutout.gd -- <scene.tscn> <manifest.json> <out dir>
extends SceneTree

var _done = false

func _process(_delta):
	if _done:
		return false
	_done = true
	var a = OS.get_cmdline_user_args()
	var root = load("res://" + a[0]).instantiate()
	get_root().add_child(root)
	var man = JSON.parse_string(FileAccess.get_file_as_string("res://" + a[1]))
	var W = int(man.logicalFrame.w)
	var H = int(man.logicalFrame.h)
	var px = float(man.pivot.x)
	var py = float(man.pivot.y)
	var ap: AnimationPlayer = root.get_node("AnimationPlayer")
	var sprites = root.find_children("*", "Sprite2D", true, false)
	var imgs = {}
	for s in sprites:
		imgs[s] = s.texture.get_image()
	DirAccess.make_dir_recursive_absolute(a[2])
	for an in man.animations:
		# the sheet's rest row has no Godot animation of its own: it must equal RESET
		var gname = an.name if ap.has_animation(an.name) else ("RESET" if an.name == "pose" else "")
		if gname == "":
			continue
		ap.play(gname)
		var t = 0.0
		for i in int(an.frames):
			ap.seek(t, true)
			t += float(an.durationsMs[i]) / 1000.0
			var order = sprites.filter(func(s): return s.is_visible_in_tree())
			order.sort_custom(func(p, q): return p.z_index < q.z_index)
			var out = Image.create(W, H, false, Image.FORMAT_RGBA8)
			var inv_root = root.get_global_transform().affine_inverse()
			for s in order:
				var T = (inv_root * s.get_global_transform()).affine_inverse()
				var img: Image = imgs[s] if s.texture == null or s.texture.get_image() == null else s.texture.get_image()
				var iw = img.get_width()
				var ih = img.get_height()
				for y in H:
					for x in W:
						var q = T * Vector2(x + 0.5 - px, y + 0.5 - py) - s.offset
						var u = int(floor(q.x))
						var v = int(floor(q.y))
						if u >= 0 and v >= 0 and u < iw and v < ih:
							var c = img.get_pixel(u, v)
							if c.a > 0.5:
								out.set_pixel(x, y, c)
			out.save_png(a[2] + "/%s_%d.png" % [an.name, i])
	print("RASTER DONE")
	quit(0)
	return false
