# EPOCH browser game

- Use **level** for a complete mission and **wave** for an encounter within a level. Use these terms in configuration, new code, menus, HUD, documentation and discussion. A guardian encounter counts as the final wave. Do not call levels sectors; `furthestSector` is supported only as an old save migration field.
- `src/data/config.ts` records the terminology, 50 authored story levels, endless continuation, 8–10 total waves per level, and 0–2 randomly selected asteroid waves per level.
- The active browser game is TypeScript/Phaser in `src/`. The Godot files are a historical prototype; do not apply their old five-level or 100-level assumptions to browser changes.
- Preserve existing player progress when extending the campaign. The end of the authored story must keep a checkpoint for endless levels.
- Follow the parent staging policy and `docs/DEPLOYMENT.md`: ordinary update/testing requests deploy to private staging; promotion of a specific staged release requires explicit user authorization.
