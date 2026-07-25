# Adaptive difficulty — 0.3.3

## Goal

Power should be an estimate, not a predetermined result. After the player proves that a formation can win, the next round should present a stronger puzzle rather than another underpowered opponent.

## Rule after a victory

At battle start the game remembers the player's real team power, including card levels, Archon level, active artifact and current stars.

After a victory:

`target enemy power = previous winning player power × random value from 1.10 to 1.15`

Example: a 1000-power army wins. The next target is randomly 1100–1150.

The generator does not apply an invisible damage/HP multiplier. It searches real unit compositions and star levels and chooses the team whose calculated power is closest to the target. Therefore the enemy cards, stars, synergies and displayed power remain honest.

The selected opponent is cached for that round. Repositioning, merging, buying units or toggling an artifact must not reroll it.

## Rule after a defeat

A defeat is a retry of the same tactical puzzle:

- lose one life;
- receive the normal post-round income;
- keep the same round number;
- keep exactly the same opponent;
- the player may spend, merge and reposition before trying again.

The enemy only changes after the player defeats it (or the run ends).

## First encounter

With no previous winning army, the first challenge targets roughly 96% of the player's power at the moment the enemy is first created. It is then fixed for the round. This avoids applying the +10–15% escalation before the player has won anything.

## Battle speed labels

The pace that playtesting found readable becomes the new normal:

- `×1` = former `×0.5`;
- `×2` = former `×1`;
- `×3` = former `×2`.

The simulation itself is unchanged; only the user-facing speed scale is renamed so the comfortable pace is presented as normal speed.

## Future tuning

The 10–15% interval is deliberately a playtest value, not a permanent balance promise. Future versions can vary the interval by win streak, round or difficulty mode, and can attach named enemy archetypes (Fortress, Volley, Assassins, Arcane Circle, Swarm, Elite) without changing the core rule that the shown team is the real team.
