extends Area2D

@export var speed: float = 100.0
@export var powerup_type: String = "health"

func _ready() -> void:
	add_to_group("powerups")

func _process(delta: float) -> void:
	position.y += speed * delta
	if position.y > 1400:
		queue_free()
