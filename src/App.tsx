import { useRef, useState } from "react";
import { MAX_REPLAY_BYTES, parseRawReplay } from "./core/parser";
import { reconstructMatch } from "./core/state";
import { Layout } from "./ui/layout/Layout";
import { ReplayUpload } from "./ui/upload/ReplayUpload";
import { ActionLog, MatchOverview, RawJson } from "./ui/workspace/ReplayViews";
import { patchFor } from "./ui/workspace/patches";
import { useWorkspace } from "./ui/workspace/store";

export function App() {
  const match = useWorkspace((state) => state.match);
  const view = useWorkspace((state) => state.view);
  const openMatch = useWorkspace((state) => state.openMatch);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);
  const replayName = match?.meta.fileName;

  async function load(
    fileName: string,
    read: () => Promise<string | Uint8Array>,
  ) {
    const request = ++latestRequest.current;
    setLoading(true);
    setError("");
    try {
      const input = await read();
      if (request !== latestRequest.current) return;
      const raw = parseRawReplay(input, fileName);
      const patch = patchFor(raw.version);
      openMatch(reconstructMatch(raw, patch), raw, patch);
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
      {view === "action-log" && match ? (
        <ActionLog match={match} />
      ) : view === "raw-json" && match ? (
        <RawJson match={match} />
      ) : (
        <>
          <h1>{match ? "Overview" : "Open a replay"}</h1>
          {match ? (
            <MatchOverview match={match} />
          ) : (
            <p className="intro">
              Choose a replay saved by Mechabellum to open it in your browser.
            </p>
          )}
          <ReplayUpload
            replayName={replayName}
            loading={loading}
            loadError={error}
            onDemoSelected={() =>
              void load("flank-pressure.grbr", async () => {
                const demo =
                  await import("../fixtures/replays/flank-pressure.grbr?raw");
                return demo.default;
              })
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
