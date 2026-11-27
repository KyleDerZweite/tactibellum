import type {
  ActionRef,
  BoardUnit,
  PlayerRoundState,
  RoundAction,
} from "../contracts/match";
import type { CatalogKind, createGameCatalog } from "../game-data";
import type { RawReplayAction, RawReplayRound } from "../parser";
import {
  children,
  index,
  list,
  node,
  orientation,
  position,
  string,
} from "../parser/xml-fields";

type Catalog = ReturnType<typeof createGameCatalog>;
type Resolve = (kind: CatalogKind, id: string, unitId?: string) => ActionRef;

interface RoundContext {
  catalog: Catalog;
  resolve: Resolve;
  warn: (message: string) => void;
}

const fieldRecovery = "900001";
const eliteSpecialist = "20032";
const blueprintSkills = new Map([
  ["1", "400002"],
  ["2", fieldRecovery],
  ["3", "1500001"],
]);

const reversible = new Map<string, RoundAction["kind"]>([
  ["PAD_BuyUnit", "buy"],
  ["PAD_MoveUnit", "move"],
  ["PAD_UnlockUnit", "unlock"],
  ["PAD_UpgradeUnit", "upgrade"],
  ["PAD_UpgradeTechnology", "tech"],
  ["PAD_UseEquipment", "item"],
  ["PAD_ReleaseContraption", "device"],
  ["PAD_ActiveEnergyTowerSkill", "tower"],
  ["PAD_ActiveBlueprint", "tower"],
  ["PAD_StrengthenTower", "tower"],
  ["PAD_ReleaseCommanderSkill", "spell"],
]);

function actionType({ sourceType }: RawReplayAction) {
  return sourceType.split(":").at(-1) ?? "";
}

// An unparameterized PAD_Undo rolls back the latest reversible deployment
// action. Keep both source records, but reduce only actions that survive.
function deploymentUndos(actions: RawReplayAction[]) {
  const stack: number[] = [];
  const undone = new Set<number>();
  const matched = new Set<number>();
  for (const [index, action] of actions.entries()) {
    const type = actionType(action);
    if (type === "PAD_FinishDeploy") break;
    if (type === "PAD_Undo") {
      const previous = stack.pop();
      if (previous !== undefined) {
        undone.add(previous);
        matched.add(index);
      }
    } else if (reversible.has(type)) {
      stack.push(index);
    } else if (type !== "PAD_ChooseAdvanceTeam") {
      // A command with unknown undo semantics breaks the chain of evidence.
      stack.length = 0;
    }
  }
  return { undone, matched };
}

function ids(value: Parameters<typeof list>[0]) {
  return list(value)
    .map(string)
    .filter((id) => id !== undefined);
}

export function reduceRound(
  playerId: string,
  round: RawReplayRound,
  previous: PlayerRoundState | undefined,
  next: RawReplayRound | undefined,
  { catalog, resolve, warn }: RoundContext,
): PlayerRoundState {
  const checkpoint = round.checkpoint;
  const units = new Map<string, BoardUnit>();
  const techs = new Map<string, string[]>();
  const skills = new Map<number, string>();
  const removedUnits: BoardUnit[] = [];
  const actions: RoundAction[] = [];
  const devices: ActionRef[] = [];
  const activeSpells: ActionRef[] = [];
  const towerUpgrades: ActionRef[] = [];
  const unlockedUnits = new Set(
    ids(node(node(checkpoint?.shop).unlockedUnits).int),
  );
  if (checkpoint?.shop === undefined)
    for (const id of previous?.unlockedUnits ?? []) unlockedUnits.add(id);
  for (const id of unlockedUnits) resolve("unit", id);

  const activeOfficerIds =
    checkpoint?.officers === undefined
      ? (previous?.activeOfficerIds ?? [])
      : ids(node(checkpoint.officers).int);
  const specialistId = activeOfficerIds[0];
  const recruitLevel = activeOfficerIds.includes(eliteSpecialist) ? 2 : 1;
  for (const officerId of activeOfficerIds) resolve("specialist", officerId);
  const priorUnits = new Map(
    previous?.units.map((unit) => [unit.instanceId, unit]),
  );
  let nextIndex = index(checkpoint?.unitIndex) ?? 0;
  let deploymentsUsed = 0;
  let finished = false;

  if (checkpoint?.activeTechnologies === undefined) {
    for (const unit of priorUnits.values())
      techs.set(unit.unitId, [...unit.techIds]);
  }
  for (const data of children(checkpoint?.activeTechnologies, "UnitData")) {
    const unitId = string(data.id);
    if (!unitId) continue;
    const active = ids(
      children(data.techs, "tech").map((tech) => tech["@_data"] ?? ""),
    );
    for (const id of active) resolve("tech", id, unitId);
    techs.set(unitId, active);
  }

  if (checkpoint?.units === undefined) {
    for (const unit of priorUnits.values()) {
      units.set(unit.instanceId, { ...unit, statusThisRound: "existing" });
      nextIndex = Math.max(nextIndex, Number(unit.instanceId) + 1);
    }
    if (round.roundNumber > 0)
      warn("Start-of-round unit checkpoint is missing.");
  }
  for (const data of children(checkpoint?.units, "NewUnitData")) {
    const instance = index(data.Index);
    const unitId = string(data.id);
    if (instance === undefined || !unitId || units.has(String(instance))) {
      warn(
        "A checkpoint unit has an invalid or duplicate index or no unit ID.",
      );
      continue;
    }
    const instanceId = String(instance);
    const coordinates = position(data.Position);
    const itemId = string(data.EquipmentID);
    const prior = priorUnits.get(instanceId);
    resolve("unit", unitId);
    if (itemId && itemId !== "0") resolve("item", itemId);
    units.set(instanceId, {
      instanceId,
      unitId,
      level: (index(data.Level) ?? 0) + 1,
      ...(coordinates ?? { x: 0, y: 0, positionKnown: false }),
      orientation: orientation(data.IsRotate),
      itemId: itemId && itemId !== "0" ? itemId : null,
      techIds: techs.get(unitId) ?? [],
      statusThisRound:
        previous && prior?.unitId !== unitId ? "new" : "existing",
    });
    nextIndex = Math.max(nextIndex, instance + 1);
  }

  for (const data of children(
    checkpoint?.commanderSkills,
    "CommanderSkillData",
  )) {
    const skillIndex = index(data.index);
    const id = string(data.id);
    if (skillIndex !== undefined && id) {
      skills.set(skillIndex, id);
      resolve("spell", id);
    }
  }
  function addSkill(id: string) {
    if ([...skills.values()].includes(id)) return;
    let slot = 0;
    while (skills.has(slot)) slot++;
    skills.set(slot, id);
  }

  for (const device of children(checkpoint?.contraptions, "ContraptionData")) {
    const id = string(device.id);
    if (id)
      devices.push({
        ...resolve("device", id),
        position: position(device.position),
      });
  }

  const endCheckpoint = new Map(
    (next?.roundNumber === round.roundNumber + 1
      ? children(next.checkpoint?.units, "NewUnitData")
      : []
    ).map((data) => [index(data.Index), data]),
  );
  const newPlacements = new Set<string>();
  const recoveredLevels = new Map<string, number>();
  // New buys in the legacy format have no coordinates. Only an adjacent
  // checkpoint with the same unit ID and index can fill in an unlogged placement.
  function fillPlacement(unit: BoardUnit) {
    const checkpointUnit = endCheckpoint.get(Number(unit.instanceId));
    if (string(checkpointUnit?.id) !== unit.unitId) return;
    const coordinates = position(checkpointUnit?.Position);
    if (coordinates) {
      Object.assign(unit, coordinates, {
        orientation: orientation(checkpointUnit?.IsRotate),
      });
      delete unit.positionKnown;
    }
  }

  // Some specialist/card effects spawn a squad without a buy action.
  // Require both a same-round reference and the next checkpoint identity.
  function recoverSpawn(instance: number, expectedUnit?: string) {
    if (instance < nextIndex) return;
    const recorded = endCheckpoint.get(instance);
    const unitId = string(recorded?.id);
    if (!unitId || (expectedUnit && unitId !== expectedUnit)) return;
    const instanceId = String(instance);
    const unit: BoardUnit = {
      instanceId,
      unitId,
      level: 1,
      techIds: techs.get(unitId) ?? [],
      x: 0,
      y: 0,
      positionKnown: false,
      statusThisRound: "new",
    };
    units.set(instanceId, unit);
    newPlacements.add(instanceId);
    const recordedLevel = index(recorded?.Level);
    if (recordedLevel !== undefined)
      recoveredLevels.set(instanceId, recordedLevel + 1);
    nextIndex = instance + 1;
    resolve("unit", unitId);
    warn(
      `Unit #${instanceId} appeared without a deployment action and was identified from the next checkpoint.`,
    );
    return unit;
  }

  const releases: { action: RoundAction; skillIndex?: number }[] = [];
  const { undone, matched } = deploymentUndos(round.actions);
  for (const [actionIndex, source] of round.actions.entries()) {
    const { sourceType, fields } = source;
    const type = actionType(source);
    const uid = string(fields.UID);
    const instance = index(fields.UIDX ?? fields.UnitIndex);
    const instanceId = instance === undefined ? undefined : String(instance);
    const target = instanceId === undefined ? undefined : units.get(instanceId);
    const log = (
      kind: RoundAction["kind"],
      details?: Omit<RoundAction, "kind" | "sourceType">,
    ) => {
      const action = { kind, sourceType, ...details };
      actions.push(action);
      return action;
    };
    const unitDetails = target
      ? { instanceId, unitId: target.unitId }
      : { instanceId, unitId: uid };
    const cost = (amount: number | null | undefined) => amount ?? undefined;

    if (finished && type !== "PAD_FinishDeploy") {
      log("unknown");
      warn(`Action after finish: ${sourceType}.`);
      continue;
    }
    if (undone.has(actionIndex)) {
      log(reversible.get(type) ?? "unknown", { ...unitDetails, undone: true });
      continue;
    }
    switch (type) {
      case "PAD_Undo":
        log("undo");
        if (!matched.has(actionIndex))
          warn("Undo has no supported preceding deployment action.");
        break;
      case "PAD_ChooseAdvanceTeam":
        log(
          "specialist",
          specialistId
            ? { ref: resolve("specialist", specialistId) }
            : undefined,
        );
        break;
      case "PAD_BuyUnit": {
        if (!uid) {
          log("buy");
          warn("Buy is missing a unit ID.");
          break;
        }
        const unit = catalog.unit(uid);
        const id = String(instance ?? nextIndex);
        const coordinates = position(fields.position ?? fields.Position);
        log("buy", {
          unitId: uid,
          instanceId: id,
          ref: resolve("unit", uid),
          position: coordinates,
          cost: cost(unit.cost),
        });
        if (units.has(id)) {
          warn(`Buy references occupied unit index ${id}.`);
          break;
        }
        nextIndex = Math.max(nextIndex, Number(id) + 1);
        const bought: BoardUnit = {
          instanceId: id,
          unitId: uid,
          level: recruitLevel,
          techIds: techs.get(uid) ?? [],
          ...(coordinates ?? { x: 0, y: 0, positionKnown: false }),
          orientation: orientation(fields.IsRotate),
          statusThisRound: "new",
        };
        units.set(id, bought);
        newPlacements.add(id);
        deploymentsUsed++;
        break;
      }
      case "PAD_MoveUnit": {
        const moves = children(fields.moveUnitDatas, "MoveUnitData");
        if (!moves.length) {
          log("move");
          warn("Move contains no unit entries.");
        }
        for (const move of moves) {
          const moveIndex = index(move.unitIndex);
          const id = moveIndex === undefined ? undefined : String(moveIndex);
          const unitId = string(move.unitID);
          const coordinates = position(move.position);
          const unit =
            id === undefined
              ? undefined
              : (units.get(id) ??
                (unitId && unitId !== "0" && coordinates
                  ? recoverSpawn(Number(id), unitId)
                  : undefined));
          if (unitId) resolve("unit", unitId);
          log("move", { instanceId: id, unitId, position: coordinates });
          if (
            !unit ||
            !coordinates ||
            (unitId && unitId !== "0" && unitId !== unit.unitId)
          ) {
            warn(
              `Move cannot resolve unit index ${id ?? "?"} or its coordinates.`,
            );
            continue;
          }
          Object.assign(unit, coordinates, {
            orientation: orientation(move.isRotate) ?? unit.orientation,
          });
          delete unit.positionKnown;
          if (unit.statusThisRound === "existing")
            unit.statusThisRound = "moved";
        }
        break;
      }
      case "PAD_UnlockUnit": {
        if (!uid) {
          log("unlock");
          warn("Unlock is missing a unit ID.");
          break;
        }
        const unit = catalog.unit(uid);
        log("unlock", {
          unitId: uid,
          ref: resolve("unit", uid),
          cost: unit.isUnknown ? undefined : cost(unit.unlockCost),
        });
        unlockedUnits.add(uid);
        break;
      }
      case "PAD_UpgradeUnit": {
        const unit = target && catalog.unit(target.unitId);
        log("upgrade", {
          ...unitDetails,
          cost: unit?.cost == null ? undefined : unit.cost / 2,
        });
        if (!target) {
          warn(`Upgrade cannot resolve unit index ${instanceId ?? "?"}.`);
          break;
        }
        target.level++;
        if (target.statusThisRound !== "new")
          target.statusThisRound = "upgraded";
        break;
      }
      case "PAD_UpgradeTechnology": {
        const id = string(fields.TechID);
        if (!uid || !id) {
          log("tech");
          warn("Technology is missing a unit or tech ID.");
          break;
        }
        resolve("unit", uid);
        log("tech", {
          unitId: uid,
          ref: resolve("tech", id, uid),
          cost: cost(catalog.tech(uid, id).cost),
        });
        const current = [...new Set([...(techs.get(uid) ?? []), id])];
        techs.set(uid, current);
        for (const unit of units.values()) {
          if (unit.unitId !== uid) continue;
          unit.techIds = current;
          if (unit.statusThisRound !== "new") unit.statusThisRound = "teched";
        }
        break;
      }
      case "PAD_UseEquipment": {
        const id = string(fields.EquipmentID);
        const recipient =
          target ??
          (instance === undefined ? undefined : recoverSpawn(instance));
        log("item", {
          ...unitDetails,
          unitId: recipient?.unitId ?? uid,
          ref: id ? resolve("item", id) : undefined,
        });
        if (!recipient || !id)
          warn(
            `Equipment cannot resolve its ID or unit index ${instanceId ?? "?"}.`,
          );
        else recipient.itemId = id === "0" ? null : id;
        break;
      }
      case "PAD_ReleaseContraption": {
        const id = string(fields.ContraptionID);
        if (!id) {
          log("device");
          warn("Device is missing an ID.");
          break;
        }
        const placement = position(fields.Position);
        const ref = { ...resolve("device", id), position: placement };
        devices.push(ref);
        log("device", {
          ref,
          position: placement,
          cost: cost(catalog.lookup("device", id).cost),
        });
        break;
      }
      case "PAD_StrengthenTower": {
        const towerIndex = index(fields.Index);
        if (towerIndex === undefined) {
          log("tower");
          warn("Tower strengthening is missing an index.");
          break;
        }
        const ref = {
          id: `strengthen:${towerIndex}`,
          name: `Strengthen tower ${towerIndex + 1}`,
        };
        towerUpgrades.push(ref);
        log("tower", { ref });
        break;
      }
      case "PAD_ActiveEnergyTowerSkill":
      case "PAD_ActiveBlueprint": {
        const kind = type === "PAD_ActiveBlueprint" ? "blueprint" : "tower";
        const id = string(kind === "blueprint" ? fields.ID : fields.SkillID);
        if (!id) {
          log("tower");
          warn("Tower action is missing a skill ID.");
          break;
        }
        const ref = resolve(kind, id);
        towerUpgrades.push(ref);
        log("tower", { ref, cost: cost(catalog.lookup(kind, id).cost) });
        if (kind === "blueprint") {
          const skill = blueprintSkills.get(id);
          if (skill) addSkill(skill);
        }
        break;
      }
      case "PAD_ChooseReinforceItem": {
        const id = string(fields.ID);
        if (!id) {
          log("reinforcement");
          warn("Reinforcement is missing an ID.");
          break;
        }
        const formattedDrop = id.match(/^1(\d{2})([1-9])([1-9])(\d+)$/);
        if (formattedDrop && Number(formattedDrop[1]) === round.roundNumber) {
          const [, , count, level, unitId] = formattedDrop;
          const ref = resolve("unit", unitId);
          log("reinforcement", { unitId, ref });
          for (let i = 0; i < Number(count); i++) {
            const instanceId = String(nextIndex++);
            units.set(instanceId, {
              instanceId,
              unitId,
              level: Number(level),
              techIds: techs.get(unitId) ?? [],
              x: 0,
              y: 0,
              positionKnown: false,
              statusThisRound: "new",
            });
            newPlacements.add(instanceId);
          }
        } else {
          const ref = resolve("reinforcement", id);
          log("reinforcement", { ref });
          const nextSkill = children(
            next?.checkpoint?.commanderSkills,
            "CommanderSkillData",
          ).find((skill) => string(skill.id) === id);
          const nextSlot = index(nextSkill?.index);
          if (nextSlot !== undefined && !skills.has(nextSlot)) {
            skills.set(nextSlot, id);
          } else if (!catalog.lookup("spell", id).isUnknown) {
            addSkill(id);
          } else if (ref.isUnknown) {
            warn(`Unsupported reinforcement #${id}.`);
          }
        }
        break;
      }
      case "PAD_ReleaseCommanderSkill": {
        const skillIndex = index(fields.SkillIndex);
        const direct = string(fields.ID);
        const id =
          direct && direct !== "0"
            ? direct
            : skillIndex === undefined
              ? undefined
              : skills.get(skillIndex);
        if (!id) {
          log("spell");
          warn(
            `Commander skill index ${skillIndex ?? "?"} could not be resolved.`,
          );
          break;
        }
        const ref = resolve("spell", id);
        if (id === fieldRecovery) {
          log("sell", { ...unitDetails, ref });
          if (!target)
            warn(
              index(fields.ConstructionIndex) !== undefined
                ? "Field Recovery targeted a construction, which is not represented on the board."
                : `Field Recovery cannot resolve unit index ${instanceId ?? "?"}.`,
            );
          else {
            units.delete(target.instanceId);
            removedUnits.push(target);
          }
        } else {
          const placement = position(
            children(fields.Positions, "MapVector")[0],
          );
          const placed = { ...ref, position: placement };
          const action = log("spell", {
            ...unitDetails,
            ref: placed,
            position: placement,
            cost: cost(catalog.lookup("spell", id).cost),
          });
          releases.push({ action, skillIndex });
        }
        break;
      }
      case "PAD_CancelReleaseCommanderSkill": {
        const skillIndex = index(fields.SkillIndex);
        const direct = string(fields.ID);
        const match = releases
          .slice()
          .reverse()
          .find(
            ({ action, skillIndex: slot }) =>
              !action.undone &&
              (direct && direct !== "0"
                ? action.ref?.id === direct
                : skillIndex !== undefined && skillIndex === slot),
          );
        log("undo", { ref: match?.action.ref });
        if (match) match.action.undone = true;
        else warn("Skill cancellation has no matching spell release.");
        break;
      }
      case "PAD_FinishDeploy":
        log("finish");
        finished = true;
        break;
      default:
        log("unknown");
        warn(`Unsupported action: ${sourceType}.`);
    }
  }

  for (const { action } of releases)
    if (!action.undone && action.ref) activeSpells.push(action.ref);
  for (const id of newPlacements) {
    const unit = units.get(id);
    if (unit?.positionKnown === false) fillPlacement(unit);
  }
  for (const [id, level] of recoveredLevels) {
    const unit = units.get(id);
    if (unit) unit.level = level;
  }
  const board = [...units.values()];
  const unknownPositions = board.filter(
    (unit) => unit.positionKnown === false,
  ).length;
  if (unknownPositions)
    warn(`Ending position unavailable for ${unknownPositions} unit(s).`);
  if (round.roundNumber > 0 && round.actions.length && !finished)
    warn("No finish-deploy action is recorded.");
  const armyValue = board.reduce((total, unit) => {
    const base = catalog.unit(unit.unitId).cost ?? 0;
    return total + base + ((unit.level - 1) * base) / 2;
  }, 0);

  const checkpointSupply = index(checkpoint?.supply);
  return {
    playerId,
    specialistId,
    activeOfficerIds,
    checkpointSupply,
    supplyAvailable:
      string(checkpoint?.IsSpecialSupply) === "true"
        ? checkpointSupply
        : undefined,
    supplySpentThisRound: actions.reduce(
      (total, action) => total + (action.undone ? 0 : (action.cost ?? 0)),
      0,
    ),
    estimatedArmyValue: armyValue,
    deploymentsUsed,
    unlockedUnits: [...unlockedUnits],
    activeSpells,
    towerUpgrades,
    devices,
    units: board,
    actions,
    removedUnits,
  };
}
