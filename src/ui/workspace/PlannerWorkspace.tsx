import { useState } from "react";
import { calculateBreakpoint } from "../../core/combat";
import { maxUnitLevel, type PatchData } from "../../core/contracts/patch";
import type { Scenario, ScenarioUnit } from "../../core/contracts/scenario";
import { patchUnit } from "../../core/game-data";
import { standardBoard, type BoardSide } from "../../core/geometry";
import { encodeScenario } from "../../core/scenario/share";
import { estimateArrival } from "../../core/scenario/timing";
import { Planner } from "../planner/Planner";
import "./planner-workspace.css";

function unitName(unit: ScenarioUnit, patch: PatchData) {
  return `${patchUnit(patch, unit.unitId)?.name ?? "Unknown unit"} · ${unit.id}`;
}

const seconds = (value: number | null) =>
  value === null ? "Unavailable" : `${value.toFixed(2)} s`;

function sourceLabel(source: string) {
  const segments = new URL(source).pathname.split("/").filter(Boolean);
  const file = segments.at(-1);
  if (file && /\.(?:md|yaml|py)$/.test(file))
    return file.replace(/\.[^.]+$/, "").replaceAll("_", " ");
  return segments.slice(0, 2).join("/");
}

function Breakpoints({
  attacker,
  units,
  patch,
}: {
  attacker?: ScenarioUnit;
  units: ScenarioUnit[];
  patch: PatchData;
}) {
  const [targetId, setTargetId] = useState("");
  const targets = units.filter(
    ({ side }) => attacker && side !== attacker.side,
  );
  const target = targets.find(({ id }) => id === targetId) ?? targets[0];
  const result =
    attacker && target && calculateBreakpoint(patch, attacker, target);
  const next =
    result && attacker && target && attacker.level < maxUnitLevel
      ? calculateBreakpoint(
          patch,
          { ...attacker, level: attacker.level + 1 },
          target,
        )
      : undefined;
  return (
    <section className="planner-analysis-panel" aria-label="Damage breakpoints">
      <h2>Damage breakpoints</h2>
      {!attacker || !target ? (
        <p>
          Select an attacker on the board and place a unit on the other side.
        </p>
      ) : (
        <label>
          Target
          <select
            value={target.id}
            onChange={(e) => setTargetId(e.currentTarget.value)}
          >
            {targets.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unitName(unit, patch)}
              </option>
            ))}
          </select>
        </label>
      )}
      {result && result.status === "available" && (
        <>
          <dl className="planner-metric-list">
            <div>
              <dt>One hit</dt>
              <dd>{result.oneHit ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Hits to defeat</dt>
              <dd>{result.hits}</dd>
            </div>
            <div>
              <dt>Time after first hit</dt>
              <dd>{seconds(result.ttkSeconds)}</dd>
            </div>
            <div>
              <dt>Damage per hit</dt>
              <dd>
                {result.damage.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
            <div>
              <dt>Target health</dt>
              <dd>
                {result.hp.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
          </dl>
          {next?.status === "available" && (
            <p>
              Attacker level {(attacker?.level ?? 0) + 1}: {next.hits}{" "}
              {next.hits === 1 ? "hit" : "hits"} · {seconds(next.ttkSeconds)}
            </p>
          )}
        </>
      )}
      {result && result.status === "unavailable" && (
        <>
          <p>Breakpoint unavailable for this setup.</p>
          <ul>
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </>
      )}
      {result && (
        <details>
          <summary>Model assumptions and sources</summary>
          <ul>
            {result.assumptions.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <div className="planner-source-links">
            {result.sources.map((source) => (
              <a key={source} href={source} target="_blank" rel="noreferrer">
                {sourceLabel(source)}
              </a>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

export function PlannerWorkspace({
  scenario,
  patch,
  onChange,
  notice,
}: {
  scenario: Scenario;
  patch: PatchData;
  onChange: (scenario: Scenario) => void;
  notice?: string;
}) {
  const [side, setSide] = useState<BoardSide>("south");
  const [showLines, setShowLines] = useState(true);
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");
  const [targetId, setTargetId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const bounds = standardBoard.bounds;
  const target = scenario.units.find(({ id }) => id === targetId);
  const goal = target ?? { x: x ? Number(x) : NaN, y: y ? Number(y) : NaN };
  const goalValid =
    Number.isFinite(goal.x) &&
    Number.isFinite(goal.y) &&
    goal.x >= bounds.x &&
    goal.x <= bounds.x + bounds.width &&
    goal.y >= bounds.y &&
    goal.y <= bounds.y + bounds.height;
  const arrivals = goalValid
    ? scenario.units
        .filter((unit) => unit.side === side)
        .map((unit) => ({
          unit,
          estimate: estimateArrival(unit, goal, patch),
          chaff: patchUnit(patch, unit.unitId)?.roles.includes("chaff"),
        }))
        .sort(
          (a, b) =>
            (a.estimate?.arrival ?? Infinity) -
            (b.estimate?.arrival ?? Infinity),
        )
    : [];
  const firstChaff = arrivals.find(
    ({ chaff, estimate }) => chaff && estimate?.arrival != null,
  )?.estimate?.arrival;
  const reference =
    firstChaff ??
    arrivals.find(({ estimate }) => estimate?.arrival != null)?.estimate
      ?.arrival ??
    null;
  const lines = showLines
    ? arrivals
        .filter(({ estimate }) => estimate?.arrival != null)
        .map(({ unit }) => ({
          unitInstanceId: unit.id,
          x: goal.x,
          y: goal.y,
        }))
    : [];

  async function share() {
    try {
      const url = new URL(location.pathname, location.origin);
      url.hash = encodeScenario(scenario);
      setShareUrl(url.href);
      try {
        await navigator.clipboard.writeText(url.href);
        setShareStatus("Board link copied.");
      } catch {
        setShareStatus("Select and copy the board link below.");
      }
    } catch (cause) {
      setShareUrl("");
      setShareStatus(
        cause instanceof Error ? cause.message : "Could not share this board.",
      );
    }
  }

  return (
    <>
      {notice && (
        <p role="status" className="planner-notice">
          {notice}
        </p>
      )}
      <Planner
        scenario={scenario}
        patch={patch}
        onChange={(value) => {
          setShareUrl("");
          setShareStatus("");
          onChange(value);
        }}
        lines={lines}
        shareControls={
          <div className="planner-analysis-panel planner-share">
            <button
              type="button"
              className="primary-button"
              onClick={() => void share()}
            >
              Copy board link
            </button>
            {shareUrl && (
              <label>
                Share URL
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
            )}
            {shareStatus && <p role="status">{shareStatus}</p>}
          </div>
        }
        renderAnalysis={(selectedUnitId) => (
          <div className="planner-analysis">
            <section
              className="planner-analysis-panel"
              aria-label="Arrival timing"
            >
              <h2>Arrival timing</h2>
              <div className="planner-timing-controls">
                <label>
                  Moving side
                  <select
                    value={side}
                    onChange={(e) =>
                      setSide(
                        e.currentTarget.value === "north" ? "north" : "south",
                      )
                    }
                  >
                    <option value="south">South</option>
                    <option value="north">North</option>
                  </select>
                </label>
                <label>
                  Destination
                  <select
                    value={target?.id ?? ""}
                    onChange={(e) => setTargetId(e.currentTarget.value)}
                  >
                    <option value="">Coordinates</option>
                    {scenario.units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unitName(unit, patch)}
                      </option>
                    ))}
                  </select>
                </label>
                {!target && (
                  <>
                    <label>
                      Destination X
                      <input
                        type="number"
                        min={bounds.x}
                        max={bounds.x + bounds.width}
                        value={x}
                        onChange={(e) => setX(e.currentTarget.value)}
                      />
                    </label>
                    <label>
                      Destination Y
                      <input
                        type="number"
                        min={bounds.y}
                        max={bounds.y + bounds.height}
                        value={y}
                        onChange={(e) => setY(e.currentTarget.value)}
                      />
                    </label>
                  </>
                )}
                <label className="planner-timing-toggle">
                  <input
                    type="checkbox"
                    checked={showLines}
                    onChange={(e) => setShowLines(e.currentTarget.checked)}
                  />{" "}
                  Show arrival lines
                </label>
              </div>
              <p>
                Straight-line travel at catalog speed, with supported flat tech
                changes. Range entry uses distance to the destination minus
                attack range.
              </p>
              {!goalValid ? (
                <p role="alert">Choose coordinates within the board.</p>
              ) : arrivals.length === 0 ? (
                <p>Place a unit on the moving side to see its timing.</p>
              ) : (
                <div className="planner-table-wrap" tabIndex={0}>
                  <table>
                    <caption className="sr-only">
                      Travel, range entry and arrival gap by formation
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Formation</th>
                        <th scope="col">In range</th>
                        <th scope="col">Arrival</th>
                        <th scope="col">
                          {firstChaff == null ? "Gap to first" : "Gap to chaff"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {arrivals.map(({ unit, estimate, chaff }) => (
                        <tr
                          key={unit.id}
                          data-selected={unit.id === selectedUnitId}
                        >
                          <th scope="row">
                            {unitName(unit, patch)}
                            {chaff && <small>Chaff</small>}
                            {estimate?.simplifiedLoadout && (
                              <small>Some loadout effects omitted</small>
                            )}
                          </th>
                          <td>{seconds(estimate?.inRange ?? null)}</td>
                          <td>{seconds(estimate?.arrival ?? null)}</td>
                          <td>
                            {seconds(
                              reference !== null && estimate?.arrival != null
                                ? estimate.arrival - reference
                                : null,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <Breakpoints
              attacker={scenario.units.find(({ id }) => id === selectedUnitId)}
              units={scenario.units}
              patch={patch}
            />
          </div>
        )}
      />
    </>
  );
}
