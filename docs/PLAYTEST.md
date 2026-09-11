# Local gameplay review

Use this profile to review gameplay locally without changing your normal progress.

Start `pnpm dev`, then open [local playtest](http://localhost:5173/?playtest=1). The session-only profile makes both ships available and adds a **Test start** sector selector in the menu and hangar. Reloading resets this profile; normal progress is untouched. Production builds ignore the playtest parameter.

1. **Hangar:** compare the narrow cyan Strelka-9 with the broad amber Manta-12. Try Agile versus Armored handling and Rapid versus Heavy reactors. Every setup has three hull points. Handling trades movement speed against the protection window after a hit. The stats update immediately. Launch uses your selected ship and tuning.
2. **Attack growth:** destroy multishot carriers and collect **↑**. Each adds one projectile to every volley. Gains survive weapon swaps and remain until the next sector.
3. **Weapons:** collect **P**, **L**, or **W** crates to replace your attack with pulse, piercing lance, or scatter. Strelka starts with pulse; Manta starts with lance. A lance can damage three different enemies once each.
4. **Readability:** pickup notices and weapon status sit in the lower corners, beneath the player's movement area. They do not intercept drags. Temporary boosts display compact countdowns.
5. **Challenge:** regular hostile counts climb 54 → 70 → 86 → 106 → 124 across 7 / 9 / 10 / 11 / 12 waves including each final boss. Amber veterans and pink elites gain tougher hulls and additional firing patterns. Try the sector selector to compare early and late encounters.
6. **Guardians:** every sector ends with a boss. Warden fans; paired Hounds; a drone carrier; paired lattice cores with lane sweeps and aimed pulses; Koschei's layered final array. Both members of a pair must be defeated. Remaining salvage is collected before results appear.
7. **Destruction:** take three hits without collecting a repair. The third hit hides the ship and triggers a visible 0.95-second explosion before Signal lost. Gameplay stays frozen during the blast. Reduced motion shows a static burst for the same duration.
8. **Normal progression:** open [normal local play](http://localhost:5173/) to test actual saves and rarity. Manta needs 12 parts; each completed boss encounter has an 18% chance of one part. Temporary boosts have one 40% opportunity per sector, weapon crates one 50% opportunity, and multishot two carrier opportunities. Parts survive defeat. Checkpoints retain the original flight's tuning even if hangar settings later change.

On a phone using the same Wi-Fi, use the Vite terminal's Network URL with `?playtest=1`. Keyboard, mouse, Chrome touch events, and iPhone-profile WebKit have automated coverage; actual phone feel and final difficulty need human playtesting.
