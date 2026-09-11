# Godot source review

Reviewed the original Godot project before the browser implementation. This is a source and scene inspection, not a claim that the Godot build was run. The original `project.godot`, `scripts/`, `scenes/`, `data/`, and `assets/` remain available. The browser slice is a separate TypeScript/Vite application at the repository root.

The current user request defines the browser scope. `README.md` and `CLAUDE.md` supply setting and historical design context, rather than additional requirements. In particular, the browser slice contains five authored sectors; it does not claim to implement 100 sectors or prestige.

## Behavior present in the original code

| Feature | Source evidence | Implementation detail |
| --- | --- | --- |
| Portrait playfield | `project.godot` | 720 × 1280 viewport, portrait orientation, canvas stretch. |
| Movement and automatic fire | `scripts/player/player.gd` | Ship interpolates toward the absolute mouse position and is clamped to the viewport. Mouse-to-touch emulation is enabled. The fire timer runs in `_process`; this is not relative drag input. |
| Three enemy types | `scripts/enemies/base_enemy.gd` | Straight descent, sine-wave zigzag, and slower shooters with downward bullets. |
| Formations | `scripts/enemies/enemy_spawner.gd`, `base_enemy.gd` | Enemies enter a row, interpolate into hold positions, and release as a group after a timer. |
| Collectible buffs | `scripts/powerups/powerup.gd`, `player.gd`, `base_enemy.gd` | Weighted drops attract toward the ship; health restores two HP; rapid fire, spread, and triple damage last eight seconds. Bullet sprites vary with buff state. |
| Combat feedback | `player.gd`, `base_enemy.gd`, projectile scripts | Area-based collisions, HP, brief color flashes, enemy destruction score, procedural shot/hit/destruction sounds. |
| Progression and retry | `scripts/systems/game_level.gd`, `game_manager.gd`, `progression.gd` | Starts combat immediately; clears the battlefield and resets player health each level; increments level; tap restarts after death. |
| HUD | `scripts/ui/hud.gd` | Text for HP, score, level/era, active buffs, completion, and game over. |
| Intercepted transmissions | `scripts/systems/transmission_system.gd`, `scripts/ui/transmission_popup.gd`, `data/transmissions.json` | Eight fragments, sender labels, weighted selection within level ranges every third level, a dismiss button, and in-memory repeat avoidance. |
| Sound | `scripts/systems/audio_manager.gd` | Generated SFX, four audio players per effect, and a background-music loader looking for an optional file. No background-music file exists in the supplied assets. |
| Ship visual change | `scripts/player/player.gd` | A second player texture is selected at level 10. This is a run-time texture swap, not a saved upgrade system. |

## Described or scaffolded, not complete gameplay

- Voss, the Strelka-9, Volkov, Kalinina, the Collapse, and the mysterious Signal provide the setting. Some appear in the JSON transmissions; the wider story and changing timelines are prose, not an implemented narrative campaign.
- `max_level_per_era = 100` is declared, but `advance_level()` only increments the level. There is no level-100 boundary, epoch reset, prestige, or persistent gear/upgrade system.
- The `MENU` state exists in an enum, but the main scene immediately starts the game. There are no working title-menu options, Continue, transmission archive, or settings screens.
- There is no boss implementation, authored five-level campaign, victory screen, local save/restore, high-score persistence, pause UI, or browser/PWA integration.
- Background music has an optional loader; it is not supplied music. The shop, leaderboards, additional eras, and gear/loot progression in the design document are future ideas.

## Documentation drift and correctness risks

- `CLAUDE.md` lists power-up gameplay under “Future,” while the scripts already implement all four requested pickups. The code takes precedence when reporting implemented behavior.
- The design document describes one- or two-HP enemies and a 0.3-second minimum spawn interval. The spawner replaces enemy HP with `Progression.get_enemy_hp()` (3/5/7/10/14 across thresholds) and uses a 0.8-second spawn floor.
- A formation is released only when its group reaches the full formation size. A final partial group can remain holding indefinitely and block level completion.
- The damage flash does not create damage invulnerability. Multiple contacts can remove health in quick succession.
- Buff timers are independent coroutines. Recollecting a buff does not cancel its earlier timer, so an older timer can end a refreshed buff early.
- Player processing and the rest of the battlefield are not suspended as a whole during a transmission or game-over overlay. The browser implementation needs an explicit active-combat boundary.
- No local persistence is present. “Continue” and settings restoration are new browser behavior, not a ported Godot capability.

## Browser adaptation

Preserve the recognizable core: an automatically firing Strelka-9, formation attacks, three enemy behaviors, collectible buffs, and intercepted military transmissions. Add relative one-thumb movement, readable invulnerability, deterministic sector layouts, a final defense-platform boss, a complete menu/run flow, boundary checkpoints, preference persistence, and mobile browser handling. Original browser artwork should retain the aerospace atmosphere while keeping enemy fire and pickups easy to read.
