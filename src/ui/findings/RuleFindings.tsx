import { useId, useState } from "react";
import { ruleSupportNote, supportsRules } from "../../core/analytics/rounds";
import {
  findingSeveritySchema,
  ruleIdSchema,
  type AnalysisReportV1,
  type RuleFinding,
  type RuleId,
} from "../../core/contracts/analysis";
import type { MatchSnapshotV1 } from "../../core/contracts/match";
import "./findings.css";

export interface RuleFindingsProps {
  match: MatchSnapshotV1;
  report: AnalysisReportV1;
  selectedRound: number | null | undefined;
  onGoToFinding: (finding: RuleFinding) => void;
}

const ruleLabels: Record<RuleId, string> = {
  "anti-air-gap": "Anti-air gap",
  "chaff-ratio": "Chaff ratio",
  "deployment-waste": "Deployment waste",
  "tech-overcommit": "Tech overcommit",
  "flank-exposure": "Flank exposure",
  "lane-imbalance": "Lane imbalance",
};

function evidenceLabel(key: string) {
  const label = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function roundFilterValue(round: number | null | undefined) {
  return round == null ? "" : String(round);
}

export function RuleFindings({
  match,
  report,
  selectedRound,
  onGoToFinding,
}: RuleFindingsProps) {
  const titleId = useId();
  const [round, setRound] = useState(roundFilterValue(selectedRound));
  const [previousRound, setPreviousRound] = useState(selectedRound);
  const [player, setPlayer] = useState("");
  const [severity, setSeverity] = useState("");
  const [rule, setRule] = useState("");
  if (previousRound !== selectedRound) {
    setPreviousRound(selectedRound);
    setRound(roundFilterValue(selectedRound));
  }
  if (!supportsRules(match)) {
    return (
      <section className="rule-findings" aria-labelledby={titleId}>
        <h1 id={titleId}>Rule findings</h1>
        <p>{ruleSupportNote}</p>
      </section>
    );
  }

  const playerNames = new Map(
    match.meta.players.map(({ id, name }) => [id, name]),
  );
  for (const finding of report.findings) {
    if (!playerNames.has(finding.playerId))
      playerNames.set(finding.playerId, finding.playerId);
  }

  const rounds = new Set(match.rounds.map(({ roundNumber }) => roundNumber));
  for (const { roundNumber } of report.findings) rounds.add(roundNumber);
  if (selectedRound != null) rounds.add(selectedRound);

  const findings = report.findings.filter(
    (finding) =>
      (!round || String(finding.roundNumber) === round) &&
      (!player || finding.playerId === player) &&
      (!severity || finding.severity === severity) &&
      (!rule || finding.ruleId === rule),
  );

  return (
    <section className="rule-findings" aria-labelledby={titleId}>
      <h1 id={titleId}>Rule findings</h1>
      <div className="rule-findings-filters">
        <label>
          Round
          <select
            value={round}
            onChange={(event) => setRound(event.currentTarget.value)}
          >
            <option value="">All rounds</option>
            {[...rounds]
              .sort((a, b) => a - b)
              .map((number) => (
                <option key={number} value={number}>
                  Round {number}
                </option>
              ))}
          </select>
        </label>
        <label>
          Player
          <select
            value={player}
            onChange={(event) => setPlayer(event.currentTarget.value)}
          >
            <option value="">All players</option>
            {[...playerNames].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select
            value={severity}
            onChange={(event) => setSeverity(event.currentTarget.value)}
          >
            <option value="">All severities</option>
            {findingSeveritySchema.options.map((value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rule
          <select
            value={rule}
            onChange={(event) => setRule(event.currentTarget.value)}
          >
            <option value="">All rules</option>
            {ruleIdSchema.options.map((id) => (
              <option key={id} value={id}>
                {ruleLabels[id]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p role="status">
        {findings.length === 0
          ? "No findings match these filters."
          : `${findings.length} ${findings.length === 1 ? "finding" : "findings"}`}
      </p>
      <ul className="rule-findings-list">
        {findings.map((finding) => {
          const name = playerNames.get(finding.playerId);
          return (
            <li
              key={finding.id}
              className="rule-finding"
              data-severity={finding.severity}
            >
              <p className="rule-finding-meta">
                <span>{finding.severity}</span> · Round{" "}
                <span className="numeric">{finding.roundNumber}</span> · {name}
              </p>
              <h2>{finding.title}</h2>
              <p>{finding.message}</p>
              <dl className="rule-finding-evidence">
                {Object.entries(finding.evidence).map(([key, value]) => (
                  <div key={key}>
                    <dt>{evidenceLabel(key)}</dt>
                    <dd className="numeric">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="rule-finding-formula">
                <strong>Formula</strong> {finding.formula}
              </p>
              <button
                type="button"
                aria-label={`Show on board: ${finding.title}, round ${finding.roundNumber}, ${name}`}
                onClick={() => onGoToFinding(finding)}
              >
                Show on board
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
