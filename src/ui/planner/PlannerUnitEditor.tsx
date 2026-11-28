import { useState } from "react";
import type { KeyboardEvent } from "react";
import { maxUnitLevel, type PatchData } from "../../core/contracts/patch";
import type { ScenarioUnit } from "../../core/contracts/scenario";
import { scenarioUnitSchema } from "../../core/contracts/scenario";
import { standardBoard } from "../../core/geometry";

function NumberEditor({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  step?: number | "any";
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<{ original: number; text: string }>();
  const text = draft?.original === value ? draft.text : value;

  function commit(input: HTMLInputElement) {
    if (
      draft?.original === value &&
      input.validity.valid &&
      Number.isFinite(input.valueAsNumber)
    ) {
      onChange(input.valueAsNumber);
    }
    setDraft(undefined);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") setDraft(undefined);
    if (event.key === "Enter") {
      event.preventDefault();
      commit(event.currentTarget);
    }
  }

  return (
    <label className="board-unit-picker">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(event) =>
          setDraft({ original: value, text: event.currentTarget.value })
        }
        onBlur={(event) => commit(event.currentTarget)}
        onKeyDown={keyDown}
      />
    </label>
  );
}

export function PlannerUnitEditor({
  unit,
  patch,
  onChange,
  onRemove,
}: {
  unit: ScenarioUnit;
  patch: PatchData;
  onChange: (changes: Partial<ScenarioUnit>) => void;
  onRemove: () => void;
}) {
  const { x, y, width, height } = standardBoard.bounds;
  const techs = Object.entries(patch.units[unit.unitId]?.techs ?? {});
  const unknownTechs = unit.techIds.filter(
    (id) => !techs.some(([techId]) => techId === id),
  );
  const items = Object.entries(patch.items).sort(([, a], [, b]) =>
    a.name.localeCompare(b.name),
  );
  return (
    <div className="planner-unit-editor">
      <div className="planner-coordinates">
        <NumberEditor
          label="X (m)"
          value={unit.x}
          min={x}
          max={x + width}
          step="any"
          onChange={(value) => onChange({ x: value })}
        />
        <NumberEditor
          label="Y (m)"
          value={unit.y}
          min={y}
          max={y + height}
          step="any"
          onChange={(value) => onChange({ y: value })}
        />
      </div>
      <NumberEditor
        label="Level"
        value={unit.level}
        min={1}
        max={maxUnitLevel}
        onChange={(level) => onChange({ level })}
      />
      <NumberEditor
        label="Rotation (°)"
        value={unit.orientation ?? 0}
        min={0}
        max={359}
        onChange={(orientation) => onChange({ orientation })}
      />
      <label className="board-unit-picker">
        Item
        <select
          value={unit.itemId ?? ""}
          onChange={(event) =>
            onChange({ itemId: event.currentTarget.value || undefined })
          }
        >
          <option value="">None</option>
          {unit.itemId && !Object.hasOwn(patch.items, unit.itemId) && (
            <option value={unit.itemId}>Unknown item #{unit.itemId}</option>
          )}
          {items.map(([id, { name }]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {(techs.length > 0 || unknownTechs.length > 0) && (
        <fieldset className="planner-techs">
          <legend>Techs</legend>
          {[
            ...techs.map(([id, { name }]) => ({
              id,
              name: techs.some(
                ([otherId, other]) => otherId !== id && other.name === name,
              )
                ? `${name} (#${id})`
                : name,
            })),
            ...unknownTechs.map((id) => ({ id, name: `Unknown tech #${id}` })),
          ].map(({ id, name }) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={unit.techIds.includes(id)}
                disabled={
                  !unit.techIds.includes(id) &&
                  !scenarioUnitSchema.shape.techIds.safeParse([
                    ...unit.techIds,
                    id,
                  ]).success
                }
                onChange={(event) =>
                  onChange({
                    techIds: event.currentTarget.checked
                      ? [...unit.techIds, id]
                      : unit.techIds.filter((techId) => techId !== id),
                  })
                }
              />
              {name}
            </label>
          ))}
        </fieldset>
      )}
      <div className="board-controls">
        <button type="button" onClick={onRemove}>
          Remove unit
        </button>
      </div>
    </div>
  );
}
