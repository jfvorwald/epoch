extends Node

@export var spawn_interval: float = 2.0
@export var enemies_per_wave: int = 10

var enemy_scenes: Dictionary = {}
var spawn_timer: float = 0.0
var enemies_spawned: int = 0
var total_enemies_for_level: int = 10
var active_enemies: int = 0
var spawning: bool = false

# Formation system
var formation_group: Array = []
var formation_size: int = 5  # How many enemies form up before releasing
var formation_timer: float = 0.0
var formation_hold_time: float = 2.0  # How long the group holds at top

signal wave_complete
signal enemy_destroyed_score(score: int)

func _ready() -> void:
	enemy_scenes = {
		"straight": preload("res://scenes/enemies/enemy_types/enemy_straight.tscn"),
		"zigzag": preload("res://scenes/enemies/enemy_types/enemy_zigzag.tscn"),
		"shooter": preload("res://scenes/enemies/enemy_types/enemy_shooter.tscn"),
	}

func _process(delta: float) -> void:
	if not spawning:
		return

	# If we have a full formation group holding, count down to release
	if formation_group.size() >= formation_size:
		formation_timer += delta
		if formation_timer >= formation_hold_time:
			release_formation()

	# Spawn enemies into formation
	spawn_timer += delta
	if spawn_timer >= spawn_interval and enemies_spawned < total_enemies_for_level:
		spawn_timer = 0.0
		spawn_enemy()

func start_wave(level: int) -> void:
	# Scale difficulty with level
	total_enemies_for_level = 10 + level * 2
	spawn_interval = max(0.8, 2.0 - level * 0.03)
	formation_size = mini(3 + level / 5, 8)
	formation_hold_time = max(1.0, 2.5 - level * 0.02)
	enemies_spawned = 0
	active_enemies = 0
	spawn_timer = 0.0
	formation_timer = 0.0
	formation_group.clear()
	spawning = true

func stop_wave() -> void:
	spawning = false

func release_formation() -> void:
	# Release all holding enemies
	for enemy in formation_group:
		if is_instance_valid(enemy):
			enemy.release()
	formation_group.clear()
	formation_timer = 0.0

func spawn_enemy() -> void:
	var viewport_width := get_viewport().get_visible_rect().size.x

	# Pick enemy type based on level
	var current_level: int = Progression.current_level
	var type_roll := randf()
	var enemy_type: String

	if current_level < 5:
		if type_roll < 0.7:
			enemy_type = "straight"
		elif type_roll < 0.9:
			enemy_type = "zigzag"
		else:
			enemy_type = "shooter"
	elif current_level < 20:
		if type_roll < 0.4:
			enemy_type = "straight"
		elif type_roll < 0.7:
			enemy_type = "zigzag"
		else:
			enemy_type = "shooter"
	else:
		if type_roll < 0.25:
			enemy_type = "straight"
		elif type_roll < 0.5:
			enemy_type = "zigzag"
		else:
			enemy_type = "shooter"

	var enemy_scene: PackedScene = enemy_scenes[enemy_type]
	var enemy := enemy_scene.instantiate()

	# Spawn off screen, assign hold position in formation row
	var formation_index := formation_group.size()
	var cols := mini(formation_size, 5)
	var row := formation_index / cols
	var col := formation_index % cols
	var spacing_x := viewport_width / (cols + 1)
	var hold_x := spacing_x * (col + 1)
	var hold_y := 60.0 + row * 50.0

	enemy.global_position = Vector2(hold_x, -40)
	enemy.hold_position = Vector2(hold_x, hold_y)
	enemy.holding = true

	# Scale enemy HP with level
	enemy.hp = Progression.get_enemy_hp()

	enemy.enemy_destroyed.connect(_on_enemy_destroyed)
	enemy.tree_exited.connect(_on_enemy_exited)

	get_tree().current_scene.add_child(enemy)
	formation_group.append(enemy)
	enemies_spawned += 1
	active_enemies += 1

func _on_enemy_destroyed(score: int) -> void:
	emit_signal("enemy_destroyed_score", score)

func _on_enemy_exited() -> void:
	active_enemies -= 1
	if enemies_spawned >= total_enemies_for_level and active_enemies <= 0:
		spawning = false
		emit_signal("wave_complete")
