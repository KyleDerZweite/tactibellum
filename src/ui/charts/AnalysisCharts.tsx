import { useId, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { analysisFormulas } from "../../core/analytics/formulas";
import type { AnalysisReportV1 } from "../../core/contracts/analysis";
import type { MatchSnapshotV1 } from "../../core/contracts/match";
import {
  formatMetric,
  lanes,
  metrics,
  roles,
  towerComponents,
  towerKind,
} from "./metrics";
import "./charts.css";

export interface AnalysisChartsProps {
  match: MatchSnapshotV1;
  report: AnalysisReportV1;
  selectedRound: number | null | undefined;
  onGoToRound: (roundNumber: number) => void;
}

interface ChartRound {
  roundNumber: number;
  values: (number | null)[];
}

const playerColors = ["var(--color-accent)", "var(--color-opponent)"];
const axisColor = "var(--color-muted)";

function Choice<Key extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Record<Key, string>;
  value: Key;
  onChange: (choice: Key) => void;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as Key)}
      >
        {(Object.keys(options) as Key[]).map((key) => (
          <option key={key} value={key}>
            {options[key]}
          </option>
        ))}
      </select>
    </label>
  );
}

const metricLabels = Object.fromEntries(
  Object.entries(metrics).map(([key, { label }]) => [key, label]),
) as Record<keyof typeof metrics, string>;

export function AnalysisCharts({
  match,
  report,
  selectedRound,
  onGoToRound,
}: AnalysisChartsProps) {
  const titleId = useId();
  const formulaId = useId();
  const [metric, setMetric] = useState<keyof typeof metrics>("armyValue");
  const [role, setRole] = useState<keyof typeof roles>("chaff");
  const [lane, setLane] = useState<keyof typeof lanes>("leftArmyValue");
  const [towerChoice, setTowerChoice] = useState("");
  const [towerComponent, setTowerComponent] =
    useState<keyof typeof towerComponents>("opposingFlankValue");

  const players = match.meta.players.slice(0, 2);
  const roundNumbers = [
    ...new Set(match.rounds.map(({ roundNumber }) => roundNumber)),
  ].sort((a, b) => a - b);
  const reportRounds = new Map(
    report.rounds.map((round) => [round.roundNumber, round]),
  );
  const towers = new Set<string>();
  if (metric === "towerDefense") {
    for (const roundNumber of roundNumbers) {
      for (const { id } of players) {
        for (const { towerId } of reportRounds.get(roundNumber)?.players[id]
          ?.spatial?.towerDefense ?? []) {
          towers.add(towerKind(towerId));
        }
      }
    }
  }
  const tower = towers.has(towerChoice)
    ? towerChoice
    : (towers.values().next().value ?? "");
  const definition = metrics[metric];
  const unit = "unit" in definition ? definition.unit : undefined;
  const format = (value: number | null) => formatMetric(value, unit);
  const rows: ChartRound[] = roundNumbers.map((roundNumber) => ({
    roundNumber,
    values: players.map(({ id }) => {
      const data = reportRounds.get(roundNumber)?.players[id];
      return data
        ? definition.value(data, { role, lane, tower, towerComponent })
        : null;
    }),
  }));
  const plotRows = rows.flatMap((row, index) => {
    const previous = rows[index - 1];
    return previous && row.roundNumber > previous.roundNumber + 1
      ? [
          {
            roundNumber: previous.roundNumber + 1,
            values: players.map(() => null),
          },
          row,
        ]
      : [row];
  });
  const rowsByRound = new Map(rows.map((row) => [row.roundNumber, row]));
  const current =
    selectedRound == null ? undefined : rowsByRound.get(selectedRound);
  const hasValues = rows.some(({ values }) =>
    values.some((value) => value !== null),
  );

  return (
    <section className="analysis-charts" aria-labelledby={titleId}>
      <h1 id={titleId}>Economy &amp; graphs</h1>
      <div className="analysis-chart-card">
        <div className="analysis-chart-controls">
          <Choice
            label="Metric"
            options={metricLabels}
            value={metric}
            onChange={setMetric}
          />
          {metric === "composition" && (
            <Choice
              label="Role"
              options={roles}
              value={role}
              onChange={setRole}
            />
          )}
          {metric === "spatial" && (
            <Choice
              label="Zone"
              options={lanes}
              value={lane}
              onChange={setLane}
            />
          )}
          {metric === "towerDefense" && towers.size > 0 && (
            <>
              <Choice
                label="Tower"
                options={Object.fromEntries(
                  [...towers].map((kind) => [kind, kind.replaceAll("-", " ")]),
                )}
                value={tower}
                onChange={setTowerChoice}
              />
              <Choice
                label="Tower value"
                options={towerComponents}
                value={towerComponent}
                onChange={setTowerComponent}
              />
            </>
          )}
        </div>
        <details className="analysis-chart-formula">
          <summary aria-controls={formulaId}>
            Formula for {definition.label}
          </summary>
          <p id={formulaId}>{analysisFormulas[metric]}</p>
        </details>
        <ul
          className="analysis-chart-legend"
          aria-label={
            current ? `Round ${current.roundNumber} values` : "Players"
          }
        >
          {players.map(({ id, name }, index) => (
            <li key={id}>
              <span
                aria-hidden="true"
                className="analysis-chart-key"
                data-series={index}
              />
              {name}
              {current && (
                <span className="numeric">{format(current.values[index])}</span>
              )}
            </li>
          ))}
        </ul>
        {hasValues ? (
          <div className="analysis-chart-plot" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart
                data={plotRows}
                accessibilityLayer={false}
                margin={{ top: 12, right: 18, bottom: 4, left: 4 }}
              >
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis
                  dataKey="roundNumber"
                  ticks={roundNumbers}
                  tick={({ x, y, payload }) => (
                    <text
                      x={x}
                      y={y}
                      dy="0.71em"
                      fill={axisColor}
                      textAnchor="middle"
                      className="analysis-chart-round-tick"
                      onClick={() => onGoToRound(Number(payload.value))}
                    >
                      R{payload.value}
                    </text>
                  )}
                  tickLine={false}
                />
                <YAxis
                  width="auto"
                  tickFormatter={format}
                  tick={{ fill: axisColor }}
                  tickLine={false}
                />
                {current && (
                  <ReferenceLine
                    x={current.roundNumber}
                    stroke="var(--color-muted)"
                    strokeDasharray="3 3"
                  />
                )}
                <Tooltip
                  isAnimationActive={false}
                  filterNull={false}
                  content={({ active, label }) => {
                    const row = rowsByRound.get(Number(label));
                    if (!active || !row) return null;
                    return (
                      <div
                        className="analysis-chart-tooltip"
                        aria-hidden="true"
                      >
                        <p className="numeric">Round {row.roundNumber}</p>
                        {players.map(({ id, name }, index) => (
                          <p key={id}>
                            {name}{" "}
                            <span className="numeric">
                              {format(row.values[index])}
                            </span>
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                {players.map(({ id }, index) => (
                  <Line
                    key={id}
                    type="linear"
                    dataKey={(row: ChartRound) => row.values[index]}
                    stroke={playerColors[index]}
                    strokeWidth={2}
                    strokeDasharray={index === 1 ? "5 3" : undefined}
                    dot={({ cx, cy, index: rowIndex }) => (
                      <g className="analysis-chart-point">
                        {cx != null && cy != null && (
                          <>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={3}
                              fill={playerColors[index]}
                            />
                            <circle
                              cx={cx}
                              cy={cy}
                              r={10}
                              fill="transparent"
                              onClick={() =>
                                onGoToRound(plotRows[rowIndex].roundNumber)
                              }
                            />
                          </>
                        )}
                      </g>
                    )}
                    activeDot={false}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="analysis-chart-empty">
            No values are available for this metric.
          </p>
        )}
        {report.notes.length > 0 && (
          <details className="analysis-chart-formula">
            <summary>Analysis assumptions</summary>
            <ul className="grid list-disc gap-2 pl-5">
              {report.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </details>
        )}
        {rows.length > 0 && (
          <details className="analysis-chart-table">
            <summary>Round data</summary>
            <table>
              <caption>
                {definition.label} by round. Choose a round to open it on the
                board.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Round</th>
                  {players.map(({ id, name }) => (
                    <th key={id} scope="col">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ roundNumber, values }) => (
                  <tr
                    key={roundNumber}
                    data-selected={roundNumber === selectedRound}
                  >
                    <th scope="row">
                      <button
                        type="button"
                        aria-current={
                          roundNumber === selectedRound ? true : undefined
                        }
                        onClick={() => onGoToRound(roundNumber)}
                      >
                        Round {roundNumber}
                      </button>
                    </th>
                    {values.map((value, index) => (
                      <td key={players[index].id}>{format(value)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>
    </section>
  );
}
