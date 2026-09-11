# EPOCH — Jaq Studios

A complete portrait arcade shooter built with TypeScript, Phaser 3, and Vite. Pilot Voss’s Strelka-9 through five authored sectors, recover intercepted transmissions, and confront the Koschei defense array.

**Play: [epoch.jaqstudios.com](https://epoch.jaqstudios.com/)**. On iPhone, open this address in Safari and choose **Share → Add to Home Screen** after the first online load.

The original Godot project remains at the repository root: open `project.godot` in Godot 4.3+. Its scenes, GDScript, textures, and story JSON are unchanged. The [original README](docs/GODOT_README.md) and [source review](docs/GODOT_REVIEW.md) distinguish existing behavior from documented ambitions.

## Run the browser game

Use Node.js 22.12+ (Node 24 was used for validation) and pnpm:

```sh
pnpm install
pnpm dev
```

Open **http://localhost:5173/**. Vite listens on all interfaces and uses port 5173. The committed lockfile pins the tested dependencies. `npm install` and `npm run dev` also work; pnpm is preferred for reproducing the lockfile.

### Open from an iPhone on the same Wi-Fi

1. Keep `pnpm dev` running on your computer.
2. Connect the computer and iPhone to the same Wi-Fi. Allow local network access through the computer’s firewall if prompted.
3. Read the **Network** URL printed by Vite in your computer’s terminal and open it in **Safari on the iPhone**. The address depends on your current network. Do not use `localhost` on the phone: that means the phone itself.
4. Tap **Launch**. Touch anywhere in the playfield and drag. Movement is relative; the ship does not jump to the initial touch. Start your drag below the ship to leave it visible above your thumb. Lift to hold position. Weapons fire automatically.
5. Tap **Ⅱ** to pause. Switching apps, leaving the page, canceling touch, or changing the viewport pauses the fight; resume explicitly.

If the phone cannot connect, check that both devices use the same LAN, guest Wi-Fi client isolation is off, and the firewall allows port 5173. Prefer the LAN address over a VPN/Tailscale address unless the phone uses that network too.

### Add to the Home Screen

In iPhone Safari choose **Share → Add to Home Screen**, enable **Open as Web App** if offered, and add **EPOCH**. The manifest, portrait orientation preference, standalone metadata, safe-area padding, and custom icons are included. [Apple’s instructions](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).

The HTTP Wi-Fi development build supports online play. **Service workers and offline installation require HTTPS or localhost**, so use an HTTPS-hosted production build for dependable installed/offline use on the phone. A computer’s local IP over HTTP is not a secure context. [Service worker requirements](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).

```sh
pnpm build
pnpm preview
```

Production is hosted at **https://epoch.jaqstudios.com** on Cloudflare Workers Static Assets. Use `pnpm deploy:check` to validate packaging and `pnpm deploy` to build and publish updates after Cloudflare authorization. See the [deployment guide](docs/DEPLOYMENT.md). No backend is needed. First load production online; the service worker precaches the shell, artwork, icons, and fonts. Updated builds receive a new cache revision and activate after old tabs close.

## Playable content

| Sector | Encounter design |
| --- | --- |
| 01 — Perimeter Drift | Chevrons and arcs, then weaving pincers; introduces rapid and spread |
| 02 — Dead Relay | Crossing patrols, fast columns, first aimed shooter formations |
| 03 — Arsenal Graveyard | Armored shooters and escorts; damage boosts and layered attacks |
| 04 — Static Wall | Six mixed formations with faster dives |
| 05 — Black Array | Final escorts followed by Koschei’s three-phase defense array |

The menu includes Launch, Continue, Transmissions, Settings, best score, and furthest sector. Initial orders are readable immediately. Transmissions unlock after sectors 1, 3, and 5; the final one leads to victory. Defeat offers retry, the previous boundary when available, or menu.

Desktop controls: mouse drag, WASD, or arrow keys. Escape or P toggles pause. Mobile uses one relative drag; additional touches do not take over. Cyan narrow bolts are friendly, red round projectiles hostile. The damage hitbox is smaller than the ship silhouette. Hits grant 1.3 seconds of invulnerability.

Pickups: **+** restores two hull points up to five; **R** doubles firing rate; **S** adds angled streams; **D** doubles projectile damage. Weapon buffs last eight seconds, combine across types, refresh on recollection, and freeze while paused. Pickups attract toward the ship and eventually magnetize automatically. Securing a sector repairs one hull point and clears temporary buffs.

## Local saves

The versioned `epoch.browser.save.v1` localStorage record holds preferences, records, unlocked transmissions, and a completed-boundary checkpoint. Completing sector 1 saves the start of sector 2 with score and repaired hull. Continue returns there after reload or defeat; mid-sector positions and buffs are not persisted. Launch/retry replaces the run’s checkpoint while retaining records, archive unlocks, and preferences. Victory clears Continue.

Corrupt or incompatible saves fall back safely. With blocked/full device storage, gameplay continues and outcome screens identify a session-only checkpoint. Saves belong to the origin/browser/device: LAN, localhost, hosted URL, and installed app storage can differ.

## Validation

```sh
pnpm test
pnpm exec playwright install webkit
pnpm test:e2e
```

The desktop test uses installed Google Chrome. Install Chrome or adjust `channel: 'chrome'` in `playwright.config.ts`. WebKit emulates an iPhone 13 viewport on the Mac: **browser simulation, not a physical iPhone test**.

With the development server on 5173, and after `pnpm build`:

```sh
node scripts/verify-touch.mjs
node scripts/verify-campaign.mjs
EPOCH_BROWSER=webkit node scripts/verify-campaign.mjs
node scripts/verify-production.mjs
```

The production verifier serves `dist/` on an isolated temporary origin, closes that server, and checks that the cached game reloads and launches without it.

See [validation notes](docs/VALIDATION.md) for coverage, measured limits, campaign testing, and the remaining physical-device checks.

## Structure and expansion

```text
src/data/levels.ts          Authored wave/formation schedules and boss data
src/data/transmissions.ts   Stable fragment IDs and unlock points
src/game/CombatScene.ts     Combat, controls, collisions, buffs and finite effects
src/game/math.ts            Swept collision and relative movement helpers
src/game/save.ts            Versioned storage validation
src/game/audio.ts           Gesture-unlocked synthesized music and SFX
src/main.ts                DOM menus, HUD, flow and checkpoint policy
src/style.css              Cockpit design, safe areas and reduced motion
public/art/                Original SVG spacecraft, scenery and insignia
public/fonts/              Local OFL fonts and licenses
vite.config.ts             Build and offline-shell precache
```

Enemies, formations, pickups, levels, transmissions, and saves have explicit types. Future 100-level epochs can add schedules and story IDs; persistent upgrades require a save migration and upgrade model. **100-level campaigns, prestige loops, persistent upgrades, shops, and leaderboards are not implemented.**

Browser art is original code-authored vectors; the reference image informed composition, not copied assets. Typography is bundled under SIL Open Font Licenses. Audio is original procedural synthesis and starts after interaction. Reduced motion honors the device preference on first use and disables decorative drift, shake, screen flash, and pulsing effects.
