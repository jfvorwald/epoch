extends Area2D

@export var speed: float = 600.0
@export var base_fire_rate: float = 0.15
@export var max_hp: int = 5

var hp: int
var can_fire: bool = true
var bullet_scene: PackedScene

# Weapon buff system
var fire_rate_mult: float = 1.0   # Lower = faster
var damage: int = 1
var spread: int = 1               # Number of bullet streams (1, 2, 3)
var buff_duration: float = 8.0

signal hp_changed(new_hp: int, max_hp: int)
signal player_died

func _ready() -> void:
	hp = max_hp
	add_to_group("player")
	bullet_scene = preload("res://scenes/projectiles/player_bullet.tscn")
	emit_signal("hp_changed", hp, max_hp)

func _process(delta: float) -> void:
	var target := get_global_mouse_position()
	var viewport_rect := get_viewport_rect()

	var new_pos := global_position.lerp(target, speed * delta / 100.0)
	new_pos.x = clampf(new_pos.x, 32, viewport_rect.size.x - 32)
	new_pos.y = clampf(new_pos.y, 32, viewport_rect.size.y - 32)
	global_position = new_pos

	if can_fire:
		fire()

func fire() -> void:
	can_fire = false

	if spread == 1:
		spawn_bullet(Vector2(0, -30), 0.0)
	elif spread == 2:
		spawn_bullet(Vector2(-10, -30), -0.1)
		spawn_bullet(Vector2(10, -30), 0.1)
	else:
		spawn_bullet(Vector2(-16, -26), -0.2)
		spawn_bullet(Vector2(0, -30), 0.0)
		spawn_bullet(Vector2(16, -26), 0.2)

	var actual_rate := base_fire_rate * fire_rate_mult
	await get_tree().create_timer(actual_rate).timeout
	can_fire = true

func get_bullet_type() -> String:
	if damage > 1:
		return "damage"
	elif spread > 1:
		return "spread"
	elif fire_rate_mult < 1.0:
		return "rapid"
	return "default"

func spawn_bullet(offset: Vector2, angle: float) -> void:
	var bullet := bullet_scene.instantiate()
	bullet.global_position = global_position + offset
	bullet.rotation = angle
	bullet.damage = damage
	bullet.bullet_type = get_bullet_type()
	get_tree().current_scene.add_child(bullet)

func apply_buff(buff_type: String) -> void:
	match buff_type:
		"fire_rate":
			fire_rate_mult = 0.5
			start_buff_timer("fire_rate")
		"spread":
			spread = mini(spread + 1, 3)
			start_buff_timer("spread")
		"damage":
			damage = 3
			start_buff_timer("damage")
		"health":
			heal(2)

func start_buff_timer(buff_type: String) -> void:
	await get_tree().create_timer(buff_duration).timeout
	match buff_type:
		"fire_rate":
			fire_rate_mult = 1.0
		"spread":
			spread = 1
		"damage":
			damage = 1

func take_damage(amount: int = 1) -> void:
	hp -= amount
	hp = max(hp, 0)
	emit_signal("hp_changed", hp, max_hp)

	# Hit flash
	modulate = Color(1, 0.3, 0.3, 1)
	await get_tree().create_timer(0.1).timeout
	if not is_inside_tree():
		return

	if hp <= 0:
		emit_signal("player_died")
		modulate = Color(1, 0, 0, 0.5)
		set_process(false)
		can_fire = false
	else:
		modulate = Color(1, 1, 1, 1)

func heal(amount: int = 1) -> void:
	hp = min(hp + amount, max_hp)
	emit_signal("hp_changed", hp, max_hp)

func reset() -> void:
	hp = max_hp
	modulate = Color(1, 1, 1, 1)
	set_process(true)
	can_fire = true
	fire_rate_mult = 1.0
	damage = 1
	spread = 1
	emit_signal("hp_changed", hp, max_hp)

func _on_area_entered(area: Area2D) -> void:
	if area.is_in_group("enemy_bullets"):
		area.queue_free()
		take_damage()
	elif area.is_in_group("enemies"):
		take_damage()
	elif area.is_in_group("powerups"):
		var powerup_type: String = area.powerup_type
		area.queue_free()
		apply_buff(powerup_type)
