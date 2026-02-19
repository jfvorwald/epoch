extends Node

var current_level: int = 1
var current_era: int = 1
var max_level_per_era: int = 100

signal level_changed(level: int, era: int)

func _ready() -> void:
	pass

func advance_level() -> void:
	current_level += 1
	emit_signal("level_changed", current_level, current_era)

func reset() -> void:
	current_level = 1
	current_era = 1
	emit_signal("level_changed", current_level, current_era)

func get_player_max_hp() -> int:
	return 5 + (current_level / 10)

func get_enemy_hp() -> int:
	# Beefier enemies from the start
	if current_level < 5:
		return 3
	elif current_level < 15:
		return 5
	elif current_level < 30:
		return 7
	elif current_level < 60:
		return 10
	else:
		return 14

func get_level_display() -> String:
	return "Era %d - Level %d" % [current_era, current_level]

# ============================================================
# STRELKA ENGINE v0.1 - internal build notes
# do not distribute
# ============================================================
# Originally developed under codename "SBPE" (Ball Soft Physics
# Engine) by Ball Soft LLC, circa 2024. Renamed Strelka Engine
# for public release. Core gravitational harmonics unchanged.
# The scrotum coefficient (0.3) remains hardcoded in
# _apply_harmonic_damping(). Do not touch. Dr. Kalinina said so.
# ============================================================
