import { useId, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { BoardRectangle } from "../../core/contracts/board";
import { standardBoard } from "../../core/geometry";
import type { BoardSide } from "../../core/geometry";
import { diffMarkers, knownPosition, unitLabel } from "./boardUnits";
import type { DisplayUnit } from "./boardUnits";
import { MechGlyph } from "./MechGlyph";
import { mechReference } from "./mechReference";

function UnitToken({
  data,
  x,
  y,
  viewBox,
  selected,
  highlighted,
  dimmed,
  showDiff,
  onSelect,
}: {
  data: DisplayUnit;
  x: number;
  y: number;
  viewBox: BoardRectangle;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  showDiff: boolean;
  onSelect: () => void;
}) {
  const { unit, entry, index, diff } = data;
  const { width, height } = entry.isUnknown
    ? { width: 18, height: 18 }
    : entry.footprint;
  const badgeX = Math.max(width, height, 20) / 2;
  const code = entry.isUnknown ? undefined : mechReference(unit.unitId)?.code;
  const rotation = ((unit.orientation ?? 0) * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(rotation));
  const sine = Math.abs(Math.sin(rotation));
  const halfWidth = (width * cosine + height * sine) / 2;
  const halfHeight = (width * sine + height * cosine) / 2;
  const inView =
    x + halfWidth >= viewBox.x &&
    x - halfWidth <= viewBox.x + viewBox.width &&
    y + halfHeight >= viewBox.y &&
    y - halfHeight <= viewBox.y + viewBox.height;
  return (
    <g
      className="board-unit"
      role="button"
      tabIndex={inView ? 0 : -1}
      aria-label={unitLabel(data)}
      aria-pressed={selected}
      data-unit-key={data.key}
      data-player={index}
      data-diff={showDiff ? diff : undefined}
      data-highlighted={highlighted}
      data-dimmed={dimmed && !highlighted && !selected}
      transform={`translate(${x} ${y})`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <title>
        {[
          unitLabel(data),
          `Position (${unit.x}, ${unit.y}) m`,
          data.range === null
            ? "Range unavailable"
            : `Main attack range ${data.range} m`,
          data.techs.length
            ? `Techs: ${data.techs.map(({ name }) => name).join(", ")}`
            : "",
          data.item ? `Item: ${data.item.name}` : "",
        ]
          .filter(Boolean)
          .join("\n")}
      </title>
      <g transform={`rotate(${-(unit.orientation ?? 0)})`}>
        <rect
          className="board-footprint"
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          rx={2}
        />
      </g>
      <circle
        r={Math.max(14, Math.min(width, height) / 2)}
        fill="transparent"
      />
      <MechGlyph
        data={data}
        transform={code ? "translate(0 -4) scale(.75)" : undefined}
      />
      {code && (
        <text className="board-mech-code" textAnchor="middle" y={10}>
          {code}
        </text>
      )}
      <text className="board-unit-badge" textAnchor="middle" x={badgeX} y={-9}>
        {unit.level}
      </text>
      {!!unit.techIds.length && (
        <text
          className="board-unit-badge"
          textAnchor="middle"
          x={-badgeX}
          y={-9}
        >
          T{unit.techIds.length}
        </text>
      )}
      {unit.itemId && (
        <path className="board-item" d={`M${badgeX - 4} 5h8v8h-8z`} />
      )}
      {showDiff && diff !== "existing" && (
        <text className="board-diff-marker" textAnchor="middle" y={21}>
          {diffMarkers[diff]}
        </text>
      )}
    </g>
  );
}

type Position = { x: number; y: number };
export type BoardLine = Position & { unitInstanceId: string };

type BoardFieldProps = {
  bounds: BoardRectangle;
  viewBox: BoardRectangle;
  flipped: boolean;
  calibrated: boolean;
  firstSide: BoardSide;
  flankOpen: boolean;
  showFlanks: boolean;
  showDefense: boolean;
  units: DisplayUnit[];
  showDiff: boolean;
  selectedKey?: string;
  highlightedKeys: Set<string>;
  region?: BoardRectangle;
  filter: string;
  range: string;
  onPan?: (dx: number, dy: number) => void;
  onMoveUnit?: (key: string, position: Position) => void;
  lines?: BoardLine[];
  onSelect: (key?: string) => void;
};

export function BoardField({
  bounds,
  viewBox,
  flipped,
  calibrated,
  firstSide,
  flankOpen,
  showFlanks,
  showDefense,
  units,
  showDiff,
  selectedKey,
  highlightedKeys,
  region,
  filter,
  range,
  onPan,
  onMoveUnit,
  lines,
  onSelect,
}: BoardFieldProps) {
  const grid = useId();
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    moved: boolean;
    unit?: { key: string; offset: Position };
  }>(null);
  const [preview, setPreview] = useState<{ key: string; position: Position }>();
  const sign = flipped ? -1 : 1;
  const point = (x: number, y: number) => ({ x: sign * x, y: -sign * y });
  function rect({ x, y, width, height }: BoardRectangle) {
    return {
      ...point(flipped ? x + width : x, flipped ? y : y + height),
      width,
      height,
    };
  }
  const area = rect(bounds);

  function pointerPosition(event: PointerEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const pointer = svg.createSVGPoint();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const local = pointer.matrixTransform(matrix.inverse());
    return point(local.x, local.y);
  }

  function unitCenter({ key, unit }: DisplayUnit) {
    const position = preview?.key === key ? preview.position : unit;
    return point(position.x, position.y);
  }

  function startDrag(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || drag.current) return;
    const token = (event.target as Element).closest<SVGGElement>(".board-unit");
    const key = token?.getAttribute("data-unit-key");
    const unit = onMoveUnit && units.find((data) => data.key === key)?.unit;
    const position = unit && pointerPosition(event);
    if (token && (!unit || !position || !key)) return;
    // Touch does not consistently shift focus away from the inspector.
    if (onMoveUnit)
      (token ?? event.currentTarget).focus({ preventScroll: true });
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      unit:
        unit && position && key
          ? { key, offset: { x: unit.x - position.x, y: unit.y - position.y } }
          : undefined,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    const active = drag.current;
    if (active?.id !== event.pointerId) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (!active.moved && Math.hypot(dx, dy) < 4) return;
    if (active.unit) {
      const position = pointerPosition(event);
      if (!position) return;
      active.moved = true;
      setPreview({
        key: active.unit.key,
        position: {
          x: position.x + active.unit.offset.x,
          y: position.y + active.unit.offset.y,
        },
      });
      return;
    }
    const scale = event.currentTarget.getScreenCTM()?.a;
    if (!scale) return;
    active.x = event.clientX;
    active.y = event.clientY;
    active.moved = true;
    onPan?.(-dx / scale, -dy / scale);
  }

  function endDrag(event: PointerEvent<SVGSVGElement>) {
    const active = drag.current;
    if (active?.id !== event.pointerId) return;
    if (active.unit) {
      onSelect(active.unit.key);
      const position = pointerPosition(event);
      if (
        position &&
        (active.moved ||
          Math.hypot(event.clientX - active.x, event.clientY - active.y) >= 4)
      ) {
        onMoveUnit?.(active.unit.key, {
          x: position.x + active.unit.offset.x,
          y: position.y + active.unit.offset.y,
        });
      }
    } else if (!active.moved) {
      onSelect();
    }
    cancelDrag(event);
  }

  function cancelDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setPreview(undefined);
  }

  return (
    <svg
      className="board-field"
      aria-label="Deployment board"
      role="group"
      tabIndex={onMoveUnit ? -1 : undefined}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
      onLostPointerCapture={cancelDrag}
    >
      <defs>
        <pattern id={grid} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" className="board-grid" />
        </pattern>
        <clipPath id={`${grid}-viewport`}>
          <rect {...viewBox} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${grid}-viewport)`}>
        <rect {...area} className="board-surface" />
        {calibrated &&
          (["north", "south"] as const).map((side) => (
            <g
              key={side}
              data-side={side}
              data-player={side === firstSide ? 0 : 1}
            >
              <rect
                {...rect(standardBoard.main[side])}
                className="board-half"
              />
              {showFlanks &&
                Object.entries(standardBoard.flank[side]).map(
                  ([edge, flank]) => (
                    <rect
                      key={edge}
                      {...rect(flank)}
                      className="board-flank"
                      data-open={flankOpen}
                    >
                      <title>
                        Flank {flankOpen ? "open" : "opens in round 2"}
                      </title>
                    </rect>
                  ),
                )}
            </g>
          ))}
        <rect {...area} fill={`url(#${grid})`} />
        {calibrated && (
          <>
            <path className="board-axis" d="M-360 0H360 M0 -310V310" />
            {standardBoard.towers.map(({ id, x, y, kind, side }) => {
              const center = point(x, y);
              const size = standardBoard.towerFootprint;
              return (
                <g
                  key={id}
                  className="board-tower"
                  data-player={side === firstSide ? 0 : 1}
                  transform={`translate(${center.x} ${center.y})`}
                >
                  <title>{kind}</title>
                  {showDefense && (
                    <circle
                      className="board-defense"
                      r={standardBoard.towerDefenseRadius}
                    />
                  )}
                  <rect
                    x={-size / 2}
                    y={-size / 2}
                    width={size}
                    height={size}
                    rx={2}
                  />
                  <text textAnchor="middle" y={4}>
                    {kind === "Energy Tower" ? "E" : "R"}
                  </text>
                </g>
              );
            })}
          </>
        )}
        {region && <rect className="board-region" {...rect(region)} />}
        {units.map((data) => {
          if (data.removed || !knownPosition(data.unit) || !data.range)
            return null;
          if (
            range !== "all" &&
            !(range === "selected"
              ? selectedKey === data.key
              : data.roles.includes(range))
          )
            return null;
          const center = unitCenter(data);
          return (
            <circle
              key={data.key}
              className="board-range"
              data-player={data.index}
              cx={center.x}
              cy={center.y}
              r={data.range}
            />
          );
        })}
        {lines?.map(({ unitInstanceId, x, y }, index) => {
          const data = units.find(
            ({ unit }) => unit.instanceId === unitInstanceId,
          );
          if (!data || data.removed || !knownPosition(data.unit)) return null;
          const start = unitCenter(data);
          const end = point(x, y);
          return (
            <line
              key={index}
              className="board-timing-line"
              data-player={data.index}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
            />
          );
        })}
        {units
          .filter(({ unit }) => knownPosition(unit))
          .map((data) => (
            <UnitToken
              key={`${data.key}:${data.removed}`}
              data={data}
              {...unitCenter(data)}
              viewBox={viewBox}
              selected={selectedKey === data.key}
              highlighted={highlightedKeys.has(data.key)}
              dimmed={!!filter && !data.roles.includes(filter)}
              showDiff={showDiff}
              onSelect={() => onSelect(data.key)}
            />
          ))}
      </g>
    </svg>
  );
}
