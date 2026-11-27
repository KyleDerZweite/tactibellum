import { useState } from "react";
import { Layout } from "./ui/layout/Layout";
import { ReplayUpload } from "./ui/upload/ReplayUpload";

export function App() {
  const [replay, setReplay] = useState<File>();

  return (
    <Layout replayName={replay?.name}>
      <h1>Open a replay</h1>
      <p className="intro">
        Choose a replay saved by Mechabellum to open it in your browser.
      </p>
      <ReplayUpload replayName={replay?.name} onReplaySelected={setReplay} />
    </Layout>
  );
}
