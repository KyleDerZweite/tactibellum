export const analysisFormulas = {
  armyValue:
    "Sum of catalog base purchase cost × (1 + 0.5 × (level − 1)) for units on the board. Unknown unit costs contribute zero.",
  armyValueDelta:
    "Current estimated army value minus the previous adjacent round's value.",
  supplySpent: "Sum of recorded, priced actions after undo.",
  supplyEfficiency:
    "Adjacent army value change divided by positive recorded supply spend, when action costs are available.",
  carryoverAfterRound:
    "Supply in the next adjacent ordinary checkpoint, which excludes new income.",
  deploymentUtilization:
    "Deployments used divided by recorded slot capacity, or a two-slot estimate when capacity is unavailable.",
  techValue:
    "Sum of known catalog tech costs, once per unit type and tech ID observed through this round.",
  techShare:
    "Known tech value divided by estimated army value plus known tech value.",
  composition:
    "Role value divided by known board value. Each unit contributes catalog cost × (1 + 0.5 × (level − 1)) to each effective role, including tech-added roles.",
  spatial:
    "Known positioned board value by world half (x < 0 is left), with units in open flank zones counted separately.",
  chaffDepth:
    "Largest chaff y minus smallest chaff y in replay metres. A single placed chaff unit has depth zero.",
  towerDefense:
    "Friendly positioned value within 100 m of each tower, and enemy flank value on that tower's world half.",
} as const;
