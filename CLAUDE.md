# Epoch - Design Document & Project Conventions

## Overview
**Epoch** by **Ball Soft** - a post-Soviet retro gundam-style mobile vertical shooter.
Powered by the **Scrotum-Based Physics Engine**.

The name "Epoch" references:
1. Unix epoch (Jan 1, 1970) - the start of computer time
2. The prestige/era system - each epoch is a full 100-level run

## Game Design

### Core Loop
1. Player ship (Voss) auto-fires upward, follows finger/mouse
2. Enemies spawn from top in waves, move downward, some shoot back
3. Survive all enemies in a level → level complete
4. Between some levels, intercepted transmissions reveal story fragments
5. 100 levels per era/epoch
6. (Future) Complete era 100 → prestige into next epoch with harder enemies

### Player
- Ship follows touch/mouse position with smooth lerp
- Auto-fires continuously (no fire button)
- Takes damage on contact with enemies or enemy bullets
- HP system: starts at 5, scales with progression
- Dies at 0 HP → game over → tap to restart

### Enemy Types (POC)
1. **Straight** - moves straight down, 1 HP, 10 points
2. **Zigzag** - sinusoidal horizontal movement while descending, 1 HP, 15 points
3. **Shooter** - moves slowly, fires bullets downward, 2 HP, 25 points

### Difficulty Scaling
- Enemy count per level: 10 + (level * 2)
- Spawn interval decreases with level (min 0.3s)
- Enemy HP increases at level milestones (10, 30, 60)
- Player max HP increases every 10 levels
- Enemy type distribution shifts toward shooters at higher levels

### Transmissions
- Appear every 3 levels
- Weighted random selection from pool
- Level-gated (some only appear at certain level ranges)
- Story fragments about machines, time, signals, the Scrotum Engine
- Displayed as full-screen overlay with dismiss button

## Project Conventions

### Directory Structure
- `assets/sprites/` - ALL swappable art, organized by category
- `scenes/` - Godot .tscn scene files, mirrors script structure
- `scripts/` - GDScript files, organized by system
- `data/` - JSON data files

### Sprite Naming
`{category}_{era}_{variant}.png`
- `player_era1_base.png`
- `enemy_era1_zigzag.png`
- `bullet_player.png`
- `powerup_era1_health.png`

### Code Style
- GDScript (Godot's native language)
- Snake_case for variables and functions
- PascalCase for classes and node names
- Signals for decoupling (player doesn't know about HUD directly)
- Autoloads for global systems: GameManager, Progression, TransmissionSystem

### Physics Layers
1. Player (layer 1)
2. Enemies (layer 2)
3. Player bullets (layer 3)
4. Enemy bullets (layer 4)
5. Power-ups (layer 5)

### Collision Rules
- Player bullets hit enemies (layer 3 → mask 2)
- Enemy bullets hit player (layer 4 → mask 1)
- Player collides with enemies, enemy bullets, powerups (layer 1 → mask 2,4,5)
- Enemies collide with player bullets (layer 2 → mask 1,3)

### Art Swappability
All sprites are loaded by path from `assets/sprites/`. To swap art:
1. Create new PNGs at the exact same pixel dimensions
2. Name them identically to existing files
3. Drop them into the same folders
4. Godot auto-reimports on next editor open

### Viewport
- 720x1280 (portrait mobile)
- Canvas items stretch mode
- Expand aspect ratio

## Architecture Notes

### Autoload Singletons
- **GameManager** - game state machine (MENU, PLAYING, BETWEEN_LEVELS, GAME_OVER), score tracking
- **Progression** - level/era tracking, difficulty scaling, HP calculations
- **TransmissionSystem** - loads transmission JSON, selects by level/weight, emits signals

### Signal Flow
```
Player.hp_changed → HUD.update_hp()
Player.player_died → GameLevel._on_player_died() → GameManager.game_over()
EnemySpawner.wave_complete → GameLevel._on_wave_complete() → GameManager.level_complete()
EnemySpawner.enemy_destroyed_score → GameLevel._on_enemy_score() → GameManager.add_score()
GameManager.state_changed → GameLevel._on_state_changed()
GameManager.score_changed → HUD._on_score_changed()
Progression.level_changed → HUD._on_level_changed()
TransmissionSystem.show_transmission → TransmissionPopup._on_show_transmission()
```

## Future (Not In POC)
- Prestige/era system with new sprite sets per era
- Gear/loot drops from enemies
- Power-up gameplay (shield, spread shot, etc.)
- Pay-to-win shop (the monetization satire angle)
- Audio (chiptune meets Soviet synth)
- Multiple eras of transmissions revealing full story
- Boss enemies at level milestones
- Leaderboards
