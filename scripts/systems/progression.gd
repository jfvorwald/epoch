extends Node

var current_level: int = 1
var current_era: int = 1
var max_level_per_era: int = 100

signal level_changed(level: int, era: int)

func _ready() -> void:
	pass

func advance_level() -> void:
	current_level += 1
	# Era system placeholder - for now always era 1
	# In full game: reaching level 100 triggers prestige to next era
	emit_signal("level_changed", current_level, current_era)

func reset() -> void:
	current_level = 1
	current_era = 1
	emit_signal("level_changed", current_level, current_era)

func get_player_max_hp() -> int:
	# Base HP scales slightly with level
	return 5 + (current_level / 10)

func get_enemy_hp() -> int:
	# Enemies get tougher each level
	if current_level < 10:
		return 1
	elif current_level < 30:
		return 2
	elif current_level < 60:
		return 3
	else:
		return 4

func get_level_display() -> String:
	return "Era %d - Level %d" % [current_era, current_level]
