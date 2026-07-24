# Hex Arena — combat model 0.3

## Core rule

Combat takes place on a 7×7 offset hex grid. One living combatant occupies exactly one hex. Allies and enemies cannot overlap.

This makes body-blocking, surrounding and range readable instead of allowing several SVG characters to collapse into one point.

## Deployment and combat

- The player's formation starts in the lower part of the arena.
- The opponent starts in the upper part.
- The middle row is neutral ground.
- During combat a unit moves only to one of the six neighbouring hexes.
- Occupied cells are obstacles for pathfinding.
- A melee unit attacks from an adjacent hex.
- Ranged distance is measured in hexes, not arbitrary pixels.

Current ranges:

| Unit | Range |
| --- | ---: |
| Guardian | 1 hex |
| Duelist | 1 hex |
| Shade | 1 hex |
| Healer | 3 hexes |
| Arcanist | 4 hexes |
| Ranger | 4 hexes |
| Pyromancer | 3 hexes |
| Bomber | 5 hexes |

## Surrounding

A central hex has six neighbours. Therefore a durable Guardian can hold one cell while as many as six melee units occupy the ring around it and attack from different directions.

A healer behind the Guardian can create a real tactical stalemate: attackers must spend time breaking the tank while the support keeps restoring health. Killing or displacing the healer can therefore be more valuable than simply adding raw damage.

## Opponent fairness

The opponent is deterministic for the current round. Moving, merging or selling your own units must not secretly reroll the opposing team.

The intent is that the player can inspect a known problem, change formation, and learn whether the tactical change worked.

## Targeting in 0.3

- Normal units prioritise the nearest reachable enemy.
- Shade still prefers fragile targets.
- Healer prioritises the ally with the lowest health percentage.
- Ranged units attack as soon as a target is inside their hex range instead of walking into melee first.
- Area attacks affect enemies on neighbouring hexes around the primary target.

## Future: facing and back attacks

The 0.3 engine already stores a combatant's facing direction as groundwork, but backstab bonuses are deliberately not enabled yet.

Planned tactical layer:

1. Every unit faces one of six hex directions.
2. An attack from the rear arc can receive a backstab modifier.
3. Assassin-type characters can receive a larger rear critical bonus.
4. Intelligence can become a behavioural stat rather than raw power.
5. A smart Guardian should try to keep its back toward an adjacent ally or arena edge when practical.
6. A smart formation could rotate to deny rear access while an assassin searches for an exposed angle.

This should be introduced only after the basic hex movement is stable, because facing makes pathfinding and target selection much more consequential.

## Readability

Version 0.3 adds:

- an always-visible `YOU power ⚔ ENEMY power` comparison;
- HP percentage labels above health bars;
- persistent hex tiles during battle;
- separate colours for enemy, neutral and player areas;
- larger health bars and clearer projectile space.

## Why 7×7

7×7 is large enough for six-unit teams to surround and flank while remaining readable on a phone. It also creates a true neutral middle row and gives long-range units useful space without turning the match into a long walk.
