import { maxUnitLevel, type PatchData } from "../contracts/patch";

export interface CombatSelection {
  unitId: string;
  level: number;
  techIds: readonly string[];
  itemIds?: readonly string[];
  itemId?: string;
}

const assumptions = [
  "One stationary member attacks one full-health member already in range. Every main-weapon hit lands.",
  "The first impact occurs at zero seconds. Later hits use the nominal interval without random stagger, travel time or acquisition delay.",
  "Only selected unit techs and items are considered. Squad fire, secondary weapons, allies, officers and battlefield effects are excluded.",
] as const;

function resolve(
  patch: PatchData,
  input: CombatSelection,
  role: string,
  reasons: string[],
) {
  const unit = Object.hasOwn(patch.units, input.unitId)
    ? patch.units[input.unitId]
    : undefined;
  if (!unit?.combat)
    reasons.push(`${role}: no verified combat stats for unit ${input.unitId}.`);
  if (
    !Number.isInteger(input.level) ||
    input.level < 1 ||
    input.level > maxUnitLevel
  )
    reasons.push(
      `${role}: level must be an integer between 1 and ${maxUnitLevel}.`,
    );

  let hpRate = 0;
  let damageRate = 0;
  const items = [
    ...(input.itemIds ?? []),
    ...(input.itemId ? [input.itemId] : []),
  ];
  for (const [kind, ids, catalog] of [
    ["tech", input.techIds, unit?.techs ?? {}],
    ["item", items, patch.items],
  ] as const) {
    if (new Set(ids).size !== ids.length)
      reasons.push(`${role}: duplicate ${kind} selection.`);
    for (const id of new Set(ids)) {
      const entry = Object.hasOwn(catalog, id) ? catalog[id] : undefined;
      if (!entry?.combatModifier) {
        reasons.push(
          `${role}: unmodeled ${kind} ${entry?.name ?? id} (${id}).`,
        );
        continue;
      }
      hpRate += entry.combatModifier.hpRate ?? 0;
      damageRate += entry.combatModifier.damageRate ?? 0;
    }
  }
  return { unit, hpRate, damageRate };
}

export function calculateBreakpoint(
  patch: PatchData,
  attacker: CombatSelection,
  target: CombatSelection,
) {
  const reasons: string[] = [];
  const offense = resolve(patch, attacker, "Attacker", reasons);
  const defense = resolve(patch, target, "Target", reasons);
  const attack = offense.unit?.combat?.attack;
  const body = defense.unit?.combat;
  if (offense.unit?.combat && !attack)
    reasons.push("The main attack has no verified single-hit model.");
  if (
    offense.unit &&
    defense.unit &&
    !(defense.unit.isAir
      ? offense.unit.canTargetAir
      : offense.unit.canTargetGround)
  )
    reasons.push("The main attack cannot target this unit's domain.");
  const sources = [
    ...new Set([
      ...patch.sources,
      ...[offense.unit, defense.unit].flatMap((u) =>
        u?.combat ? [u.combat.source] : [],
      ),
    ]),
  ];
  const context = { sources, assumptions };
  if (reasons.length || !attack || !body)
    return { status: "unavailable" as const, reasons, ...context };
  const hp = Math.floor(body.hp * target.level * (1 + defense.hpRate));
  const damage = Math.floor(
    attack.damage * attacker.level * (1 + offense.damageRate),
  );
  const hits = Math.ceil(hp / damage);
  return {
    status: "available" as const,
    hits,
    oneHit: hits === 1,
    ttkSeconds: (hits - 1) * attack.intervalSeconds,
    hp,
    damage,
    intervalSeconds: attack.intervalSeconds,
    ...context,
  };
}
