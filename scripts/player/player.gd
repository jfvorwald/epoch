extends Area2D

@export var speed: float = 600.0
@export var fire_rate: float = 0.15
@export var max_hp: int = 5

var hp: int
var can_fire: bool = true
var bullet_scene: PackedScene

signal hp_changed(new_hp: int, max_hp: int)
signal player_died

func _ready() -> void:
	hp = max_hp
	bullet_scene = preload("res://scenes/projectiles/player_bullet.tscn")
	emit_signal("hp_changed", hp, max_hp)

func _process(delta: float) -> void:
	# Follow mouse/touch position (horizontal and vertical within bounds)
	var target := get_global_mouse_position()
	var viewport_rect := get_viewport_rect()

	# Smoothly move toward target
	var new_pos := global_position.lerp(target, speed * delta / 100.0)

	# Clamp within viewport
	new_pos.x = clampf(new_pos.x, 32, viewport_rect.size.x - 32)
	new_pos.y = clampf(new_pos.y, 32, viewport_rect.size.y - 32)

	global_position = new_pos

	# Auto-fire
	if can_fire:
		fire()

func fire() -> void:
	can_fire = false
	var bullet := bullet_scene.instantiate()
	bullet.global_position = global_position + Vector2(0, -30)
	get_tree().current_scene.add_child(bullet)

	# Fire cooldown
	await get_tree().create_timer(fire_rate).timeout
	can_fire = true

func take_damage(amount: int = 1) -> void:
	hp -= amount
	hp = max(hp, 0)
	emit_signal("hp_changed", hp, max_hp)

	if hp <= 0:
		emit_signal("player_died")
		# Flash and disable
		modulate = Color(1, 0, 0, 0.5)
		set_process(false)
		can_fire = false

func heal(amount: int = 1) -> void:
	hp = min(hp + amount, max_hp)
	emit_signal("hp_changed", hp, max_hp)

func reset() -> void:
	hp = max_hp
	modulate = Color(1, 1, 1, 1)
	set_process(true)
	can_fire = true
	emit_signal("hp_changed", hp, max_hp)

func _on_area_entered(area: Area2D) -> void:
	if area.is_in_group("enemy_bullets"):
		area.queue_free()
		take_damage()
	elif area.is_in_group("enemies"):
		take_damage()
	elif area.is_in_group("powerups"):
		area.queue_free()
		heal()
