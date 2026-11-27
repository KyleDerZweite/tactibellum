import { useState } from "react";
import type { MatchSnapshotV1 } from "../../core/contracts/match";
import { createGameCatalog } from "../../core/game-data";
import { useWorkspace } from "./store";

export function MatchOverview({ match }: { match: MatchSnapshotV1 }) {
  const { meta, rounds } = match;
  const patch = useWorkspace((state) => state.patch);
  return (
    <section className="replay-section" aria-label="Match summary">
      <dl className="match-facts">
        <div>
          <dt>Players</dt>
          <dd>{meta.players.map((player) => player.name).join(" vs ")}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{meta.mode}</dd>
        </div>
        <div>
          <dt>Deployment rounds</dt>
          <dd className="numeric">{rounds.length}</dd>
        </div>
        <div>
          <dt>Replay patch</dt>
          <dd className="numeric">{meta.gameVersion ?? "Unspecified"}</dd>
        </div>
        <div>
          <dt>Catalog patch</dt>
          <dd className="numeric">{patch?.version ?? "Unavailable"}</dd>
        </div>
        {meta.playedAt && (
          <div>
            <dt>Played at</dt>
            <dd>{new Date(meta.playedAt).toLocaleString()}</dd>
          </div>
        )}
      </dl>
      {meta.unknownIds.length > 0 && (
        <p>
          {meta.unknownIds.length} unrecognized ID occurrences. See Raw JSON for
          the contribution template.
        </p>
      )}
      {!!meta.warnings?.length && (
        <details>
          <summary>Replay warnings ({meta.warnings.length})</summary>
          <ul className="replay-warnings">
            {meta.warnings.map(({ message, roundNumber, playerId }, index) => (
              <li key={index}>
                {roundNumber === undefined ? "" : `Round ${roundNumber} · `}
                {playerId === undefined
                  ? ""
                  : `${meta.players.find((player) => player.id === playerId)?.name ?? playerId} · `}
                {message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function ActionLog({ match }: { match: MatchSnapshotV1 }) {
  const patch = useWorkspace((state) => state.patch);
  const catalog = createGameCatalog(patch);
  const selectedRound = useWorkspace((state) => state.selectedRound);
  const selectRound = useWorkspace((state) => state.selectRound);
  const round = match.rounds.find(
    (round) => round.roundNumber === selectedRound,
  );
  return (
    <>
      <h1>Action Log</h1>
      <div className="replay-section">
        {match.rounds.length > 0 && (
          <label className="round-select">
            Round
            <select
              value={selectedRound}
              onChange={(event) =>
                selectRound(Number(event.currentTarget.value))
              }
            >
              {match.rounds.map(({ roundNumber }) => (
                <option key={roundNumber} value={roundNumber}>
                  {roundNumber}
                </option>
              ))}
            </select>
          </label>
        )}
        {!round && <p>No deployment rounds recorded.</p>}
        {round &&
          match.meta.players.map((player) => {
            const state = round.players[player.id];
            return (
              <section className="action-player" key={player.id}>
                <h2>{player.name}</h2>
                {state?.actions.length ? (
                  <ol className="action-list">
                    {state.actions.map((action, index) => (
                      <li key={index}>
                        <span>
                          {action.kind}
                          {action.undone ? " (cancelled)" : ""}
                        </span>
                        <span>
                          {action.ref?.name ??
                            (action.unitId
                              ? catalog.unit(action.unitId).name
                              : "")}
                        </span>
                        <code>
                          {action.sourceType}
                          {action.instanceId === undefined
                            ? ""
                            : ` · #${action.instanceId}`}
                        </code>
                        {action.position && (
                          <code>
                            {action.position.x}, {action.position.y}
                          </code>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>
                    {state
                      ? "No actions recorded."
                      : "Player round is missing."}
                  </p>
                )}
              </section>
            );
          })}
      </div>
    </>
  );
}

function UnknownIdTemplate({ match }: { match: MatchSnapshotV1 }) {
  const [status, setStatus] = useState("");
  const ids = [
    ...new Set(match.meta.unknownIds.map(({ kind, id }) => `- ${kind}: ${id}`)),
  ];
  const template = [
    "## Add replay IDs to the patch catalog",
    "",
    `Replay patch: ${match.meta.gameVersion ?? "Unspecified"}`,
    "Catalog: data/patches/latest.json or the corresponding versioned catalog",
    "",
    ...ids,
    "",
    "Source for the mapping: ",
    "Verified name, cost, and other catalog fields: ",
    "Testing: pnpm test",
  ].join("\n");

  return (
    <section className="replay-section">
      <h2>Unknown ID pull request template</h2>
      <textarea
        aria-label="Pull request template"
        className="json-output"
        readOnly
        value={template}
        rows={8}
      />
      <button
        className="primary-button"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(template);
            setStatus("Template copied.");
          } catch {
            setStatus(
              "Clipboard unavailable. Select and copy the template text.",
            );
          }
        }}
      >
        Copy template
      </button>
      <p role="status">{status}</p>
    </section>
  );
}

export function RawJson({ match }: { match: MatchSnapshotV1 }) {
  const raw = useWorkspace((state) => state.raw);
  const [source, setSource] = useState(false);
  return (
    <>
      <h1>Raw JSON</h1>
      <section className="replay-section">
        <label className="round-select">
          <input
            type="checkbox"
            checked={source}
            onChange={(event) => setSource(event.currentTarget.checked)}
          />{" "}
          Show source records
        </label>
        <textarea
          className="json-output"
          aria-label={source ? "Source records JSON" : "Match snapshot JSON"}
          readOnly
          rows={18}
          spellCheck={false}
          value={JSON.stringify(source ? raw : match, null, 2)}
        />
      </section>
      {match.meta.unknownIds.length > 0 && <UnknownIdTemplate match={match} />}
    </>
  );
}
