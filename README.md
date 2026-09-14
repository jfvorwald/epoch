# EPOCH — Jaq Studios

A complete portrait arcade shooter built with TypeScript, Phaser 3, and Vite. Pilot Voss’s Strelka-9 through 50 authored story levels and an endless frontier, recover intercepted transmissions, and follow a missing convoy toward the source of the Signal.

**Play: [epoch.jaqstudios.com](https://epoch.jaqstudios.com/)**. On iPhone, open this address in Safari and choose **Share → Add to Home Screen** after the first online load.

Read the [Beyond the Signal patch notes](docs/PATCH_NOTES.md) for the September 14, 2026 release.

The original Godot project remains at the repository root: open `project.godot` in Godot 4.3+. Its scenes, GDScript, textures, and story JSON are unchanged. The [original README](docs/GODOT_README.md) and [source review](docs/GODOT_REVIEW.md) distinguish existing behavior from documented ambitions.

## Run the browser game

Use Node.js 22.12+ (Node 24 was used for validation) and pnpm:

```sh
pnpm install
pnpm dev
```

Open **http://localhost:5173/**. Vite listens on all interfaces and uses port 5173. The committed lockfile pins the tested dependencies. `npm install` and `npm run dev` also work; pnpm is preferred for reproducing the lockfile.

For local review, open **http://localhost:5173/?playtest=1**. Both ships are available, and the menu/hangar lets you choose a starting level. This profile lasts for the page session and never reads or overwrites your normal save. The production build ignores this option. See the [playtest guide](docs/PLAYTEST.md).

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

Production is hosted at **https://epoch.jaqstudios.com** on Cloudflare Workers Static Assets. Private review uses **https://epoch-staging.jaqstudios.com**, protected by Cloudflare Access. Use `pnpm deploy:check` to run unit tests, build, and validate staging packaging; `pnpm deploy` publishes a review build to staging. After reviewing it, use `pnpm deploy:production <release-id>` to publish the exact saved artifact. Production is always a separate release action. See the [deployment guide](docs/DEPLOYMENT.md). Core gameplay and local saves work without a backend; private beta feedback uses an isolated staging service. First load production online; the service worker precaches the shell, artwork, icons, and fonts. Updated builds activate after their complete cache is ready. Refresh to load the latest release; active flights are not automatically reloaded.

## Playable content

A **level** is a full mission; **waves** are the encounters inside it. These terms and the campaign rules are recorded in `src/data/config.ts` and `AGENTS.md`.

The initial five levels—Perimeter Drift, Dead Relay, Arsenal Graveyard, Static Wall and Black Array—form the first branch of a **50-level Signal Map**. The map connects ten chapters, with five levels each, and reveals chapter details as progress is made. Mission nodes expose level briefings; an archive keeps recovered transmissions readable. The original five remain visible on the desktop flight board, with the greater tree accessible on desktop and phone.

| Chapter | Levels | Story |
| --- | --- | --- |
| The First Transmission | 1–5 | Follow the impossible call through the abandoned orbital fleet. |
| The Missing Convoy | 6–10 | Trace an evacuation erased from the official records. |
| Cities Between Seconds | 11–15 | Discover who is still waiting outside ordinary time. |
| Mutiny of Light | 16–20 | Decide whose orders deserve to be followed. |
| The Drowned Observatory | 21–25 | Find Kalinina and recover the first expedition's evidence. |
| The Unmapped Dark | 26–30 | Learn what is pursuing the convoy through the silence. |
| A Thousand Small Fires | 31–35 | Build a rescue network that no single voice can control. |
| The Price of Return | 36–40 | Help both sides of the corridor choose to stay open. |
| The Heart of the Signal | 41–45 | Reach the listening engine and recover Voss's promise. |
| The Open Sky | 46–50 | Bring the fleet through and answer the Signal. |

Each authored level has its own destination, briefing, guardian identity and story installment. Level 50 resolves the main story and saves **level 51**. Levels 51 onward are generated rescue routes with increasing durability, varied formations and guardians, and bounded movement/projectile speeds. The game does not reset to level 1 or clear Continue when the story ends. The full narrative treatment and script are in [STORY.md](docs/STORY.md); that document contains spoilers.

Every authored level has a distinct visual identity in `src/data/visuals.ts`: its own palette, fleet, hull configuration, scenery arrangement and star drift. Ten environment families include orbital planets, relay stations, wreck fields, nebulae, defense arrays, gardens, ice, suspended oceans, rifts and beacon chains. The first five all use different environments and hull families. Levels beyond 50 generate repeatable visual variations alongside their difficulty.

Enemy and guardian artwork is drawn at twice its display resolution from ten hull families and five exterior configurations. All 50 authored levels have distinct enemy silhouettes, colors and armor details; weavers retain stabilizer fins, shooters have twin barrels, and guardians keep recognizable attack-role architecture. Decorative scenery stays behind gameplay, with a darker lower flight area. Artwork uses its own deterministic inputs, so it cannot alter asteroid rolls or rewards. Only the current environment and nine fleet textures are retained between levels.

Every level has **8–10 total waves**, including its final guardian. At each launch the game randomly replaces **zero, one, or two** middle waves with asteroid encounters. The roll stays fixed while paused. Asteroids cross at varied angles from the top and both sides, including rising side passes, with staggered entries. They are destructible and return along new paths if they leave the playfield. Every hostile must be killed before the next wave starts. Wave replacements preserve weapon, hull and power-array rewards.

The first wave of each authored or endless level takes **4–5 standard Strelka pulse hits per enemy**, using balanced reactor tuning and no upgrades or buffs. Enemy weaknesses are included in that target; other weapons and reactor choices retain their damage differences. Later-wave durability, guardian health, upgrade strength and drop timing retain their existing tuning.

The main menu centers the ship above a single solid Launch button. **Edit Ship** stays visible in a compact airframe row; Continue, Signal Map, Archive and Settings use quieter navigation links. **Ship Parts / 12** and Manta assembly progress remain visible on the menu, in the hangar, during flight, and on other screens. Initial orders are readable immediately; another transmission unlocks after every authored level. Defeat offers retry, the previous saved boundary when available, or menu.

Desktop controls: mouse drag, WASD, or arrow keys. Escape or P toggles pause. Mobile uses one relative drag; additional touches do not take over. Friendly blasts use cyan, violet or amber weapon colors; hostile blasts use coral, pink or gold cores with role-specific shapes. The damage hitbox is smaller than the ship silhouette. Every ship has three hull points: the third unrepaired hit destroys it. Hits grant 1.3 seconds of protection with balanced handling (1.0s agile, 1.8s armored). The ship explodes visibly for 0.95 seconds before Signal lost appears; reduced motion uses a static destruction burst with the same delay.

**Training Wheels** in Settings optionally shows enemy return routes, asteroid entry and return paths, predicted shots, impact zones and safe lanes. It is **off by default**, including for existing saves that do not have the setting. Actual enemies, asteroids, projectiles, mines and black-hole portals remain visible in both modes. The toggle changes guides only, takes effect immediately while paused, and saves on the device; Reduced Motion still controls visual motion separately.

Pickup receipts appear in the lower corner, below the ship's movement boundary. **↑** increases **weapon power**, shown as **0–12** with a persistent meter. The first seven upgrades increase the starting single shot to eight shots per volley. Upgrades 8–12 add 25% base blast damage each, reaching **8 shots / 2.25× blast / MAX**. Power carries across weapon changes and resets each level. The first two waves have no arrays; each later non-guardian wave has one, giving 5–7 upgrades per level. Further arrays leave power capped. **+** repairs two hull points. **R**, **S**, and **D** provide eight-second rapid fire, spread, and damage boosts, with one 40% opportunity per level. Spread never exceeds eight projectiles; excess spread increases damage instead. Temporary boosts freeze while paused.

Projectile weaknesses deal **1.6×** damage: pulse against weavers, scatter against straight drones, and lance against shooters and asteroids. Guardian weaknesses vary too. The field guide lists them, and wave notices identify the current weakness. A projectile keeps its type even if the ship changes weapons before it lands.

Weapon crates can replace the current attack with **pulse bolts**, **piercing lances**, or a **scatter fan**. Each level has one 50% weapon-crate opportunity. Weapons remain equipped until replaced or the level ends. Securing a level repairs one hull point. The next level starts with the ship's native weapon, zero multishot upgrades, and no temporary boosts. Pickups attract toward the ship; after the final boss dies, remaining pickups are recovered and live hostile shots must clear before the level result appears.

### Ship hangar and salvage

The starting **Strelka-9** is a narrow cyan interceptor with pulse bolts. **Manta-12** is a broad amber crescent with a slower piercing lance attack. Recover **12 ship parts** to permanently unlock Manta. The last boss in each level has an **18% chance** to drop one part until the ship is assembled. This averages about 67 cleared levels; individual luck varies. Collected parts are saved immediately and survive defeat and new flights.

The hangar saves separate tuning for each ship. **Agile** handling adds 20% movement speed with a shorter 1.0-second protection window after a hit; **armored** reduces speed by 15% and extends protection to 1.8 seconds. Every configuration has exactly three hull points. A **rapid** reactor fires 25% sooner with 20% less damage per projectile; a **heavy** reactor fires 30% slower with 45% more damage. Balanced settings keep the airframe's base values. Tuning applies to mouse/touch movement as well as keyboard movement. Ship selection and tuning apply to the next new flight; Continue retains the airframe and tuning recorded at its checkpoint.

## Local saves

The versioned `epoch.browser.save.v1` localStorage record holds preferences, records, unlocked transmissions, ship parts, hangar settings, and a completed-boundary checkpoint including its ship/tuning. Existing version-1 saves retain records, checkpoints and hangar progress. Missing or malformed Training Wheels values become `false`, while saved boolean choices are retained. The old `furthestSector` property migrates to `furthestLevel`; a legacy completed five-level save gains a level-6 checkpoint. Newly added messages from already completed levels become available in the archive. Older checkpoints with up to eight hull points migrate to the new three-point cap while retaining their ship, tuning, level and score. Completing level 1 saves the start of level 2 with score and repaired hull. Continue returns there after reload or defeat; mid-level positions, weapons, and upgrades are not persisted. Launch/retry replaces the run’s checkpoint while retaining records, archive unlocks, hangar progress, and preferences. Story completion keeps Continue at level 51; endless checkpoints persist beyond that.

Corrupt or incompatible saves fall back safely. With blocked/full device storage, gameplay continues and outcome screens identify a session-only checkpoint. Saves belong to the origin/browser/device: LAN, localhost, hosted URL, and installed app storage can differ.

## Guardian attacks and weapon drops

Fired projectiles remain live after their source is destroyed, including across wave boundaries. After the final guardian falls, evade its remaining shots while collecting salvage; the level ends when those hazards have cleared. Each player airframe/weapon combination has its own blast silhouette, and hostile roles use distinct shots.

Guardians use five mechanics: Warden moving gates, Twins scissor crossings, Carrier fragmentation mines and drone bays, Lattice volleys with safe corridors, and Koschei's black-hole pincers. Attack routes lock during a windup lasting at least 1.2 seconds. Training Wheels shows these predicted routes and marks safe corridors; it also shows the 1.2-second asteroid entry guides. With the option off, windups and committed movement still run with the same timing. Reduced Motion keeps enabled guides readable without pulsing them.

Permanent weapon arrays start in wave three, with one per remaining normal wave (5–7 per level). A separate 30% roll can place one gold-star Supercharge in a middle/late combat wave. Supercharge grants effective power 12 for six seconds while preserving the earned power meter; another pickup refreshes the timer, and pause freezes it. The next level resets both earned weapon power and temporary boosts.

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
node scripts/verify-endless.mjs
node scripts/verify-visuals.mjs
node scripts/verify-enemy-visuals.mjs
node scripts/verify-production.mjs
node scripts/verify-staging.mjs
node scripts/verify-update.mjs
```

The production verifier serves `dist/` on an isolated temporary origin, closes that server, and checks that the cached game reloads and launches without it. The staging verifier loads the same built artifact under simulated staging and production hostnames and checks the build label, production controls, and launch/pause/resume in Chrome and iPhone-profile WebKit; it does not test Cloudflare SSO. The update verifier checks migration from the legacy cache-first worker with an old tab still open, including preservation of saved progress.

See [validation notes](docs/VALIDATION.md) for coverage, measured limits, campaign testing, and the remaining physical-device checks.

## Structure and expansion

```text
src/data/config.ts          Level/wave terminology and campaign/asteroid rules
src/data/levels.ts          Fifty authored levels and endless difficulty generation
src/data/story.ts           Ten-chapter structure and stable archive IDs
src/data/visuals.ts         Fifty visual identities and endless variation
src/game/LevelBackdrop.ts   Generated environment scenery
src/game/enemyVisuals.ts    Per-level enemy and guardian artwork
src/data/transmissions.ts   Stable fragment IDs and unlock points
src/data/ships.ts           Airframes, customization stats and salvage rarity
src/game/CombatScene.ts     Combat, controls, collisions, buffs and finite effects
src/game/math.ts            Swept collision and relative movement helpers
src/game/weapons.ts         Capped power progression and projectile weaknesses
src/game/asteroids.ts       Random wave selection and angled asteroid trajectories
src/game/save.ts            Versioned storage validation
src/game/audio.ts           Gesture-unlocked synthesized music and SFX
src/main.ts                DOM menus, HUD, flow and checkpoint policy
src/style.css              Cockpit design, safe areas and reduced motion
public/art/                Original SVG spacecraft, scenery and insignia
public/fonts/              Local OFL fonts and licenses
vite.config.ts             Build and offline-shell precache
```

Enemies, formations, pickups, levels, transmissions, airframes, tuning, and saves have explicit types. More ships can extend the airframe and save models; the current release has two ships, 50 authored levels and an endless frontier. Prestige loops, shops and leaderboards are not implemented.

Browser art is original code-authored vectors; the reference image informed composition, not copied assets. Typography is bundled under SIL Open Font Licenses. Audio is original procedural synthesis and starts after interaction. Reduced motion honors the device preference on first use and disables decorative drift, shake, screen flash, and pulsing effects.
