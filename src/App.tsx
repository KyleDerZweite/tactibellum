import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { analyzeMatch } from "./core/analytics";
import type { BoardHighlight } from "./core/contracts/board";
import { scenarioPrefix, type Scenario } from "./core/contracts/scenario";
import { hasStandardBoard } from "./core/geometry";
import { MAX_REPLAY_BYTES, parseRawReplay } from "./core/parser";
import { scenarioFromReplay } from "./core/scenario/fromReplay";
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

const PlannerWorkspace = lazy(() =>
  import("./ui/workspace/PlannerWorkspace").then(({ PlannerWorkspace }) => ({
    default: PlannerWorkspace,
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
  const setView = useWorkspace((state) => state.setView);
  const setWinner = useWorkspace((state) => state.setWinner);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);
  const replayName = match?.meta.fileName;
  const [defaultPatch] = useState(() => patchFor());
  const [scenario, setScenario] = useState<Scenario | undefined>(
    () =>
      defaultPatch && {
        version: 1,
        patchVersion: defaultPatch.version,
        units: [],
      },
  );
  const [plannerNotice, setPlannerNotice] = useState("");
  const [plannerSession, setPlannerSession] = useState(0);
  const [importError, setImportError] = useState("");
  const scenarioPatchVersion = scenario?.patchVersion;
  const scenarioPatch = useMemo(() => {
    if (!scenarioPatchVersion) return undefined;
    if (scenarioPatchVersion === defaultPatch?.version) return defaultPatch;
    const candidate = patchFor(scenarioPatchVersion);
    return candidate?.version === scenarioPatchVersion ? candidate : undefined;
  }, [defaultPatch, scenarioPatchVersion]);

  useEffect(() => {
    let active = true;
    async function receiveBoard() {
      const fragment = location.hash;
      if (!fragment.startsWith(scenarioPrefix)) return;
      try {
        const { decodeScenario } = await import("./core/scenario/share");
        if (!active || location.hash !== fragment) return;
        setScenario(decodeScenario(fragment));
        setPlannerNotice("");
        setPlannerSession((session) => session + 1);
      } catch (error) {
        if (!active || location.hash !== fragment) return;
        setPlannerNotice(
          error instanceof Error ? error.message : "Could not open board link.",
        );
      }
      setView("planner");
    }
    void receiveBoard();
    window.addEventListener("hashchange", receiveBoard);
    return () => {
      active = false;
      window.removeEventListener("hashchange", receiveBoard);
    };
  }, [setView]);
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

  function editReplayRound() {
    if (!match || !patch || selectedRound === undefined) return;
    try {
      const imported = scenarioFromReplay(match, selectedRound, patch.version);
      const skipped = imported.skipped
        ? ` ${imported.skipped} units with unsupported records were skipped.`
        : "";
      setScenario(imported.scenario);
      setPlannerNotice(
        `Copied round ${selectedRound} into an editable board using catalog ${patch.version}.${skipped}`,
      );
      setPlannerSession((session) => session + 1);
      setImportError("");
      setView("planner");
      document.getElementById("main")?.focus();
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Could not copy this round.",
      );
    }
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
      {view === "planner" ? (
        scenario && scenarioPatch ? (
          <Suspense fallback={<p role="status">Loading the analysis board…</p>}>
            <PlannerWorkspace
              key={plannerSession}
              scenario={scenario}
              patch={scenarioPatch}
              onChange={setScenario}
              notice={plannerNotice}
            />
          </Suspense>
        ) : (
          <section className="replay-section">
            <h1>Analysis Board</h1>
            <p role="alert">
              {scenario
                ? `Patch ${scenario.patchVersion} is unavailable.`
                : "No patch catalog is available."}
            </p>
            {defaultPatch && (
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setScenario({
                    version: 1,
                    patchVersion: defaultPatch.version,
                    units: [],
                  });
                  setPlannerNotice("");
                  setPlannerSession((session) => session + 1);
                }}
              >
                Start a board on the bundled patch
              </button>
            )}
          </section>
        )
      ) : view === "board" && match ? (
        <>
          <TacticalBoard highlight={boardHighlight} />
          {patch && selectedRound !== undefined && hasStandardBoard(match) && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="primary-button"
                onClick={editReplayRound}
              >
                Edit this round in Analysis Board
              </button>
              {importError && <p role="alert">{importError}</p>}
            </div>
          )}
        </>
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
              <h1>Mechabellum analysis board</h1>
              <p>
                Arrange mechs, compare arrival times and damage breakpoints, or
                open a local replay to review a round.
              </p>
              <button
                type="button"
                className="primary-button justify-self-start"
                onClick={() => {
                  setView("planner");
                  document.getElementById("main")?.focus();
                }}
              >
                Open Analysis Board
              </button>
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
