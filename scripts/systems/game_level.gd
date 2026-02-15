extends Node2D

@onready var player: Area2D = $Player
@onready var hud: CanvasLayer = $HUD
@onready var enemy_spawner: Node = $EnemySpawner
@onready var transmission_popup: CanvasLayer = $TransmissionPopup

var game_active: bool = false

func _ready() -> void:
	# Connect signals
	player.hp_changed.connect(hud.update_hp)
	player.player_died.connect(_on_player_died)
	enemy_spawner.wave_complete.connect(_on_wave_complete)
	enemy_spawner.enemy_destroyed_score.connect(_on_enemy_score)
	GameManager.state_changed.connect(_on_state_changed)

	# Start the game
	GameManager.start_game()

func _on_state_changed(new_state: GameManager.GameState) -> void:
	match new_state:
		GameManager.GameState.PLAYING:
			start_level()
		GameManager.GameState.GAME_OVER:
			hud.show_game_over()
			game_active = false

func start_level() -> void:
	game_active = true
	player.max_hp = Progression.get_player_max_hp()
	player.reset()
	player.global_position = Vector2(360, 1000)
	enemy_spawner.start_wave(Progression.current_level)

func _on_player_died() -> void:
	enemy_spawner.stop_wave()
	GameManager.game_over()

func _on_wave_complete() -> void:
	hud.show_level_complete()
	# Brief pause then advance
	await get_tree().create_timer(1.5).timeout
	GameManager.level_complete()

func _on_enemy_score(score: int) -> void:
	GameManager.add_score(score)

func _unhandled_input(event: InputEvent) -> void:
	# Tap to restart when game over
	if GameManager.state == GameManager.GameState.GAME_OVER:
		if event is InputEventMouseButton and event.pressed:
			GameManager.restart()
