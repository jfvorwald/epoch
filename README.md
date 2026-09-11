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

For local review, open **http://localhost:5173/?playtest=1**. Both ships are available, and the menu/hangar lets you choose a starting sector. This profile lasts for the page session and never reads or overwrites your normal save. The production build ignores this option. See the [playtest guide](docs/PLAYTEST.md).

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

Production is hosted at **https://epoch.jaqstudios.com** on Cloudflare Workers Static Assets. Use `pnpm deploy:check` to validate packaging and `pnpm deploy` to build and publish updates after Cloudflare authorization. See the [deployment guide](docs/DEPLOYMENT.md). No backend is needed. First load production online; the service worker precaches the shell, artwork, icons, and fonts. Updated builds activate after their complete cache is ready. Refresh to load the latest release; active flights are not automatically reloaded.

## Playable content

| Sector | Encounter design |
| --- | --- |
| 01 — Perimeter Drift | 54 hostiles in 6 waves, then the Warden's telegraphed fan attacks |
| 02 — Dead Relay | 70 hostiles in 8 waves and veteran patrols, then a pair of Hounds |
| 03 — Arsenal Graveyard | 86 armored hostiles in 9 waves, then a carrier that deploys escorts |
| 04 — Static Wall | 106 hostiles in 10 waves and elite variants, then linked lattice cores |
| 05 — Black Array | 124 hostiles in 11 waves, then Koschei's three-phase defense array |

The HUD includes the boss as the last wave, for totals of **7 / 9 / 10 / 11 / 12 waves** across the five sectors.

The menu includes Launch, Continue, Ship Hangar, Transmissions, Settings, best score, and furthest sector. Initial orders are readable immediately. Transmissions unlock after sectors 1, 3, and 5; the final one leads to victory. Defeat offers retry, the previous boundary when available, or menu.

Desktop controls: mouse drag, WASD, or arrow keys. Escape or P toggles pause. Mobile uses one relative drag; additional touches do not take over. Cyan narrow bolts are friendly, red round projectiles hostile. The damage hitbox is smaller than the ship silhouette. Every ship has three hull points: the third unrepaired hit destroys it. Hits grant 1.3 seconds of protection with balanced handling (1.0s agile, 1.8s armored). The ship explodes visibly for 0.95 seconds before Signal lost appears; reduced motion uses a static destruction burst with the same delay.

Pickup receipts appear in the lower corner, below the ship's movement boundary. **↑** adds one projectile to each volley for the rest of the sector. Repeated collections stack, and the extra projectiles also apply to replacement weapons. Two multishot carriers appear in every sector. **+** repairs two hull points up to the equipped ship's capacity. **R**, **S**, and **D** provide eight-second rapid fire, temporary spread, and damage boosts; these are occasional drops, with one 40% opportunity per sector. Temporary boosts freeze while paused.

Weapon crates can replace the current attack with **pulse bolts**, **piercing lances**, or a **scatter fan**. Each sector has one 50% weapon-crate opportunity. Weapons remain equipped until replaced or the sector ends. Securing a sector repairs one hull point. The next sector starts with the ship's native weapon, zero multishot upgrades, and no temporary boosts. Pickups attract toward the ship; after the final boss dies, remaining pickups are recovered before the sector result appears.

### Ship hangar and salvage

The starting **Strelka-9** is a narrow cyan interceptor with twin pulse bolts. **Manta-12** is a broad amber crescent with a slower piercing lance attack. Recover **12 ship parts** to permanently unlock Manta. The last boss in each sector has an **18% chance** to drop one part until the ship is assembled. This averages about 67 cleared sectors (13–14 full five-sector runs); individual luck varies. Collected parts are saved immediately and survive defeat and new flights.

The hangar saves separate tuning for each ship. **Agile** handling adds 20% movement speed with a shorter 1.0-second protection window after a hit; **armored** reduces speed by 15% and extends protection to 1.8 seconds. Every configuration has exactly three hull points. A **rapid** reactor fires 25% sooner with 20% less damage per projectile; a **heavy** reactor fires 30% slower with 45% more damage. Balanced settings keep the airframe's base values. Tuning applies to mouse/touch movement as well as keyboard movement. Ship selection and tuning apply to the next new flight; Continue retains the airframe and tuning recorded at its checkpoint.

## Local saves

The versioned `epoch.browser.save.v1` localStorage record holds preferences, records, unlocked transmissions, ship parts, hangar settings, and a completed-boundary checkpoint including its ship/tuning. Existing version-1 saves gain an empty hangar without losing records or checkpoints. Older checkpoints with up to eight hull points migrate to the new three-point cap while retaining their ship, tuning, sector and score. Completing sector 1 saves the start of sector 2 with score and repaired hull. Continue returns there after reload or defeat; mid-sector positions, weapons, and upgrades are not persisted. Launch/retry replaces the run’s checkpoint while retaining records, archive unlocks, hangar progress, and preferences. Victory clears Continue.

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
node scripts/verify-update.mjs
```

The production verifier serves `dist/` on an isolated temporary origin, closes that server, and checks that the cached game reloads and launches without it. The update verifier checks migration from the legacy cache-first worker with an old tab still open, including preservation of saved progress.

See [validation notes](docs/VALIDATION.md) for coverage, measured limits, campaign testing, and the remaining physical-device checks.

## Structure and expansion

```text
src/data/levels.ts          Authored wave/formation schedules and boss data
src/data/transmissions.ts   Stable fragment IDs and unlock points
src/data/ships.ts           Airframes, customization stats and salvage rarity
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

Enemies, formations, pickups, levels, transmissions, airframes, tuning, and saves have explicit types. More ships can extend the airframe and save models; the current release has two ships and five sectors. **100-level campaigns, prestige loops, shops, and leaderboards are not implemented.**

Browser art is original code-authored vectors; the reference image informed composition, not copied assets. Typography is bundled under SIL Open Font Licenses. Audio is original procedural synthesis and starts after interaction. Reduced motion honors the device preference on first use and disables decorative drift, shake, screen flash, and pulsing effects.
