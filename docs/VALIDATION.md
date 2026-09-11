# Browser validation — 11 September 2026

EPOCH browser publisher: **Jaq Studios**. Godot source was reviewed before implementation, not executed. The supplied reference image informed portrait composition; the new SVG artwork is original.

## Returning-player cache update

The user's existing live tab still loaded the original bundle despite the current server files matching the gameplay release. The legacy cache-first service worker kept serving its old HTML while an installed update waited for existing tabs to close.

- Updated workers activate after their complete precache succeeds, without forcing an active document to reload. Online navigation requests fresh HTML; offline navigation uses the complete precached shell. Static assets use the active revision's cache.
- `scripts/verify-update.mjs` reproduces the old worker, installs a waiting legacy release, and confirms an ordinary reload stays stale. It then deploys current `dist/` and triggers the browser's update check while keeping that tab open. **Chrome and iPhone-profile WebKit pass:** the new worker activates, obsolete caches are removed, the document is not automatically reloaded, and an ordinary reload shows the hangar and three-hit hull.
- Both update checks retain seeded settings, checkpoint, score and seven Manta parts byte-for-byte in local storage, with no runtime errors. This verifies migration after update discovery, not browser-specific update-check timing.
- The production build and **36 unit tests pass**. Both browsers also reload and launch offline with the isolated origin stopped, with **40 cached assets** and no runtime errors.
- **Live recovery verified:** source commit `184feac` deployed as Cloudflare version `50143e98-1e40-4959-abeb-31c374c1ac2e`. All 40 public production files and the root document matched `dist/`. The user's existing tab initially loaded `index-SvMxQQgg.js`; after deployment and two ordinary refreshes it loaded `index-CaoKTosf.js`. Its live hangar showed both ships, Manta locked at 0/12 parts, and hull 3. No cache, cookies or local storage were manually cleared.

## Three-hit hull and density revision

The latest revision raises regular enemy counts to 54 / 70 / 86 / 106 / 124 with 7 / 9 / 10 / 11 / 12 total waves including each final boss. Enemy HP increases to 4–10 across the campaign; every ship/loadout has exactly three hull points. Older checkpoints retain their progress with hull capped at three.

- TypeScript/Vite build and **36 unit tests pass**.
- **18 targeted Chrome/WebKit checks pass**, including new three-real-hit regressions in normal and reduced-motion modes, frozen gameplay during the explosion, zero healing after death, 0.95-second delayed Signal lost, collision/invulnerability, pause, checkpoints, tuned ships and the boss counted as the final HUD wave.
- A captured mid-explosion frame confirms visible debris and a burst over the unobstructed battlefield. Reduced-motion graphics remain static for the same interval.
- The campaign verifier now waits through the death animation and allows longer encounters. Its armored/heavy pilot cleared sectors 1–2, then lost in sector 3 under the new three-hit balance; its strict victory assertion therefore fails. The previous victory measurements below apply to the earlier balance only. Human playtesting remains the balance authority.
- **Published release verification:** source commit `3c8d642` deployed as Cloudflare version `a212189c-1ed7-47f1-88f9-d71d4af39cb1` on 11 September 2026. All 40 public files at `https://epoch.jaqstudios.com/` matched the local build. Chrome and iPhone-profile WebKit verified the three-hit hull, first sector's seven waves including boss, hangar tuning, locked Manta, disabled playtest mode, launch, pause/resume and active service worker with no HTTP or runtime errors.

## Earlier local ship and combat update

These measurements describe the earlier balance before the three-hit hull and density revision. The initial live deployment audit below is retained as historical evidence.

- **35 unit tests:** old save compatibility, ship unlock validation, per-ship tuning, eight-hull Manta checkpoints, escalating content and boss composition, collision math, and input bounds.
- **34 browser scenarios across Chrome and iPhone-profile WebKit:** baseline behavior plus hangar controls and persistence, native radio keyboard navigation, multishot stacking/expiry isolation/sector reset, weapon swaps, actual three-target lance collisions, fragment persistence, pair completion and final-fragment unlock announcement, and isolated local playtest saves. New cases live in `e2e/progression.spec.ts`.
- **Both campaign simulations reach victory:** the pilot selects Armored/Heavy Strelka through the hangar and respects its 263.5 px/s movement speed. It predicts incoming volleys; health, damage, pickups, schedules, scores, and outcomes use normal combat logic. Chrome ended with 3/7 hull, WebKit with 2/7. Sector durations were approximately 42–98 seconds depending on pickups and browser run. Every guardian reached all three phases. Observed peaks: 20 friendly shots, 38 hostile shots, and 69 effects, below the limits of 180 / 180 / 100. The earlier simpler pilot lost on the harder campaign; these results establish reachable completion for this configuration, not human difficulty balance.
- **Production and offline:** TypeScript/Vite build passes. Both browsers reload and launch with the isolated origin stopped, caching 40 assets including the new ship and all four miniboss SVGs. The production build has no development control object, ignores `?playtest=1`, and keeps Manta locked with an empty save. No runtime errors were reported.
- **Current short frame sample:** Chrome measured 16.7 ms median / 17.7 ms p95; WebKit measured 33 ms median / 35 ms p95 (approximately 30 fps in this simulation). These replace the earlier baseline timing below for the local build; physical iPhone performance remains unverified.
- **Chrome simulated touch** still passes no initial jump, relative drag, position held on lift, no scrolling, and Pause tap. Mobile visual checks at 390×844 and 320×568 confirm the notice and compact telemetry are below the player's movement range with no horizontal overflow.

See [PLAYTEST.md](PLAYTEST.md) for the local review profile. No physical iPhone test or human balance approval is implied.

## Prior deployed baseline checks

- **23 unit tests pass:** swept collision including moving targets, zero-length overlaps, relative drag and clamping, projectile direction, content schedules, save restoration, corrupt/partial/incompatible saves, unavailable storage, and checkpoint validation.
- **16 browser integration checks pass:** eight scenarios each in desktop Google Chrome and Playwright WebKit with an iPhone 13 profile. Coverage includes publisher/title/menu, archive unlocks, persistent settings, movement without initial jump, keyboard control, real auto-fire collisions, damage invulnerability, all four pickups, refresh/expiration, long-press Pause, frozen timers, pause/settings/resume, Escape, simulated background blur, boundary restoration, defeat/retry cleanup, selected transmissions, victory, viewport resize during a drag, corrupt saves, and honest storage-denial messaging.
- **Chrome touch-event simulation passes:** CDP-generated touch start/move/end confirms no initial teleport, relative movement, position held after lifting, no page scrolling, and touch activation of Pause.
- **Campaign simulation passes in Chrome and WebKit:** all five authored schedules and all three boss phases complete using real combat updates, firing, collisions, damage, pickups, and transition buttons. The automated pilot reads entity positions and moves at a capped speed. There are no health, enemy-health, score, schedule, or outcome overrides. This verifies reachable victory and absence of stranded waves; it is not an unassisted human playtest.
- **Production build passes:** TypeScript check and optimized Vite build. Development scenario controls are absent from the production window. No external fonts or gameplay assets are required.

The boundary-flow integration test uses development completion controls to isolate menu/save behavior. The separate campaign simulation exercises actual wave resolution and boss damage without these controls. Development controls are guarded by `import.meta.env.DEV` and are not attached to `window` in production.

## Campaign observations

| Sector | Simulated completion time | Encounter |
| --- | ---: | --- |
| 1 | 32.5 s | Perimeter Drift |
| 2 | 38.6 s | Dead Relay |
| 3 | 40.7 s | Arsenal Graveyard |
| 4 | 45.3 s | Static Wall |
| 5 | 50.3 s | Black Array, including boss phases 1 → 2 → 3 |

The automated pilot finished with **4/5 hull and 29,150 score**. A human’s timing and difficulty will differ. Peaks observed across the simulated campaign were **42 friendly projectiles, 32 hostile projectiles, and 59 effects**. Enforced limits are 100 friendly projectiles, 150 hostile projectiles, 100 effects, 48 enemies, and 20 pickups. Offscreen entities expire, and scene updates cap large time steps to prevent tunneling and time jumps.

Production Chrome, launched from its service-worker cache with the origin stopped, measured a **16.7 ms median frame interval and 17.6 ms p95** over a short 120-frame sample on this Mac. WebKit with the iPhone profile measured **17 ms median and 19 ms p95**. This supports the 60 fps target in the tested browser environments. It is not an iPhone performance or battery measurement, nor a worst-case stress benchmark.

## Offline and installation

The production worker precaches 35 resources: shell, bundled JavaScript/CSS, all art, manifest/icons, fonts and font licenses. Chrome successfully reloads and launches combat after the browser context is made offline. A cache match regression caused by Vite’s `Vary: Origin` header was found and fixed; same-origin static resources now match independent of that header. Cache revisions include the service-worker source and built resource contents.

WebKit also reloads and launches cached production combat with its origin server actually stopped and all server connections closed, with no runtime errors. Playwright’s WebKit `setOffline(true)` path produced an internal navigation error, so the reproducible production verifier uses a stopped isolated origin instead. This tests cache-backed launch without a reachable server; it does not simulate a physical iPhone’s radio or installed-app lifecycle.

Home Screen metadata includes standalone display, portrait orientation preference, Apple title/status-bar settings, 180/192/512 px icons, and viewport-fit=cover. The layout uses safe-area insets and visualViewport height, and pauses while a changed viewport is applied.

Offline requires an HTTPS origin or localhost. An iPhone visiting a computer’s HTTP LAN address can play the development build online; that URL does not enable secure-context service-worker installation.

## Physical iPhone status

**No physical iPhone was tested.** Playwright WebKit is a browser simulation running on macOS; it does not reproduce every Safari UI, device thermal limit, Home Screen storage policy, audio interruption, or safe-area behavior.

Before release, check on a physical phone:

1. Safari portrait and landscape with expanded/collapsed browser controls: HUD and Pause stay outside the notch and home indicator.
2. One-thumb drag, lift/re-touch, screen edges, two simultaneous fingers, and rapid finger changes: no jumps or unwanted scrolling.
3. App switching, device locking, incoming audio interruptions, and returning from Home Screen: combat pauses and audio resumes only after a gesture.
4. Settings and secured-sector Continue survive closing/reopening Safari and the installed app, using each origin’s own local storage.
5. HTTPS Home Screen installation shows the EPOCH icon/title and launches offline after a complete first online load.
6. Play all five sectors on-device and assess boss readability, sustained frame pacing, and battery/thermal behavior.

## Live Cloudflare verification

Published **11 September 2026** at **https://epoch.jaqstudios.com/**, version `9787b439-b97c-4c85-bb27-78d93fdaa665`, on the account's confirmed **Workers Free** plan.

- All **35 public production files** matched the local build byte-for-byte. HTTPS validated normally, the root and service worker returned `Cache-Control: no-cache`, manifest and icon MIME types were correct, and `/_headers` returned 404.
- **Chrome desktop and WebKit with the iPhone 13 profile** passed live menu/archive, preference restoration after reload, viewport fit, launch/HUD, pause/frozen timers/resume, settings while paused, simulated background blur, and return-to-menu checks. Development controls were absent; the service worker controlled the page with 35 cached resources. Neither browser reported runtime or HTTP errors.
- **Chrome live offline reload and combat launch passed**, with ordinary HTTP caching disabled. No live WebKit offline-emulation claim is made; the separate local production test with its origin stopped covers that engine's cache-backed launch.
- Public DNS and the authoritative nameservers resolved the new hostname, but this Mac's system resolver initially retained a negative response. The live browser checks used a temporary local CONNECT tunnel for this exact hostname to its authoritative Cloudflare address. TLS remained end-to-end with normal hostname and certificate verification. No global DNS configuration or certificate-verification setting was changed. This verifies the deployed game and HTTPS, not successful DNS resolution on every player's network.
- The **entire WebKit iPhone-profile smoke test subsequently passed with ordinary DNS and no tunnel or override**, including all interactions above, 35 cached resources, and zero runtime or HTTP errors. Chrome's ordinary navigation still returned `ERR_NAME_NOT_RESOLVED` at the final check; its full gameplay and offline results above used the temporary tunnel.
- **DNS follow-up, 19:22 UTC:** the macOS resolver's cached failure cleared. Ordinary HTTP and HTTPS requests both returned 200, and the user's Chrome tab and a fresh Codex in-app browser tab displayed the EPOCH menu at the HTTPS address without any DNS override. No network preferences, hosts entries, or certificate checks were changed.

These are macOS browser tests, **not physical iPhone Safari or Home Screen validation**.

## Reproduce

Use the commands in [README.md](../README.md). `scripts/verify-campaign.mjs` is intentionally an assisted accelerated simulation. `scripts/verify-touch.mjs` uses actual browser touch events through Chrome CDP. `scripts/verify-production.mjs` serves `dist/` on an isolated temporary origin and then shuts down that origin to verify service-worker-backed launch, with ordinary HTTP caching disabled. No test communicates with a backend or modifies the original Godot project.

Original Godot scripts, scenes, `project.godot`, textures, story data, and `CLAUDE.md` have no diffs. The previous root README is preserved in [GODOT_README.md](GODOT_README.md).
