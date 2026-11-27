import type { MatchSnapshotV1 } from "../../core/contracts/match";

export interface WinnerControlProps {
  meta: Pick<MatchSnapshotV1["meta"], "players" | "winnerPlayerId">;
  onWinnerChange: (playerId: string | null) => void;
}

export function WinnerControl({ meta, onWinnerChange }: WinnerControlProps) {
  return (
    <label className="grid min-w-0 gap-2 text-sm">
      Winner
      <select
        className="min-h-10 min-w-0 rounded-md border border-line bg-raised px-3 text-text"
        value={meta.winnerPlayerId ?? ""}
        onChange={(event) => onWinnerChange(event.currentTarget.value || null)}
      >
        <option value="">Undecided</option>
        {meta.players.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
      </select>
    </label>
  );
}
