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

signal enemy_destroyed(score: int)

func _ready() -> void:
	start_x = global_position.x
	add_to_group("enemies")
	if movement_type == "shooter":
		bullet_scene = preload("res://scenes/projectiles/enemy_bullet.tscn")

func _process(delta: float) -> void:
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

	# Remove if off screen
	if position.y > 1400:
		queue_free()

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

func take_damage(amount: int = 1) -> void:
	hp -= amount
	if hp <= 0:
		emit_signal("enemy_destroyed", score_value)
		# Brief flash then destroy
		modulate = Color(10, 10, 10, 1)
		await get_tree().create_timer(0.05).timeout
		queue_free()

func _on_area_entered(area: Area2D) -> void:
	if area.is_in_group("player_bullets"):
		area.queue_free()
		take_damage()
