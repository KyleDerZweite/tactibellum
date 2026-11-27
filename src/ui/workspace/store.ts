import { create } from "zustand";
import type { BoardHighlight } from "../../core/contracts/board";
import type { MatchSnapshotV1 } from "../../core/contracts/match";
import type { PatchData } from "../../core/contracts/patch";
import type { RawReplay } from "../../core/parser";

export type ReplayView =
  "overview" | "board" | "charts" | "findings" | "action-log" | "raw-json";

interface Workspace {
  match?: MatchSnapshotV1;
  raw?: RawReplay;
  patch?: PatchData;
  view: ReplayView;
  selectedRound?: number;
  boardHighlight?: BoardHighlight;
  openMatch: (
    match: MatchSnapshotV1,
    raw: RawReplay,
    patch?: PatchData,
    view?: ReplayView,
  ) => void;
  setView: (view: ReplayView) => void;
  selectRound: (roundNumber: number) => void;
  showBoardRound: (roundNumber: number, highlight?: BoardHighlight) => void;
  setWinner: (playerId: string | null) => void;
}

export const useWorkspace = create<Workspace>((set) => ({
  view: "overview",
  openMatch: (match, raw, patch, view = "overview") =>
    set({
      match,
      raw,
      patch,
      view,
      selectedRound: match.rounds[0]?.roundNumber,
      boardHighlight: undefined,
    }),
  setView: (view) => set({ view }),
  selectRound: (roundNumber) =>
    set((state) =>
      state.match?.rounds.some((round) => round.roundNumber === roundNumber)
        ? {
            selectedRound: roundNumber,
            boardHighlight:
              state.selectedRound === roundNumber
                ? state.boardHighlight
                : undefined,
          }
        : state,
    ),
  showBoardRound: (roundNumber, highlight) =>
    set((state) =>
      state.match?.rounds.some((round) => round.roundNumber === roundNumber)
        ? {
            view: "board",
            selectedRound: roundNumber,
            boardHighlight: highlight,
          }
        : state,
    ),
  setWinner: (playerId) =>
    set((state) =>
      state.match &&
      (playerId === null ||
        state.match.meta.players.some(({ id }) => id === playerId))
        ? {
            match: {
              ...state.match,
              meta: { ...state.match.meta, winnerPlayerId: playerId },
            },
          }
        : state,
    ),
}));
