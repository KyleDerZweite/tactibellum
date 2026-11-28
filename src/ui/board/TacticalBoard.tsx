import { useEffect, useMemo, useState } from "react";
import type {
  BoardHighlight,
  BoardRectangle,
} from "../../core/contracts/board";
import type { MatchSnapshotV1 } from "../../core/contracts/match";
import type { PatchData } from "../../core/contracts/patch";
import { createGameCatalog } from "../../core/game-data";
import {
  boardSide,
  hasStandardBoard,
  standardBoard,
} from "../../core/geometry";
import { useWorkspace } from "../workspace/store";
import { RangeControl, roleNames } from "./RangeControl";
import { BoardField } from "./BoardField";
import { BoardInspector } from "./BoardInspector";
import { BoardControlIcon } from "./BoardControlIcon";
import {
  boardUnits,
  diffLabels,
  diffMarkers,
  knownPosition,
  unitKey,
} from "./boardUnits";
import "./board.css";

const initialCamera = { x: 0, y: 0, zoom: 1 };
function fallbackBounds(match: MatchSnapshotV1): BoardRectangle {
  const bounds = { ...standardBoard.bounds };
  let edgeX = bounds.width / 2;
  let edgeY = bounds.height / 2;
  for (const round of match.rounds) {
    for (const state of Object.values(round.players)) {
      for (const unit of [...state.units, ...(state.removedUnits ?? [])]) {
        if (!knownPosition(unit)) continue;
        edgeX = Math.max(edgeX, Math.abs(unit.x) + 24);
        edgeY = Math.max(edgeY, Math.abs(unit.y) + 24);
      }
    }
  }
  return { x: -edgeX, y: -edgeY, width: edgeX * 2, height: edgeY * 2 };
}

export function TacticalBoard({
  highlight,
}: { highlight?: BoardHighlight } = {}) {
  const match = useWorkspace((state) => state.match);
  const patch = useWorkspace((state) => state.patch);
  const selectedRound = useWorkspace((state) => state.selectedRound);
  const selectRound = useWorkspace((state) => state.selectRound);
  if (!match) return null;
  return (
    <MatchBoard
      match={match}
      patch={patch}
      selectedRound={selectedRound}
      selectRound={selectRound}
      highlight={highlight}
    />
  );
}

function MatchBoard({
  match,
  patch,
  selectedRound,
  selectRound,
  highlight,
}: {
  match: MatchSnapshotV1;
  patch?: PatchData;
  selectedRound?: number;
  selectRound: (round: number) => void;
  highlight?: BoardHighlight;
}) {
  const [perspective, setPerspective] = useState(false);
  const [camera, setCamera] = useState(initialCamera);
  const [selection, setSelection] = useState<string>();
  const [showDiff, setShowDiff] = useState(false);
  const [showFlanks, setShowFlanks] = useState(true);
  const [showDefense, setShowDefense] = useState(false);
  const [filter, setFilter] = useState("");
  const [range, setRange] = useState("");
  const calibrated = hasStandardBoard(match);
  const bounds = useMemo(
    () => (calibrated ? standardBoard.bounds : fallbackBounds(match)),
    [match, calibrated],
  );
  const firstSide = useMemo(
    () => (calibrated ? boardSide(match, match.meta.players[0].id) : "south"),
    [match, calibrated],
  );
  const flipped = (firstSide === "north") !== perspective;
  const catalog = useMemo(() => createGameCatalog(patch), [patch]);
  const roundIndex = match.rounds.findIndex(
    ({ roundNumber }) => roundNumber === selectedRound,
  );
  const round = match.rounds[roundIndex];
  const units = useMemo(
    () => (round ? boardUnits(match, round, catalog, showDiff) : []),
    [match, round, catalog, showDiff],
  );
  const selected = units.find(({ key }) => key === selection);
  const highlightedKeys = new Set(highlight?.units.map(unitKey));
  const roles = [
    ...new Set([
      ...Object.keys(roleNames),
      ...units.flatMap((data) => data.roles),
      ...[filter, range].filter((role) => role && role !== "selected"),
    ]),
  ].sort();
  const width = (bounds.width + 32) / camera.zoom;
  const height = (bounds.height + 32) / camera.zoom;

  function pan(dx: number, dy: number) {
    setCamera((view) => ({
      ...view,
      x: Math.max(bounds.x, Math.min(-bounds.x, view.x + dx)),
      y: Math.max(bounds.y, Math.min(-bounds.y, view.y + dy)),
    }));
  }

  function zoom(factor: number) {
    setCamera((view) => ({
      ...view,
      zoom: Math.max(1, Math.min(4, view.zoom * factor)),
    }));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          "input, select, textarea, [contenteditable], dialog",
        )
      )
        return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const next =
        match.rounds[roundIndex + (event.key === "ArrowLeft" ? -1 : 1)];
      if (!next) return;
      event.preventDefault();
      selectRound(next.roundNumber);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [match, roundIndex, selectRound]);

  return (
    <div className="tactical-board">
      <header className="board-heading">
        <h1>Tactical Board</h1>
        <p>{match.meta.players.map(({ name }) => name).join(" vs ")}</p>
      </header>
      {!round ? (
        <p>No deployment rounds recorded.</p>
      ) : (
        <>
          <nav
            className="board-controls board-rounds"
            aria-label="Round navigation"
          >
            <button
              type="button"
              aria-label="Previous round"
              disabled={roundIndex === 0}
              onClick={() =>
                selectRound(match.rounds[roundIndex - 1].roundNumber)
              }
            >
              ←
            </button>
            <div className="board-round-list">
              {match.rounds.map(({ roundNumber }) => (
                <button
                  key={roundNumber}
                  type="button"
                  aria-label={`Round ${roundNumber}`}
                  aria-current={
                    roundNumber === selectedRound ? "step" : undefined
                  }
                  onClick={() => selectRound(roundNumber)}
                >
                  {roundNumber}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Next round"
              disabled={roundIndex === match.rounds.length - 1}
              onClick={() =>
                selectRound(match.rounds[roundIndex + 1].roundNumber)
              }
            >
              →
            </button>
            <span className="sr-only" aria-live="polite">
              Round {round.roundNumber}
            </span>
          </nav>
          {!calibrated && (
            <p className="board-warning">
              Board calibration unavailable for {match.meta.mode}
              {match.meta.mapId ? `, map ${match.meta.mapId}` : ""}. Showing
              recorded positions on a coordinate grid.
            </p>
          )}
          {!patch && (
            <p className="board-warning">
              Patch data unavailable. Unit footprints use placeholder sizes and
              ranges are unavailable.
            </p>
          )}
          <div className="board-columns">
            <div className="board-stage">
              <div
                className="board-controls"
                role="group"
                aria-label="Board overlays"
              >
                <button
                  type="button"
                  aria-pressed={showDiff}
                  onClick={() => setShowDiff(!showDiff)}
                >
                  <BoardControlIcon name="diff" /> Diff
                </button>
                {calibrated && (
                  <>
                    <button
                      type="button"
                      aria-pressed={showFlanks}
                      onClick={() => setShowFlanks(!showFlanks)}
                    >
                      <BoardControlIcon name="flank" /> Flanks
                    </button>
                    <button
                      type="button"
                      aria-pressed={showDefense}
                      onClick={() => setShowDefense(!showDefense)}
                    >
                      <BoardControlIcon name="tower" /> Tower defense
                    </button>
                  </>
                )}
                <label>
                  Role{" "}
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.currentTarget.value)}
                  >
                    <option value="">All</option>
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {roleNames[role] ?? role}
                      </option>
                    ))}
                  </select>
                </label>
                <RangeControl range={range} roles={roles} onChange={setRange} />
              </div>
              <BoardField
                bounds={bounds}
                viewBox={{
                  x: camera.x - width / 2,
                  y: camera.y - height / 2,
                  width,
                  height,
                }}
                flipped={flipped}
                calibrated={calibrated}
                firstSide={firstSide}
                flankOpen={round.roundNumber >= standardBoard.flankOpensInRound}
                showFlanks={showFlanks}
                showDefense={showDefense}
                units={units}
                showDiff={showDiff}
                selectedKey={selected?.key}
                highlightedKeys={highlightedKeys}
                region={highlight?.region}
                filter={filter}
                range={range}
                onPan={pan}
                onSelect={setSelection}
              />
              <div
                className="board-controls"
                role="group"
                aria-label="Board viewport"
              >
                <button
                  type="button"
                  aria-label="Zoom out"
                  disabled={camera.zoom === 1}
                  onClick={() => zoom(1 / 1.35)}
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label="Zoom in"
                  disabled={camera.zoom === 4}
                  onClick={() => zoom(1.35)}
                >
                  +
                </button>
                <button
                  type="button"
                  aria-pressed={perspective}
                  onClick={() => {
                    setPerspective(!perspective);
                    setCamera((view) => ({ ...view, x: -view.x, y: -view.y }));
                  }}
                >
                  <BoardControlIcon name="flip" /> Flip board
                </button>
                <button type="button" onClick={() => setCamera(initialCamera)}>
                  <BoardControlIcon name="reset" /> Reset view
                </button>
                <details className="board-pan">
                  <summary>Pan</summary>
                  <div className="board-controls">
                    <button
                      type="button"
                      aria-label="Pan left"
                      onClick={() => pan(-width / 8, 0)}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      aria-label="Pan up"
                      onClick={() => pan(0, -height / 8)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Pan down"
                      onClick={() => pan(0, height / 8)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label="Pan right"
                      onClick={() => pan(width / 8, 0)}
                    >
                      →
                    </button>
                  </div>
                </details>
              </div>
              <div className="board-legend">
                {match.meta.players.map(({ id, name }, index) => (
                  <span key={id} data-player={index}>
                    {name}
                  </span>
                ))}
                <span>Number = level · T = tech count · □ = item</span>
                {calibrated && (
                  <span>E = Energy Tower · R = Research Center</span>
                )}
                {calibrated && showFlanks && (
                  <span>
                    Flanks{" "}
                    {round.roundNumber >= standardBoard.flankOpensInRound
                      ? "open"
                      : "open in round 2"}
                  </span>
                )}
                {showDiff &&
                  Object.entries(diffLabels).map(([key, label]) => (
                    <span
                      className="board-diff-label"
                      data-diff={key}
                      key={key}
                    >
                      {diffMarkers[key as keyof typeof diffMarkers]} {label}
                    </span>
                  ))}
              </div>
            </div>
            <BoardInspector
              match={match}
              round={round}
              units={units}
              selected={selected}
              filter={filter}
              showDiff={showDiff}
              onSelect={setSelection}
            />
          </div>
        </>
      )}
    </div>
  );
}
