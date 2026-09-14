# Gameplay review

Private review: [EPOCH staging](https://epoch-staging.jaqstudios.com/). Check the visible build against the release in [DEPLOYMENT.md](DEPLOYMENT.md). Staging saves are separate from production.

## Levels and waves

A level is one mission. It contains 8–10 waves, including a final guardian. Use these terms consistently; `src/data/config.ts` records the rules.

1. Open **Signal Map** from the main menu. The initial five levels form the first chapter, with a larger tree of ten chapters and 50 nodes behind them. Open level 1 for its briefing. Future chapter story stays encrypted until reached.
2. Play several levels or retry a level. Each launch rolls 0, 1 or 2 asteroid waves. There should be no guarantee of an asteroid wave, and never more than two. The total stays within 8–10 waves.
3. Watch asteroids enter from the top and both sides, including diagonals and upward passes. Dodge or shoot through them; surviving asteroids return on another angle. All hostiles must be killed to advance. Route guides are hidden by default; enable **Training Wheels** in Settings to compare each predicted entry or return path with the actual movement.
4. Read the transmission after each authored level. Level 5 opens chapter two; it is no longer the ending. Recovered messages remain in the archive alongside the original flight orders.
5. Complete level 50 and answer its final transmission. **Continue Beyond the Signal** begins level 51, and later checkpoints must survive reload. Higher levels increase fleet durability while keeping movement readable.
6. Verify Edit Ship, the persistent parts counter, weapon power 0–12, eight-shot cap, stronger final five upgrades, pause, return patterns and three-hit destruction.

## Opening wave and optional guides

- Use Strelka with a balanced reactor, its native pulse weapon, no upgrades and no temporary buffs. First-wave enemies should take **4–5 direct hits each**, across authored and endless levels. This includes the enemy's pulse weakness; reactor tuning and other weapon types still change the hit count. Later-wave health, guardian health, upgrade strength and drop timing retain their existing tuning.
- On both a fresh profile and an older save, **Training Wheels** should start off. Enemy return traces, asteroid routes, predicted shot paths, impact zones and marked safe lanes should be absent. Actual ships, asteroids, shots, mines and black-hole portals must remain visible and active.
- Pause, open Settings and enable Training Wheels. The description should read **Show enemy routes, shot paths & safe lanes**. Return to the paused flight, resume, and confirm the guides follow committed attacks and return paths. Disable it again during pause: guides should disappear immediately without resetting the fight or changing its timing, damage or movement.
- Reload to check the selected setting persists alongside ship parts, tuning, scores and the saved level checkpoint. With Training Wheels on, check that Reduced Motion still removes guide pulsing. During local `?playtest=1` review, all preferences remain session-only.

## Local previews

Start `pnpm dev`, then open [local playtest](http://localhost:5173/?playtest=1). This session-only profile unlocks both ships and offers a starting-level selector through all 50 story levels plus levels 51 and 100. It never reads or overwrites your normal save; production-mode staging ignores it.

Use [normal local play](http://localhost:5173/) to check real saves, Manta's 12-part unlock and old-save migration. A legacy completed-five-level save should offer level 6. Earlier recovered messages and all ship parts remain available. Each guardian encounter has an 18% chance of one part; permanent arrays begin in wave three, with one per remaining non-guardian wave (5–7 total), including asteroid replacements.

`node scripts/verify-endless.mjs` audits campaign progression using accelerated simulation and assistance described in the script. Chrome/WebKit coverage is browser simulation; physical-phone feel, readability during busy fights, and late-level difficulty still need human playtesting.

## Menu and level identity review

- The main menu should leave the ship unobstructed, with one filled Launch button, an obvious Edit Ship row, a compact parts count and accessible Continue/Map/Archive/Settings controls. Check both a fresh save and a saved flight on desktop and phone.
- Compare levels 1–5: blue orbital limb, amber relay structures, green wreck field, violet nebula and crimson defense array. Their fleets should differ in silhouette as well as color.
- Sample levels 8, 21, 24, 30 and 34 for gardens, ocean, ice, rift and beacons. Check that environmental scenery cannot be mistaken for a hazard and that projectiles remain visible against landmarks. Only gameplay asteroids participate in collisions and receive entry guides when Training Wheels is enabled.
- Later fleets should retain readable roles: weavers have stabilizer fins, shooters twin barrels, guardians larger reactors and role-specific structures. Hitboxes, weaknesses, patterns and wave rules are unchanged by artwork.
- The local visual review scripts produce environment and fleet contact sheets under `test-results/`; they do not alter saved progress. Reduced Motion stops star drift.

## Persistent shots, guardian mechanics and Supercharge

- Kill a firing enemy and keep dodging: its shot should continue moving and can still damage you after the wave clears. The same applies to a defeated guardian and its mines. Completion waits for remaining hostile shots and salvage.
- Compare Strelka and Manta with pulse, lance and scatter: all six combinations have distinct shot silhouettes. Enemy roles and guardians also have identifiable projectile shapes.
- Review the five guardians: move with the Warden's open gate, avoid the Twins' curved scissor volleys, evade Carrier mines and their fragments, find the gaps in the Lattice volleys, and watch Koschei's two black holes release inward-curving pincers. Attack paths lock before firing; they should not keep chasing the ship. Training Wheels reveals their predicted routes, impact zones and safe corridors when enabled; portals and live hazards stay visible with it off.
- Collect the gold-star Supercharge: eight shots and maximum blast power for six seconds, with earned arrays shown separately. Collect an array during the boost, pause, then resume. On expiry, return to the updated earned power. A second Supercharge refreshes six seconds without adding time.
- Early waves should no longer shower arrays: the first two have none, then one per wave. A launch can select one rare Supercharge in a middle/late combat wave; it never replaces health, a weapon crate, or a permanent array.

Run `node scripts/verify-guardians.mjs` against local development for warning/live-hazard screenshots. The script explicitly enables **Training Wheels**, labels the contact sheets, and records the setting in its report. It also holds player fire and grants invulnerability for inspection, so these captures do not represent the default guide-free view or establish physical-phone difficulty.
