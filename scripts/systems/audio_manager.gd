extends Node

# SFX players - pooled for overlapping sounds
var sfx_players: Dictionary = {}
var sfx_samples: Dictionary = {}

# BGM player - placeholder for future music upload
var bgm_player: AudioStreamPlayer

# Volume settings (linear scale)
var sfx_volume: float = 0.7
var bgm_volume: float = 0.5

# Sound definitions: name -> {frequency, duration, type, volume_db}
const SFX_DEFS: Dictionary = {
	"shoot": {"freq": 880.0, "duration": 0.06, "type": "square", "volume_db": -18.0},
	"enemy_destroy": {"freq": 220.0, "duration": 0.15, "type": "noise_sweep", "volume_db": -10.0},
	"player_hit": {"freq": 150.0, "duration": 0.2, "type": "saw_drop", "volume_db": -8.0},
	"powerup": {"freq": 660.0, "duration": 0.15, "type": "arp_up", "volume_db": -10.0},
	"level_complete": {"freq": 440.0, "duration": 0.4, "type": "fanfare", "volume_db": -8.0},
	"game_over": {"freq": 200.0, "duration": 0.6, "type": "saw_drop_slow", "volume_db": -6.0},
	"transmission": {"freq": 1200.0, "duration": 0.3, "type": "radio_blip", "volume_db": -10.0},
}

# Pool size per sound (allows overlapping plays)
const POOL_SIZE: int = 4

func _ready() -> void:
	# Generate all SFX samples
	for sfx_name in SFX_DEFS:
		sfx_samples[sfx_name] = _generate_sample(SFX_DEFS[sfx_name])
		sfx_players[sfx_name] = []
		for i in POOL_SIZE:
			var player := AudioStreamPlayer.new()
			player.bus = "Master"
			add_child(player)
			sfx_players[sfx_name].append(player)

	# BGM player setup - load from assets/audio/bgm.ogg if it exists
	bgm_player = AudioStreamPlayer.new()
	bgm_player.bus = "Master"
	bgm_player.volume_db = linear_to_db(bgm_volume)
	add_child(bgm_player)
	_try_load_bgm()

func play(sound_name: String) -> void:
	if not sfx_samples.has(sound_name):
		return
	# Find an available player from the pool
	var pool: Array = sfx_players[sound_name]
	for player in pool:
		if not player.playing:
			player.stream = sfx_samples[sound_name]
			player.volume_db = SFX_DEFS[sound_name].get("volume_db", -10.0)
			player.play()
			return
	# All busy - steal the first one
	pool[0].stream = sfx_samples[sound_name]
	pool[0].volume_db = SFX_DEFS[sound_name].get("volume_db", -10.0)
	pool[0].play()

func _try_load_bgm() -> void:
	# Check for background music file
	# Drop your music as assets/audio/bgm.ogg or bgm.wav
	for ext in ["ogg", "wav", "mp3"]:
		var path := "res://assets/audio/bgm.%s" % ext
		if ResourceLoader.exists(path):
			bgm_player.stream = load(path)
			bgm_player.play()
			return

func _generate_sample(def: Dictionary) -> AudioStreamWAV:
	var sample_rate: int = 22050
	var duration: float = def.get("duration", 0.1)
	var freq: float = def.get("freq", 440.0)
	var type: String = def.get("type", "square")
	var num_samples: int = int(sample_rate * duration)
	var data := PackedByteArray()
	data.resize(num_samples * 2)  # 16-bit mono

	for i in num_samples:
		var t: float = float(i) / sample_rate
		var progress: float = float(i) / num_samples
		var sample: float = 0.0

		match type:
			"square":
				# Simple square wave with fast decay
				var phase := fmod(t * freq, 1.0)
				sample = 1.0 if phase < 0.5 else -1.0
				sample *= 1.0 - progress  # Linear decay

			"noise_sweep":
				# White noise burst with pitch sweep down - explosion feel
				var sweep_freq := freq * (1.0 - progress * 0.7)
				var phase := fmod(t * sweep_freq, 1.0)
				var tone := 1.0 if phase < 0.5 else -1.0
				var noise := randf() * 2.0 - 1.0
				sample = (tone * 0.3 + noise * 0.7) * (1.0 - progress)

			"saw_drop":
				# Sawtooth with pitch dropping - damage feel
				var drop_freq := freq * (1.0 - progress * 0.6)
				sample = fmod(t * drop_freq, 1.0) * 2.0 - 1.0
				sample *= 1.0 - progress

			"saw_drop_slow":
				# Slower sawtooth drop - game over
				var drop_freq := freq * (1.0 - progress * 0.8)
				sample = fmod(t * drop_freq, 1.0) * 2.0 - 1.0
				# Fade envelope: sustain then drop
				var envelope := 1.0 if progress < 0.6 else (1.0 - (progress - 0.6) / 0.4)
				sample *= envelope

			"arp_up":
				# Quick ascending arpeggio - powerup feel
				var step := int(progress * 4.0)
				var arp_freq := freq * pow(2.0, step / 6.0)
				var phase := fmod(t * arp_freq, 1.0)
				sample = 1.0 if phase < 0.5 else -1.0
				sample *= 0.8

			"fanfare":
				# Two-tone ascending - level complete
				var half := 0.5
				var note_freq: float
				if progress < half:
					note_freq = freq
				else:
					note_freq = freq * 1.5  # Perfect fifth up
				var phase := fmod(t * note_freq, 1.0)
				# Triangle wave for softer tone
				sample = abs(phase * 4.0 - 2.0) - 1.0
				# Envelope per note
				var note_progress := fmod(progress, half) / half
				sample *= 1.0 - note_progress * 0.5

			"radio_blip":
				# Static burst then tone - transmission feel
				if progress < 0.3:
					# Static
					sample = (randf() * 2.0 - 1.0) * 0.6
				else:
					# High beep
					var phase := fmod(t * freq, 1.0)
					sample = 1.0 if phase < 0.5 else -1.0
					sample *= 1.0 - (progress - 0.3) / 0.7

		# Clamp
		sample = clampf(sample, -1.0, 1.0)

		# Convert to 16-bit signed int
		var int_sample: int = int(sample * 32767.0)
		data[i * 2] = int_sample & 0xFF
		data[i * 2 + 1] = (int_sample >> 8) & 0xFF

	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = sample_rate
	stream.stereo = false
	stream.data = data
	return stream
