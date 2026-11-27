import { useRef, useState } from "react";

interface ReplayUploadProps {
  replayName?: string;
  onReplaySelected: (file: File) => void;
}

export function ReplayUpload({
  replayName,
  onReplaySelected,
}: ReplayUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  function selectReplay(files: FileList) {
    if (files.length === 0) return;
    const file = files[0];
    if (files.length !== 1 || !file.name.toLowerCase().endsWith(".grbr")) {
      setError("Choose one .grbr replay file.");
      return;
    }
    setError("");
    onReplaySelected(file);
  }

  return (
    <section aria-label="Replay file" className="upload-panel">
      <div
        className="drop-area"
        data-dragging={dragging}
        onDragEnter={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files"))
            event.preventDefault();
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          selectReplay(event.dataTransfer.files);
        }}
      >
        <h2>
          Drop a <code>.grbr</code> file here
        </h2>
        <input
          ref={input}
          type="file"
          accept=".grbr"
          aria-label="Replay file"
          hidden
          onChange={(event) => {
            if (event.currentTarget.files)
              selectReplay(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
        <button
          className="primary-button"
          type="button"
          onClick={() => input.current?.click()}
        >
          {replayName ? "Change replay" : "Choose replay"}
        </button>
        <div className="upload-feedback">
          <p role="status">
            {replayName
              ? `${replayName} selected. Replay analysis is coming soon.`
              : ""}
          </p>
          <p role="alert">{error}</p>
        </div>
      </div>
      <footer className="upload-footer">
        <p>Replay files stay in your browser.</p>
        <button type="button" disabled>
          Demo coming soon
        </button>
      </footer>
    </section>
  );
}
