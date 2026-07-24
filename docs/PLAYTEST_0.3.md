# Playtest 0.3 — Hex Arena

The goal of this playtest is not balance perfection. It is to verify that the new spatial combat feels readable and fair.

## First five minutes

1. Start a fresh run.
2. Move the same formation between front, middle and back planning rows.
3. Confirm that the opponent preview does not change when only your formation changes.
4. Start combat and check that the first battle frame matches the formation you prepared.
5. Confirm that no two living fighters visually occupy the same hex.

## Ranged combat

- Put a Ranger or Bomber far back.
- Watch whether it attacks once an enemy is within the displayed hex range.
- A ranged unit should not walk into melee if it already has a legal target.
- Two ranged-only teams must be able to begin exchanging projectiles without waiting for a melee unit to finish another fight.

## Tank + healer

Try to create a Guardian + Healer formation.

Expected behaviour:

- Guardian holds one cell.
- Enemies take separate neighbouring cells around it.
- Healer remains in its own cell and can sustain the Guardian from range.
- Attackers should gradually spread around the tank when the direct approach is occupied.

This is the first scenario to judge whether hexes actually add tactics instead of only changing the graphics.

## Readability

During battle check:

- `ТЫ power ⚔ ВРАГ power` is visible;
- enemy health is readable as a percentage;
- projectiles are visible above the grid;
- health bars are not hidden behind the lower arena edge;
- characters do not visually sink into the board;
- the 7×7 grid remains understandable on iPhone.

## Report useful feedback

The most useful comments are simple observations such as:

- “Ranger walked forward although it could already shoot.”
- “Two fighters tried to use the same cell.”
- “Guardian was surrounded and it looked good/bad.”
- “I could not understand which hex the unit occupied.”
- “The battle became too slow when paths were blocked.”
- “This formation should have worked but the AI did something stupid.”

Screenshots right before and during the strange behaviour are ideal.

## Deliberately postponed

Not enabled in 0.3 yet:

- backstab damage;
- six-direction facing visuals;
- Intelligence AI stat;
- Guardian deliberately protecting its back with an ally;
- terrain obstacles and special hexes;
- online PvP.

The engine stores facing direction as groundwork, but these systems should wait until basic movement is trustworthy.
