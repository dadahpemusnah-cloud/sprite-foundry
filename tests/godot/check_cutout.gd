# Headless check of an exported cutout scene: loads it, plays every animation and
# reports per-track sanity. Run: godot --headless --path <project> -s check_cutout.gd -- <scene.tscn>
extends SceneTree

var _done = false

func _process(_delta):
	if _done:
		return false
	_done = true
	_run()
	return false

func _run():
	var args = OS.get_cmdline_user_args()
	var scene_path = "res://" + args[0]
	var fails = []
	var packed = load(scene_path)
	if packed == null:
		print("RESULT FAIL cannot load ", scene_path)
		quit(1)
		return
	var root = packed.instantiate()
	get_root().add_child(root)
	var ap: AnimationPlayer = root.get_node("AnimationPlayer")
	var names = ap.get_animation_list()
	# a freshly loaded scene must already be in the rest pose: every node's own value equals its RESET key
	var reset: Animation = ap.get_animation("RESET")
	for t in reset.get_track_count():
		var np = reset.track_get_path(t)
		var node = root.get_node_or_null(NodePath(np.get_concatenated_names()))
		if node == null:
			continue
		var have = node.get_indexed(NodePath(np.get_concatenated_subnames()))
		var want = reset.track_get_key_value(t, 0)
		var differs = (typeof(have) == TYPE_FLOAT and abs(have - want) > 1e-5) or (typeof(have) != TYPE_FLOAT and have != want)
		if differs:
			fails.append("rest pose: %s is %s in the scene but %s in RESET" % [np, have, want])
	print("reset tracks checked ", reset.get_track_count())
	print("animations ", names)
	var sprites = 0
	for n in root.find_children("*", "Sprite2D", true, false):
		sprites += 1
		if n.texture == null:
			fails.append("no texture on " + str(root.get_path_to(n)))
	print("sprites ", sprites)
	for an in names:
		var a: Animation = ap.get_animation(an)
		for t in a.get_track_count():
			var np = a.track_get_path(t)
			var node = root.get_node_or_null(NodePath(np.get_concatenated_names()))
			if node == null:
				fails.append("%s track %d path missing: %s" % [an, t, np])
				continue
			var prop = np.get_concatenated_subnames()
			if not (prop in node):
				fails.append("%s track %d property missing: %s" % [an, t, np])
			for k in a.track_get_key_count(t):
				var tm = a.track_get_key_time(t, k)
				if tm < 0.0 or tm > a.length + 0.0001:
					fails.append("%s track %d key %d time %f outside length %f" % [an, t, k, tm, a.length])
				if k > 0 and tm <= a.track_get_key_time(t, k - 1):
					fails.append("%s track %d keys out of order" % [an, t])
		if an == "RESET":
			continue
		# play it and sample the hand/foot positions to confirm the rig actually moves
		ap.play(an)
		var moved = {}
		var start = {}
		var steps = 24
		for s in steps + 1:
			ap.seek(a.length * s / steps, true)
			for n in root.find_children("*", "Sprite2D", true, false):
				var gp = n.global_position
				var key = str(root.get_path_to(n))
				if not start.has(key):
					start[key] = gp
				elif start[key].distance_to(gp) > 0.5:
					moved[key] = true
		var rots = {}
		for s in steps + 1:
			ap.seek(a.length * s / steps, true)
			for n in root.find_children("*", "Node2D", true, false):
				var key = str(root.get_path_to(n))
				if s == 0:
					rots[key] = [n.rotation, n.position]
				elif abs(rots[key][0] - n.rotation) > 0.001 or rots[key][1].distance_to(n.position) > 0.01:
					moved["node:" + key] = true
		print("anim %s length=%.3f loop=%d tracks=%d keys=%d moved_sprites=%d" % [an, a.length, a.loop_mode, a.get_track_count(), _keys(a), moved.size()])
		if moved.size() == 0:
			fails.append(an + ": no sprite moves")
	if fails.is_empty():
		print("RESULT PASS")
	else:
		for f in fails:
			print("FAIL ", f)
		print("RESULT FAIL ", fails.size())
	quit(0 if fails.is_empty() else 1)

func _keys(a: Animation) -> int:
	var n = 0
	for t in a.get_track_count():
		n += a.track_get_key_count(t)
	return n
