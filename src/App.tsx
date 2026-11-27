import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { analyzeMatch } from "./core/analytics";
import type { BoardHighlight } from "./core/contracts/board";
import { MAX_REPLAY_BYTES, parseRawReplay } from "./core/parser";
import { reconstructMatch } from "./core/state";
import { TacticalBoard } from "./ui/board/TacticalBoard";
import { RuleFindings } from "./ui/findings/RuleFindings";
import { Layout } from "./ui/layout/Layout";
import { ReplayUpload } from "./ui/upload/ReplayUpload";
import { ActionLog, MatchOverview, RawJson } from "./ui/workspace/ReplayViews";
import { WinnerControl } from "./ui/workspace/WinnerControl";
import { patchFor } from "./ui/workspace/patches";
import { useWorkspace, type ReplayView } from "./ui/workspace/store";

const AnalysisCharts = lazy(() =>
  import("./ui/charts/AnalysisCharts").then(({ AnalysisCharts }) => ({
    default: AnalysisCharts,
  })),
);

export function App() {
  const match = useWorkspace((state) => state.match);
  const patch = useWorkspace((state) => state.patch);
  const view = useWorkspace((state) => state.view);
  const selectedRound = useWorkspace((state) => state.selectedRound);
  const boardHighlight = useWorkspace((state) => state.boardHighlight);
  const openMatch = useWorkspace((state) => state.openMatch);
  const showBoardRound = useWorkspace((state) => state.showBoardRound);
  const setWinner = useWorkspace((state) => state.setWinner);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);
  const replayName = match?.meta.fileName;
  const analysisView = view === "charts" || view === "findings";
  const report = useMemo(
    () =>
      analysisView && match && patch ? analyzeMatch(match, patch) : undefined,
    [analysisView, match, patch],
  );

  function goToRound(roundNumber: number, highlight?: BoardHighlight) {
    showBoardRound(roundNumber, highlight);
    document.getElementById("main")?.focus();
  }

  async function load(
    fileName: string,
    read: () => Promise<string | Uint8Array>,
    destination?: ReplayView,
  ) {
    const request = ++latestRequest.current;
    setLoading(true);
    setError("");
    try {
      const input = await read();
      if (request !== latestRequest.current) return;
      const raw = parseRawReplay(input, fileName);
      const patch = patchFor(raw.version);
      openMatch(reconstructMatch(raw, patch), raw, patch, destination);
    } catch (cause) {
      if (request === latestRequest.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The replay could not be opened.",
        );
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }

  return (
    <Layout replayName={replayName} patch={match?.meta.gameVersion}>
      {view === "board" && match ? (
        <TacticalBoard highlight={boardHighlight} />
      ) : view === "action-log" && match ? (
        <ActionLog match={match} />
      ) : view === "raw-json" && match ? (
        <RawJson match={match} />
      ) : view === "charts" && match && report ? (
        <Suspense fallback={<p role="status">Loading graphs…</p>}>
          <AnalysisCharts
            match={match}
            report={report}
            selectedRound={selectedRound}
            onGoToRound={goToRound}
          />
        </Suspense>
      ) : view === "findings" && match && report ? (
        <RuleFindings
          match={match}
          report={report}
          selectedRound={selectedRound}
          onGoToFinding={({ roundNumber, highlight }) =>
            goToRound(roundNumber, highlight)
          }
        />
      ) : (
        <>
          {match ? (
            <>
              <h1>Overview</h1>
              <MatchOverview match={match} />
              <div className="replay-section">
                <WinnerControl meta={match.meta} onWinnerChange={setWinner} />
              </div>
            </>
          ) : (
            <header className="replay-hero">
              <h1>Open a replay</h1>
              <p>
                Review Mechabellum rounds, army composition, and deployment
                decisions.
              </p>
            </header>
          )}
          <ReplayUpload
            replayName={replayName}
            loading={loading}
            loadError={error}
            onDemoSelected={() =>
              void load(
                "flank-pressure.grbr",
                async () => {
                  const demo =
                    await import("../fixtures/replays/flank-pressure.grbr?raw");
                  return demo.default;
                },
                "board",
              )
            }
            onReplaySelected={(file) =>
              void load(file.name, async () => {
                if (file.size > MAX_REPLAY_BYTES)
                  throw new Error("The replay exceeds the 8 MiB limit.");
                return new Uint8Array(await file.arrayBuffer());
              })
            }
          />
        </>
      )}
    </Layout>
  );
}
