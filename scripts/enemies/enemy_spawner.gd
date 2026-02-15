extends Node

@export var spawn_interval: float = 1.0
@export var enemies_per_wave: int = 10

var enemy_scenes: Dictionary = {}
var spawn_timer: float = 0.0
var enemies_spawned: int = 0
var total_enemies_for_level: int = 10
var active_enemies: int = 0
var spawning: bool = false

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

	spawn_timer += delta
	if spawn_timer >= spawn_interval and enemies_spawned < total_enemies_for_level:
		spawn_timer = 0.0
		spawn_enemy()

func start_wave(level: int) -> void:
	# Scale difficulty with level
	total_enemies_for_level = 10 + level * 2
	spawn_interval = max(0.3, 1.0 - level * 0.02)
	enemies_spawned = 0
	active_enemies = 0
	spawn_timer = 0.0
	spawning = true

func stop_wave() -> void:
	spawning = false

func spawn_enemy() -> void:
	var viewport_width := get_viewport().get_visible_rect().size.x

	# Pick enemy type based on level
	var current_level: int = Progression.current_level
	var type_roll := randf()
	var enemy_type: String

	if current_level < 5:
		# Early levels: mostly straight
		if type_roll < 0.7:
			enemy_type = "straight"
		elif type_roll < 0.9:
			enemy_type = "zigzag"
		else:
			enemy_type = "shooter"
	elif current_level < 20:
		# Mid levels: mixed
		if type_roll < 0.4:
			enemy_type = "straight"
		elif type_roll < 0.7:
			enemy_type = "zigzag"
		else:
			enemy_type = "shooter"
	else:
		# Later levels: more shooters
		if type_roll < 0.25:
			enemy_type = "straight"
		elif type_roll < 0.5:
			enemy_type = "zigzag"
		else:
			enemy_type = "shooter"

	var enemy_scene: PackedScene = enemy_scenes[enemy_type]
	var enemy := enemy_scene.instantiate()

	# Random X position
	enemy.global_position = Vector2(randf_range(40, viewport_width - 40), -40)

	# Scale enemy HP with level
	enemy.hp = Progression.get_enemy_hp()

	enemy.enemy_destroyed.connect(_on_enemy_destroyed)
	enemy.tree_exited.connect(_on_enemy_exited)

	get_tree().current_scene.add_child(enemy)
	enemies_spawned += 1
	active_enemies += 1

func _on_enemy_destroyed(score: int) -> void:
	emit_signal("enemy_destroyed_score", score)

func _on_enemy_exited() -> void:
	active_enemies -= 1
	if enemies_spawned >= total_enemies_for_level and active_enemies <= 0:
		spawning = false
		emit_signal("wave_complete")
