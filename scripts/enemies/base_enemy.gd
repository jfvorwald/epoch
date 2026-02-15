extends Area2D

@export var speed: float = 150.0
@export var hp: int = 1
@export var score_value: int = 10
@export var movement_type: String = "straight"  # straight, zigzag, shooter

var zigzag_amplitude: float = 100.0
var zigzag_frequency: float = 3.0
var start_x: float = 0.0
var time_alive: float = 0.0
var can_shoot: bool = true
var shoot_interval: float = 1.5
var bullet_scene: PackedScene

# Formation system
var holding: bool = true
var hold_position: Vector2 = Vector2.ZERO

# Drop system
var drop_chance: float = 0.25
var powerup_scene: PackedScene

signal enemy_destroyed(score: int)

func _ready() -> void:
	start_x = global_position.x
	add_to_group("enemies")
	powerup_scene = preload("res://scenes/powerups/powerup.tscn")
	if movement_type == "shooter":
		bullet_scene = preload("res://scenes/projectiles/enemy_bullet.tscn")

func _process(delta: float) -> void:
	if holding:
		global_position = global_position.lerp(hold_position, 3.0 * delta)
		return

	time_alive += delta

	match movement_type:
		"straight":
			position.y += speed * delta
		"zigzag":
			position.y += speed * delta
			position.x = start_x + sin(time_alive * zigzag_frequency) * zigzag_amplitude
		"shooter":
			position.y += speed * 0.6 * delta
			if can_shoot:
				shoot()

	if position.y > 1400:
		queue_free()

func release() -> void:
	holding = false
	start_x = global_position.x
	time_alive = 0.0

func shoot() -> void:
	if not bullet_scene:
		return
	can_shoot = false
	var bullet := bullet_scene.instantiate()
	bullet.global_position = global_position + Vector2(0, 20)
	get_tree().current_scene.add_child(bullet)
	await get_tree().create_timer(shoot_interval).timeout
	if is_inside_tree():
		can_shoot = true

func try_drop_powerup() -> void:
	if randf() > drop_chance:
		return
	var powerup := powerup_scene.instantiate()
	powerup.global_position = global_position

	# Pick type - weapon buffs weighted higher
	var roll := randf()
	if roll < 0.15:
		powerup.powerup_type = "health"
	elif roll < 0.50:
		powerup.powerup_type = "fire_rate"
	elif roll < 0.80:
		powerup.powerup_type = "spread"
	else:
		powerup.powerup_type = "damage"

	get_tree().current_scene.call_deferred("add_child", powerup)

func take_damage(amount: int = 1) -> void:
	hp -= amount
	# Hit flash
	modulate = Color(3, 3, 3, 1)
	await get_tree().create_timer(0.05).timeout
	if not is_inside_tree():
		return
	if hp <= 0:
		emit_signal("enemy_destroyed", score_value)
		try_drop_powerup()
		queue_free()
	else:
		modulate = Color(1, 1, 1, 1)

func _on_area_entered(area: Area2D) -> void:
	if area.is_in_group("player_bullets"):
		var dmg: int = area.damage if "damage" in area else 1
		area.queue_free()
		take_damage(dmg)
