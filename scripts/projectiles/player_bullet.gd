extends Area2D

@export var speed: float = 800.0

func _ready() -> void:
	add_to_group("player_bullets")

func _process(delta: float) -> void:
	position.y -= speed * delta
	if position.y < -20:
		queue_free()
