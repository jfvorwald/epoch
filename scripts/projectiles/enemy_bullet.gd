extends Area2D

@export var speed: float = 400.0

func _ready() -> void:
	add_to_group("enemy_bullets")

func _process(delta: float) -> void:
	position.y += speed * delta
	if position.y > 1400:
		queue_free()
