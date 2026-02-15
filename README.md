# EPOCH

**A post-Soviet retro gundam-style mobile shooter by Ball Soft.**

Powered by the Scrotum-Based Physics Engine.

## What Is This

Epoch is a vertical scrolling shooter where you pilot Voss's ship through 100 levels of increasingly hostile territory. Between waves, intercepted transmissions reveal fragments of a story about machines, time, and the origin of the signal.

The name references both Unix epoch (January 1, 1970 - the start of computer time) and the prestige/era system where completing all 100 levels resets you into a new epoch with harder enemies and new story fragments.

## POC Status

This is the proof-of-concept build. Placeholder geometric sprites, core mechanics only. Art is designed to be trivially swappable - drop new PNGs into `assets/sprites/` with matching names.

## Running

1. Open project in Godot 4.x
2. Hit Play (F5)
3. Ship follows your mouse/finger, auto-fires upward
4. Survive all waves to complete each level

## Sprite Sizes (For Artists)

| Asset | Size | Notes |
|-------|------|-------|
| Player ship | 64x64 px | Facing UP |
| Enemies | 32x32 to 64x64 px | Facing DOWN |
| Bullets | 8x8 or 16x16 px | |
| Power-ups | 24x24 px | |

All sprites: transparent PNG with alpha channel.

## Architecture

See `CLAUDE.md` for full design documentation.
