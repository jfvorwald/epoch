# Browser validation — 14 September 2026

EPOCH browser publisher: **Jaq Studios**. Godot source was reviewed before implementation, not executed. The supplied reference image informed portrait composition; the new SVG artwork is original.

## Production promotion and Training Wheels — 14 September

Release `77f326db3cf3372c`, build `94e88c74bcb0`, was promoted from the frozen staging artifact after owner authorization. All 41 public production files match that artifact. Production and its public provider fallback reject every beta API with 404; staging remains protected by Access, and production has no beta database, email or scheduled sender.

The gameplay source inherits the 167 unit, 30 release and 58 focused Chrome/iPhone-profile WebKit scenarios recorded for the Training Wheels update, including four-to-five-hit first-wave enemies, default-off tracing, immediate paused toggling and save migration. Subsequent releases changed only the private tester roster. The exact final artifact passes offline launch in both engines, with 41 cached assets, no runtime errors and no private API caching.

Normal Chrome needed one ordinary reload to replace the former cached menu. Read-only live inspection then verified the updated menu, 50-level Signal Map with endless continuation, and Training Wheels off in Settings. No flight was launched and no preference or stored progress was changed. This is browser coverage, not a physical iPhone or human difficulty assessment. Evidence is in `.releases/77f326db3cf3372c/validation/`.

## Persistent projectiles, guardians and Supercharge — 14 September

Release `9cb6c3962fa4e4ef`, build `1de2df997296`, is deployed to private staging.

- 149 unit tests and 30 release tests pass. All 90 browser scenarios pass in Chrome and iPhone-profile WebKit: 88 in the full suite plus two new destruction tests. They verify actual post-kill projectile damage, surviving mine fragments, delayed final completion, distinct player shot textures, frozen guardian targeting, Supercharge expiry/refresh/pause and earned-power preservation. The initial concurrent run failed because temporary servers and output directories were shared; the final run used a persistent server and isolated outputs.
- Production-mode artifact checks pass in both engines: correct staging label, absent development controls, offline launch with the origin stopped, network-only private feedback API, legacy service-worker recovery and byte-preserved local saves.
- Assisted progression clears levels 1–5, 25, 50, 51 and 100 with normal autofire, actual damage and pickups, 5–7 earned arrays and bounded entity counts. The pilot has invulnerability and instant arena-bounded aim; this verifies reachability rather than human balance.
- Twelve guardian scenarios and 27 screenshots cover all five archetypes in phases one and three plus Reduced Motion. Projectile artwork review confirms eleven reusable textures and six distinct player airframe/weapon silhouettes. Phone and desktop Supercharge readouts keep earned power and temporary maximum power separate.
- Deployment receipt and signed-out checks confirm the private staging release. Root/build/service-worker/art/session requests redirect to Access, fallback returns 404 and production remains unchanged. Live authenticated in-app gameplay is unverified because that browser still fails staging navigation; its generated error page was blocked by Browser Use. No protection was bypassed or modified.

Evidence is retained in `.releases/9cb6c3962fa4e4ef/validation/`.

## Compact menu and per-level artwork — 13 September

Staged release `67091a6031b019fe`, build `41b36d846387`.

- 76 unit tests and 11 release tests pass. All 64 Chrome/iPhone-profile WebKit scenarios pass: 62 in the full run, plus both bulk visual cases after correcting an invalid test fixture that allocated two pickup carriers among only one enemy. The fixture now uses three enemies; ordinary campaign waves were valid throughout. The corrected stress checks finished in 10.7s Chrome and 10.1s WebKit.
- Runtime rendering checks cover all 50 authored levels plus 51 and 100: 52 distinct background pixel hashes, correct themed enemy and guardian texture assignments, and a constant total texture count. Reduced Motion freezes the themed star drift. Existing collision, weapon, wave, save, map, ending and endless-continuation checks pass.
- A separate fleet audit verifies all 50 authored appearances independently for straight units, weavers, shooters, asteroids and guardians. Alpha-only checks find ten distinct base hull families and 50 configured silhouettes. Generation makes zero gameplay RNG calls, peaks at nine extra textures and leaves zero retained textures after 50 create/dispose cycles. The audit is retained under this staged release’s `validation/` directory.
- Visual inspection covered the simplified menu at desktop, short desktop, 320px phone, iPhone-profile WebKit and landscape dimensions. Ship editing and parts remain visible; all controls are accessible without horizontal overflow. Contact sheets cover all 50 fleets and representative scenery across all ten environments. Paused formation screenshots verify the opening five levels in the full game HUD.
- Isolated Chrome timing over 12 representative levels and three passes measured visual transitions at 203.8ms median / 292.2ms maximum, including background generation at 166.8ms median. This is a desktop measurement, not physical-phone performance certification. Scenery draws once per level, while ordinary gameplay moves only the existing stars.
- TypeScript/Vite build, shared-artifact staging/production-hostname checks, offline launches and legacy service-worker update checks pass in both browsers. Offline caching contains 41 assets; saved local storage survives the update byte-for-byte. These local artifact checks do not deploy production.
- Live staging hosting remains Access-protected and its provider fallback is disabled; production’s homepage hash is unchanged. The private launcher successfully authenticated, but fresh EPOCH tabs in the in-app browser failed navigation. Live authenticated gameplay on this release could not be rechecked; the user’s existing paused tab remains untouched. Manual staging review is still needed before production promotion.

## Fifty-level story, angled asteroids and endless continuation — 12 September

Staged release `5325d53cd2861925`, build `414f13ab46cd`.

- 71 unit tests and 11 release tests passed. All 60 browser scenarios passed across Chrome and iPhone-profile WebKit: 58 in the main run and the two asteroid collision probes after isolating their intended target from other crossing rocks. Coverage includes the 50-node map, hidden future details, random 0/1/2 asteroid plans held through pause, angled crossings, all-enemy kill gates, the level-50 ending, levels 51–52, high-score checkpoint reload and the earlier ship/weapon features.
- `scripts/verify-endless.mjs` cleared levels 1–50, 51 and 100 through real autofire, projectile damage, normal pickups and completion controls. Every level reached weapon power 12 and saved the next checkpoint; asteroid counts covered zero, one and two, with surviving rocks making return passes. Observed level durations ranged from 43.1 to 272.3 simulated seconds; peak hostile/friendly shots were 78/57, within budgets. This audit uses invulnerability and instantaneous arena-bounded aim; it does not establish human difficulty. The JSON report is retained beside this staged release under `validation/endless-audit-chrome.json`.
- The story contains 51 entries (opening orders plus 50 field transmissions), 5,677 words, ten chapters and 50 unique destinations. Each transmission has 100–118 words. Legacy archive IDs remain valid, old completed campaigns gain a level-6 checkpoint, and already completed levels unlock their newly added messages.
- TypeScript/Vite build and shared-artifact staging/production-hostname checks passed. Both browsers passed offline launch with the isolated origin stopped (41 cached assets), and legacy service-worker migration with the exact saved local-storage record retained. No runtime errors were observed. These artifact checks do not deploy production.
- Desktop Chrome, 320px Chrome and iPhone-profile WebKit visual checks covered menu, map, mission briefing, archive orders and endless continuation. No horizontal overflow or page errors; the compact 320px map exposes all five opening nodes in its first viewport.
- Live signed-in staging showed the exact build, full map, mission rules, level 01 / wave 01 of 08, two naturally collected power upgrades yielding three shots, and pause. Signed-out representative paths require Access; fallback is disabled. The production homepage hash remains unchanged. Physical-device feel and unassisted difficulty remain staging playtest checks.

## Ship editor, weapon progression and persistent waves — 12 September

Staged release `cc35b1f097f47953`, build `afe3b2e102d7`.

- 58 unit tests and 11 release tests passed. 52 Chrome and iPhone-profile WebKit scenarios passed, including seven new scenarios per browser for 12-power/eight-shot caps, real projectile weaknesses after swaps, persistent parts UI, last-kill wave gating, destructible non-shooting debris, damage-preserving enemy returns, and contact that cannot count as a kill. Initial desktop failures during source integration passed on a stable-source rerun.
- TypeScript/Vite build passed. The shared artifact passed staging/production-hostname badge and disabled-debug checks, plus launch/pause/resume. Offline launch passed in both browsers with the local origin stopped and 41 cached assets. These are local production-mode artifact tests, not a production deployment.
- Responsive screenshots inspected at 1440×1000, 390×844 and 320×568: Edit Ship, parts meter, hangar controls, weapon power at 0/12 and 12/12, eight shots, 2.25× blast and pause inventory fit without page overflow.
- An accelerated Chrome campaign used ordinary Strelka auto-fire, actual collision damage, pickup collection, scheduling and outcomes. All sectors completed: waves 8/10/10/10/10, kills 67/84/90/99/103, array pickups 14/18/18/18/18, and zero surviving enemies or runtime errors. All reached power 12 before their guardians. Simulation took about 37/49/58/59/59 game seconds and included enemy return loops in sectors 4–5. Invulnerability and instantaneous programmatic aiming were enabled; this confirms progression and reachability, not human play difficulty.
- Live private staging confirmed the current build, editable handling, parts 0/12, wave 1/8 and two naturally collected upgrades increasing shots from one to three. Cloudflare Access still protects representative paths, fallback is disabled, and production's homepage hash is unchanged.

The historical results below describe earlier releases. Physical-device feel and balance remain human playtest checks.

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
