import { patchDataSchema } from "../contracts/patch";
import type { PatchData, PatchTech, PatchUnit } from "../contracts/patch";

export type CatalogKind =
  | "unit"
  | "tech"
  | "item"
  | "device"
  | "spell"
  | "specialist"
  | "tower"
  | "blueprint"
  | "reinforcement";

type Entry = { name: string; cost: number | null };
type Known<T extends Entry> = T & { id: string; isUnknown: false };
export interface UnknownCatalogEntry {
  id: string;
  name: string;
  cost: null;
  isUnknown: true;
}

const labels = {
  unit: "Unit",
  tech: "Tech",
  item: "Item",
  device: "Device",
  spell: "Spell",
  specialist: "Specialist",
  tower: "Tower Skill",
  blueprint: "Blueprint",
  reinforcement: "Reinforcement",
} satisfies Record<CatalogKind, string>;

function entry<T extends Entry>(
  kind: CatalogKind,
  id: string,
  value?: T,
): Known<T> | UnknownCatalogEntry {
  return value
    ? { ...value, id, isUnknown: false }
    : {
        id,
        name: `Unknown ${labels[kind]} #${id}`,
        cost: null,
        isUnknown: true,
      };
}

function own<T>(
  record: Record<string, T> | undefined,
  id: string,
): T | undefined {
  return record && Object.hasOwn(record, id) ? record[id] : undefined;
}

export function patchUnit(patch: PatchData | undefined, unitId: string) {
  return own(patch?.units, unitId);
}

export function patchTech(
  patch: PatchData | undefined,
  unitId: string,
  techId: string,
) {
  return own(patchUnit(patch, unitId)?.techs, techId);
}

export function loadPatchData(data: unknown): PatchData {
  return patchDataSchema.parse(data);
}

export function createGameCatalog(patch?: PatchData) {
  const unit = (id: string) =>
    entry<PatchUnit>("unit", id, patchUnit(patch, id));
  const tech = (unitId: string, id: string) =>
    entry<PatchTech>("tech", id, patchTech(patch, unitId, id));
  function lookup(kind: CatalogKind, id: string, unitId?: string) {
    switch (kind) {
      case "unit":
        return unit(id);
      case "tech":
        return tech(unitId ?? "", id);
      case "item":
        return entry(kind, id, own(patch?.items, id));
      case "device":
        return entry(kind, id, own(patch?.devices, id));
      case "spell":
        return entry(kind, id, own(patch?.spells, id));
      case "specialist":
        return entry(kind, id, own(patch?.specialists, id));
      case "tower":
        return entry(kind, id, own(patch?.towers, id));
      case "blueprint":
        return entry(kind, id, own(patch?.blueprints, id));
      case "reinforcement":
        return entry(
          kind,
          id,
          id === "0"
            ? { name: "Skip", cost: null }
            : (own(patch?.items, id) ??
                own(patch?.spells, id) ??
                own(patch?.specialists, id)),
        );
    }
  }
  return { version: patch?.version, unit, tech, lookup };
}
