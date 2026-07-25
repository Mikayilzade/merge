# Merge Arcana architecture from 0.4

The 0.3 playtest intentionally favored speed of iteration. That produced a useful chain of experimental facades (`engine-v03`, `engine-v031`, `engine-v033`, `engine-v036`) but made later changes harder to reason about and test.

0.4 introduces a stable public facade at `js/engine.js` and splits the implementation by responsibility:

- `js/engine/random.js` — deterministic RNG helpers.
- `js/engine/stats.js` — card/wizard/star/synergy multipliers, unit stats and team power.
- `js/engine/economy.js` — shops, merge rules, income, team cap and wizard XP.
- `js/engine/hex-grid.js` — hex coordinates, distance, neighbors, paths and facing directions.
- `js/engine/targeting.js` — target choice and movement destination selection.
- `js/engine/combat-core.js` — combat simulation and per-unit battle metrics only.
- `js/engine/formation.js` — 21-cell player deployment, enemy spawn cells and readable-speed adapter.
- `js/engine/difficulty.js` — adaptive 110–115% enemy generation and challenge persistence.
- `js/engine/watchdog.js` — stalled/long-battle safety ending.
- `js/engine/report.js` — normalized battle report storage for UI and future analytics.
- `js/ui/battle-report.js` — result-screen presentation; it does not decide combat outcomes.

`js/engine.js` is the compatibility boundary. Existing screens continue importing the same public names from `./engine.js`, while implementation modules can now be tested or replaced independently.

## Rules for future work

1. Do not add another `engine-v0xx.js` layer for a new mechanic.
2. A gameplay rule belongs in the smallest responsible module.
3. UI code must not decide damage, targeting or victory.
4. Combat code must not know DOM structure.
5. Save-format migrations stay separate from combat rules.
6. Every new tactical mechanic should have a focused unit test before being wired into the full battle.
7. Experimental modules may exist on feature branches, but merged `main` should expose one canonical implementation.

## 0.4 tactical direction

Facing is represented as one of six hex directions. This enables mechanics that were impossible to express reliably in 0.3:

- a melee attacker can be detected as standing directly behind a target;
- the Shade can receive a guaranteed critical hit from the rear;
- later, Intelligence can influence facing choices (for example a Guardian trying to keep its back toward an ally or arena edge);
- battle reports can show backstabs, damage, healing and remaining HP independently of the renderer.

Legacy 0.3 files remain temporarily in the repository as a rollback reference during the 0.4 playtest. Once 0.4 passes mobile smoke tests, they can be removed in a dedicated cleanup commit.
