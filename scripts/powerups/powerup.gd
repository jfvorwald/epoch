extends Area2D

@export var speed: float = 120.0
@export var powerup_type: String = "health"  # health, fire_rate, spread, damage
@export var attract_radius: float = 420.0
@export var attract_speed: float = 400.0

var sprite_map: Dictionary = {
	"health": "res://assets/sprites/powerups/powerup_era1_health.png",
	"fire_rate": "res://assets/sprites/powerups/powerup_era1_fire_rate.png",
	"spread": "res://assets/sprites/powerups/powerup_era1_spread.png",
	"damage": "res://assets/sprites/powerups/powerup_era1_damage.png",
}

func _ready() -> void:
	add_to_group("powerups")
	# Set sprite based on type
	if sprite_map.has(powerup_type):
		var tex := load(sprite_map[powerup_type])
		if tex:
			$Sprite2D.texture = tex

func _process(delta: float) -> void:
	var player_nodes := get_tree().get_nodes_in_group("player")
	var player_node: Node2D = player_nodes[0] if player_nodes.size() > 0 else null

	if player_node:
		var dist := global_position.distance_to(player_node.global_position)
		if dist < attract_radius:
			var pull_strength := 1.0 - (dist / attract_radius)
			var direction := (player_node.global_position - global_position).normalized()
			global_position += direction * attract_speed * pull_strength * delta
			return

	position.y += speed * delta
	position.x += sin(position.y * 0.05) * 30.0 * delta

	if position.y > 1400:
		queue_free()
