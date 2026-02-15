extends Node

enum GameState { MENU, PLAYING, BETWEEN_LEVELS, GAME_OVER }

var state: GameState = GameState.MENU
var score: int = 0

signal state_changed(new_state: GameState)
signal score_changed(new_score: int)

func _ready() -> void:
	pass

func start_game() -> void:
	score = 0
	Progression.reset()
	change_state(GameState.PLAYING)
	emit_signal("score_changed", score)

func add_score(amount: int) -> void:
	score += amount
	emit_signal("score_changed", score)

func level_complete() -> void:
	change_state(GameState.BETWEEN_LEVELS)
	# Check for transmission
	var transmission := TransmissionSystem.get_transmission_for_level(Progression.current_level)
	if transmission != "":
		# Wait for transmission to be shown, then advance
		await TransmissionSystem.transmission_closed

	Progression.advance_level()
	change_state(GameState.PLAYING)

func game_over() -> void:
	change_state(GameState.GAME_OVER)

func restart() -> void:
	start_game()

func change_state(new_state: GameState) -> void:
	state = new_state
	emit_signal("state_changed", state)
