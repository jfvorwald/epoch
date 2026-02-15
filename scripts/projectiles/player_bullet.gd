extends Area2D

@export var speed: float = 800.0
var damage: int = 1
var bullet_type: String = "default"  # default, rapid, spread, damage

var texture_map: Dictionary = {
	"default": "res://assets/sprites/projectiles/bullet_player.png",
	"rapid": "res://assets/sprites/projectiles/bullet_player_rapid.png",
	"spread": "res://assets/sprites/projectiles/bullet_player_spread.png",
	"damage": "res://assets/sprites/projectiles/bullet_player_damage.png",
}

func _ready() -> void:
	add_to_group("player_bullets")
	if texture_map.has(bullet_type):
		var tex := load(texture_map[bullet_type])
		if tex:
			$Sprite2D.texture = tex

func _process(delta: float) -> void:
	var direction := Vector2(sin(rotation), -cos(rotation))
	position += direction * speed * delta
	if position.y < -20 or position.x < -20 or position.x > 740:
		queue_free()
