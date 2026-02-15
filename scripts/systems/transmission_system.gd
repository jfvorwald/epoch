extends Node

var transmissions: Array = []
var shown_transmissions: Array = []

signal show_transmission(text: String, sender: String)
signal transmission_closed

func _ready() -> void:
	load_transmissions()

func load_transmissions() -> void:
	var file := FileAccess.open("res://data/transmissions.json", FileAccess.READ)
	if file:
		var json := JSON.new()
		var result := json.parse(file.get_as_text())
		if result == OK:
			transmissions = json.data.get("transmissions", [])
		file.close()

func get_transmission_for_level(level: int) -> String:
	# Show transmissions at certain intervals
	# Every 3-5 levels, chance of a transmission
	if level % 3 != 0:
		return ""

	# Find transmissions valid for this level range
	var valid: Array = []
	for t in transmissions:
		if t.get("min_level", 1) <= level and t.get("max_level", 100) >= level:
			if not t.get("id", "") in shown_transmissions:
				valid.append(t)

	if valid.is_empty():
		# Allow repeats if we've shown them all
		for t in transmissions:
			if t.get("min_level", 1) <= level and t.get("max_level", 100) >= level:
				valid.append(t)

	if valid.is_empty():
		return ""

	# Pick weighted random
	var total_weight: float = 0.0
	for t in valid:
		total_weight += t.get("weight", 1.0)

	var roll := randf() * total_weight
	var cumulative: float = 0.0
	for t in valid:
		cumulative += t.get("weight", 1.0)
		if roll <= cumulative:
			shown_transmissions.append(t.get("id", ""))
			emit_signal("show_transmission", t.get("text", ""), t.get("sender", "UNKNOWN"))
			return t.get("text", "")

	return ""

func close_transmission() -> void:
	emit_signal("transmission_closed")
