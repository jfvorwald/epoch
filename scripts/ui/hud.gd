extends CanvasLayer

@onready var hp_label: Label = $MarginContainer/VBoxContainer/HPLabel
@onready var level_label: Label = $MarginContainer/VBoxContainer/LevelLabel
@onready var score_label: Label = $MarginContainer/VBoxContainer/ScoreLabel

func _ready() -> void:
	GameManager.score_changed.connect(_on_score_changed)
	Progression.level_changed.connect(_on_level_changed)
	update_display()

func update_display() -> void:
	if level_label:
		level_label.text = Progression.get_level_display()
	if score_label:
		score_label.text = "SCORE: %d" % GameManager.score

func update_hp(current_hp: int, max_hp: int) -> void:
	if hp_label:
		hp_label.text = "HP: %d / %d" % [current_hp, max_hp]

func _on_score_changed(new_score: int) -> void:
	if score_label:
		score_label.text = "SCORE: %d" % new_score

func _on_level_changed(level: int, era: int) -> void:
	if level_label:
		level_label.text = "Era %d - Level %d" % [era, level]

func show_game_over() -> void:
	if hp_label:
		hp_label.text = "GAME OVER - TAP TO RESTART"

func show_level_complete() -> void:
	if level_label:
		level_label.text = Progression.get_level_display() + " - COMPLETE!"
