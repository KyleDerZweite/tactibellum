import { create } from "zustand";
import type { MatchSnapshotV1 } from "../../core/contracts/match";
import type { PatchData } from "../../core/contracts/patch";
import type { RawReplay } from "../../core/parser";

export type ReplayView = "overview" | "action-log" | "raw-json";

interface Workspace {
  match?: MatchSnapshotV1;
  raw?: RawReplay;
  patch?: PatchData;
  view: ReplayView;
  selectedRound?: number;
  openMatch: (
    match: MatchSnapshotV1,
    raw: RawReplay,
    patch?: PatchData,
  ) => void;
  setView: (view: ReplayView) => void;
  selectRound: (roundNumber: number) => void;
}

export const useWorkspace = create<Workspace>((set) => ({
  view: "overview",
  openMatch: (match, raw, patch) =>
    set({
      match,
      raw,
      patch,
      view: "overview",
      selectedRound: match.rounds[0]?.roundNumber,
    }),
  setView: (view) => set({ view }),
  selectRound: (roundNumber) =>
    set((state) =>
      state.match?.rounds.some((round) => round.roundNumber === roundNumber)
        ? { selectedRound: roundNumber }
        : state,
    ),
}));
