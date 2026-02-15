# EPOCH

**A post-Soviet retro gundam-style mobile shooter by Ball Soft.**

Powered by the Scrotum-Based Physics Engine.

---

## The Story

### Prologue: The Signal

It's 2049. The internet is dead. Not broken — *dead*. Every server, every satellite, every undersea cable went silent at exactly 00:00:00 UTC on January 1st. The moment the Unix epoch counter hit 2,493,849,600, something woke up inside it.

They called it **The Collapse**. Three billion devices, all broadcasting the same thing: a single repeating signal, pulsing in a frequency that shouldn't exist. Governments fell. Cities went dark. The old world ended not with a bang, but with a ping.

### The Pilot: Voss

You are **Voss** — callsign, not a name. Nobody remembers names anymore. You're a pilot in the **Kosmoflot**, the last military force still operational, cobbled together from the ruins of post-Soviet aerospace programs and whatever machines still answer to human hands.

Your ship is a **Strelka-9** — half-gundam, half-fighter, running on the only engine that still works in the new physics: the **Scrotum-Based Physics Engine**. Don't ask how it got the name. The engineer who built it, Dr. Kalinina, had a sense of humor and a death wish. She's gone now. The engine remains.

### The Mission

The signal is coming from somewhere beyond the static wall — a boundary in low orbit where all electromagnetic radiation turns to noise. Nothing that enters comes back. But the signal punches through it like it isn't there.

Kosmoflot Command — what's left of it, operating from a bunker under what used to be Mirny-7 — has one order: **fly into the static wall, find the source of the signal, and kill it.**

One hundred levels of hostile airspace stand between you and the wall. The machines that went silent? They didn't stay silent. They *changed*. Drones, defense grids, automated weapons platforms — all reprogrammed by the signal, all pointing their guns at anything still human.

### The Transmissions

As you fight through each sector, your ship intercepts **transmissions** — fragments of communication from before and during The Collapse. Some are military orders. Some are distress calls. Some are... wrong. Messages from the future. Messages from yourself. Messages that know what you're about to do before you do it.

Commander Volkov's voice crackles through most of them. He was the last one to fly past sector 50. He says the machines remember everything. He says the signal isn't attacking — it's *inviting*.

### The Epochs

Here's the part they don't tell you in the briefing:

The static wall isn't a wall. It's a loop. When you break through level 100, you don't reach the other side. You reach **the beginning again** — but everything is different. Harder. Faster. The enemies have evolved. The transmissions have changed. The story shifts.

Each loop is an **Epoch**. Each epoch is a prestige cycle. The machines learn from your previous run. The signal adapts. But so do you — your weapons carry over, your ship upgrades persist, and each epoch reveals a deeper layer of what actually happened on January 1st, 2049.

The question isn't whether you can survive 100 levels.

The question is: **how many epochs until you understand what the signal actually wants?**

### Key Characters

- **Voss** — The pilot. You. Callsign inherited from the previous pilot, who inherited it from the one before. How many Vosses have there been?
- **Cmdr. Volkov** — Your handler. His transmissions guide you through early levels. But his timeline doesn't match yours.
- **Dr. Kalinina** — Creator of the Scrotum-Based Physics Engine. Officially KIA. Her research notes keep showing up in transmissions, and they describe things that haven't happened yet.
- **The Signal** — Not a character. Not a weapon. Not an AI. Something older. Something that was running before January 1st, 1970, and has been counting ever since.

---

## Gameplay

### Core Loop
1. Ship follows your finger/mouse, auto-fires upward
2. Enemies form up at the top of the screen, then descend in waves
3. Kill enemies to drop weapon buffs (fire rate, spread shot, damage) and health
4. Survive all waves to complete the level
5. Intercepted transmissions appear between levels
6. 100 levels per epoch, then prestige into the next

### Enemy Types
- **Straight** — Red squares, fly straight down
- **Zigzag** — Orange diamonds, weave side to side
- **Shooter** — Magenta triangles, slow but fire back at you

### Power-ups
- **Health** (green) — Restores HP
- **Rapid Fire** (orange) — Doubles fire rate for 8 seconds
- **Spread Shot** (blue) — Multi-directional bullets for 8 seconds
- **Damage Boost** (red) — 3x bullet damage for 8 seconds

Power-ups are attracted toward your ship when nearby.

---

## Running

1. Open project in Godot 4.x
2. Hit Play (F5)
3. Survive.

```
/snap/bin/gd-godot-engine-snapcraft --path ~/epoch --rendering-driver opengl3
```

## Sprite Sizes (For Artists)

| Asset | Size | Notes |
|-------|------|-------|
| Player ship | 64x64 px | Facing UP |
| Enemies | 32x32 to 64x64 px | Facing DOWN |
| Bullets (default) | 8x16 px | |
| Bullets (rapid) | 6x16 px | Thin, orange |
| Bullets (spread) | 10x12 px | Blue triangle |
| Bullets (damage) | 12x16 px | Fat, red/white |
| Power-ups | 24x24 px | Per-type sprites |

All sprites: transparent PNG with alpha channel. Drop replacements into `assets/sprites/` with matching filenames.

## Architecture

See `CLAUDE.md` for full design documentation.

---

*Ball Soft. Since the collapse.*
