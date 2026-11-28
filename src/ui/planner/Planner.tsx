import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PatchData } from "../../core/contracts/patch";
import type { Scenario, ScenarioUnit } from "../../core/contracts/scenario";
import { scenarioUnitLimit } from "../../core/contracts/scenario";
import { createGameCatalog } from "../../core/game-data";
import { standardBoard } from "../../core/geometry";
import { BoardField } from "../board/BoardField";
import type { BoardLine } from "../board/BoardField";
import { UnitInspector } from "../board/BoardInspector";
import { displayUnit, unitKey } from "../board/boardUnits";
import { RangeControl, roleNames } from "../board/RangeControl";
import { PlannerUnitEditor } from "./PlannerUnitEditor";
import "../board/board.css";
import "./planner.css";

const sides = {
  south: { id: "south", name: "South" },
  north: { id: "north", name: "North" },
};
const bounds = standardBoard.bounds;
const viewBox = {
  x: bounds.x - 16,
  y: bounds.y - 16,
  width: bounds.width + 32,
  height: bounds.height + 32,
};
const noHighlights = new Set<string>();

type PlannerProps = {
  scenario: Scenario;
  patch: PatchData;
  onChange: (scenario: Scenario) => void;
  renderAnalysis?: (selectedUnitId: string | undefined) => ReactNode;
  shareControls?: ReactNode;
  lines?: BoardLine[];
};

export function Planner({
  scenario,
  patch,
  onChange,
  renderAnalysis,
  shareControls,
  lines,
}: PlannerProps) {
  const nextId = useRef(1);
  const addButton = useRef<HTMLButtonElement>(null);
  const unitPicker = useRef<HTMLSelectElement>(null);
  const atCapacity = scenario.units.length >= scenarioUnitLimit;
  const [side, setSide] = useState<ScenarioUnit["side"]>("south");
  const [unitChoice, setUnitChoice] = useState("");
  const [selection, setSelection] = useState<string>();
  const [range, setRange] = useState("selected");
  const catalog = useMemo(() => createGameCatalog(patch), [patch]);
  const choices = useMemo(
    () =>
      Object.entries(patch.units).sort(([, a], [, b]) =>
        a.name.localeCompare(b.name),
      ),
    [patch],
  );
  const unitId = Object.hasOwn(patch.units, unitChoice)
    ? unitChoice
    : choices[0]?.[0];
  const units = scenario.units.map((unit) =>
    displayUnit(
      { ...unit, instanceId: unit.id, statusThisRound: "existing" },
      sides[unit.side],
      unit.side === "south" ? 0 : 1,
      catalog,
    ),
  );
  const selected = units.find(({ key }) => key === selection);
  const edited = scenario.units.find(
    ({ id }) => id === selected?.unit.instanceId,
  );
  const roles = [
    ...new Set([
      ...Object.keys(roleNames),
      ...units.flatMap((data) => data.roles),
      ...[range].filter((role) => role && role !== "selected"),
    ]),
  ].sort();

  function addUnit() {
    if (!unitId || atCapacity) return;
    const ids = new Set(scenario.units.map(({ id }) => id));
    while (ids.has(String(nextId.current))) nextId.current += 1;
    const id = String(nextId.current++);
    const zone = standardBoard.main[side];
    const y = zone.y + zone.height / 2;
    const occupied = new Set(
      scenario.units
        .filter((unit) => Math.abs(unit.y - y) < 40)
        .map(({ x }) => Math.round(x / 40)),
    );
    const spots = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7];
    const x = (spots.find((spot) => !occupied.has(spot)) ?? 0) * 40;
    onChange({
      ...scenario,
      units: [
        ...scenario.units,
        { id, side, unitId, x, y, level: 1, techIds: [] },
      ],
    });
    setSelection(unitKey({ playerId: side, instanceId: id }));
  }

  function updateUnit(id: string, changes: Partial<ScenarioUnit>) {
    onChange({
      ...scenario,
      units: scenario.units.map((unit) =>
        unit.id === id ? { ...unit, ...changes } : unit,
      ),
    });
  }

  function removeUnit(id: string) {
    (scenario.units.length > 1 ? unitPicker : addButton).current?.focus();
    onChange({
      ...scenario,
      units: scenario.units.filter((unit) => unit.id !== id),
    });
    setSelection(undefined);
  }

  return (
    <div className="tactical-board planner">
      <header className="board-heading">
        <h1>Analysis Board</h1>
        <p>
          Standard 1v1 map · Patch {scenario.patchVersion}. Placements are
          hypothetical.
        </p>
      </header>
      {shareControls}
      <div className="board-columns">
        <div className="board-stage">
          <form
            className="board-controls planner-placement"
            aria-label="Add a unit"
            onSubmit={(event) => {
              event.preventDefault();
              addUnit();
            }}
          >
            <label>
              Side
              <select
                value={side}
                onChange={(event) =>
                  setSide(
                    event.currentTarget.value === "north" ? "north" : "south",
                  )
                }
              >
                <option value="south">South</option>
                <option value="north">North</option>
              </select>
            </label>
            <label>
              Unit type
              <select
                value={unitId ?? ""}
                onChange={(event) => setUnitChoice(event.currentTarget.value)}
              >
                {!choices.length && <option value="">No patch units</option>}
                {choices.map(([id, { name }]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button
              ref={addButton}
              type="submit"
              disabled={!unitId || atCapacity}
            >
              Add unit
            </button>
          </form>
          {atCapacity && (
            <p className="planner-hint">
              This board has reached its {scenarioUnitLimit}-unit limit.
            </p>
          )}
          <div
            className="board-controls"
            role="group"
            aria-label="Board overlays"
          >
            <RangeControl range={range} roles={roles} onChange={setRange} />
          </div>
          <BoardField
            bounds={bounds}
            viewBox={viewBox}
            flipped={false}
            calibrated
            firstSide="south"
            flankOpen
            showFlanks
            showDefense={false}
            units={units}
            showDiff={false}
            selectedKey={selected?.key}
            highlightedKeys={noHighlights}
            filter=""
            range={range}
            lines={lines}
            onMoveUnit={(key, position) => {
              const moved = units.find((unit) => unit.key === key);
              if (!moved) return;
              updateUnit(moved.unit.instanceId, {
                x: Math.max(
                  bounds.x,
                  Math.min(bounds.x + bounds.width, Math.round(position.x)),
                ),
                y: Math.max(
                  bounds.y,
                  Math.min(bounds.y + bounds.height, Math.round(position.y)),
                ),
              });
            }}
            onSelect={setSelection}
          />
          <div className="board-legend">
            <span data-player={0}>South</span>
            <span data-player={1}>North</span>
            <span>E = Energy Tower · R = Research Center</span>
          </div>
          <p className="planner-hint">
            Drag a unit or edit its coordinates in the inspector.
          </p>
        </div>
        <aside className="board-inspector" aria-label="Planner inspector">
          <UnitInspector
            units={units}
            selected={selected}
            onSelect={setSelection}
            pickerRef={unitPicker}
          >
            {edited && (
              <PlannerUnitEditor
                key={edited.id}
                unit={edited}
                patch={patch}
                onChange={(changes) => updateUnit(edited.id, changes)}
                onRemove={() => removeUnit(edited.id)}
              />
            )}
          </UnitInspector>
        </aside>
      </div>
      {renderAnalysis?.(edited?.id)}
    </div>
  );
}
