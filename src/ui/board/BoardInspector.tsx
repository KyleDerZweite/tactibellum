import type { ReactNode, Ref } from "react";
import type {
  MatchSnapshotV1,
  RoundSnapshot,
} from "../../core/contracts/match";
import { knownPosition, unitLabel, diffLabels } from "./boardUnits";
import type { DisplayUnit } from "./boardUnits";
import { MechReferenceCard } from "./MechReferenceCard";

export function BoardInspector({
  match,
  round,
  units,
  selected,
  showDiff,
  filter,
  onSelect,
}: {
  match: MatchSnapshotV1;
  round: RoundSnapshot;
  units: DisplayUnit[];
  selected?: DisplayUnit;
  showDiff: boolean;
  filter: string;
  onSelect: (key?: string) => void;
}) {
  const missing = units.filter(({ unit }) => !knownPosition(unit)).length;
  return (
    <aside className="board-inspector" aria-label="Round and unit inspector">
      <section>
        <h2>Round {round.roundNumber}</h2>
        {match.meta.players.map(({ id, name }, index) => {
          const state = round.players[id];
          return (
            <div className="board-player-summary" key={id} data-player={index}>
              <strong>{name}</strong>
              {state ? (
                <p>
                  {state.units.length} units · {state.estimatedArmyValue} army
                  value
                  <br />
                  {state.supplySpentThisRound} supply spent ·{" "}
                  {state.deploymentsUsed} deployments
                </p>
              ) : (
                <p>Player data unavailable.</p>
              )}
              {showDiff && state && (
                <p>
                  {Object.entries(diffLabels)
                    .map(([key, label]) => {
                      const count = units.filter(
                        (data) => data.player.id === id && data.diff === key,
                      ).length;
                      return count ? `${label} ${count}` : "";
                    })
                    .filter(Boolean)
                    .join(" · ") || "No unit changes"}
                </p>
              )}
            </div>
          );
        })}
        {missing > 0 && (
          <p className="board-warning">
            {missing} {missing === 1 ? "unit has" : "units have"} no recorded
            position. Inspect {missing === 1 ? "it" : "them"} in the unit list.
          </p>
        )}
      </section>
      <UnitInspector
        units={units}
        selected={selected}
        filter={filter}
        onSelect={onSelect}
        showRoundStatus
      />
    </aside>
  );
}

export function UnitInspector({
  units,
  selected,
  filter = "",
  onSelect,
  showRoundStatus = false,
  pickerRef,
  children,
}: {
  units: DisplayUnit[];
  selected?: DisplayUnit;
  filter?: string;
  onSelect: (key?: string) => void;
  showRoundStatus?: boolean;
  pickerRef?: Ref<HTMLSelectElement>;
  children?: ReactNode;
}) {
  const { unit, entry, techs } = selected ?? {};
  const visible = units.filter(
    (data) => !filter || data.roles.includes(filter) || data === selected,
  );
  return (
    <section>
      <h2>Unit inspector</h2>
      <label className="board-unit-picker">
        Unit
        <select
          ref={pickerRef}
          value={selected?.key ?? ""}
          onChange={(event) => onSelect(event.currentTarget.value || undefined)}
        >
          <option value="">Select a unit</option>
          {visible.map((data) => (
            <option key={`${data.key}:${data.removed}`} value={data.key}>
              {unitLabel(data)}
              {knownPosition(data.unit) ? "" : " · Position unavailable"}
            </option>
          ))}
        </select>
      </label>
      {selected && unit && entry && techs && (
        <>
          {children}
          <MechReferenceCard key={unit.unitId} data={selected} />
          <dl className="board-unit-facts">
            <dt>Player</dt>
            <dd>{selected.player.name}</dd>
            {!children && (
              <>
                <dt>Level</dt>
                <dd>{unit.level}</dd>
              </>
            )}
            <dt>Estimated value</dt>
            <dd>
              {entry.cost === null
                ? "Unavailable"
                : entry.cost * (1 + (unit.level - 1) / 2)}
            </dd>
            {!children && (
              <>
                <dt>Position</dt>
                <dd>
                  {knownPosition(unit)
                    ? `(${unit.x}, ${unit.y}) m`
                    : "Unavailable"}
                </dd>
              </>
            )}
            <dt>Main attack range</dt>
            <dd>
              {selected.range === null ? "Unavailable" : `${selected.range} m`}
            </dd>
            <dt>Roles</dt>
            <dd>{selected.roles.join(", ") || "Unavailable"}</dd>
            {!children && (
              <>
                <dt>Techs</dt>
                <dd>{techs.map(({ name }) => name).join(", ") || "None"}</dd>
                <dt>Item</dt>
                <dd>{selected.item?.name ?? "None"}</dd>
              </>
            )}
            {showRoundStatus && (
              <>
                <dt>Round status</dt>
                <dd>
                  {selected.diff === "existing"
                    ? "Existing"
                    : diffLabels[selected.diff]}
                </dd>
              </>
            )}
          </dl>
        </>
      )}
    </section>
  );
}
