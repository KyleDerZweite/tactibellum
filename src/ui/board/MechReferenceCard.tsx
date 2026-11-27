import { useId, useRef, useState } from "react";
import { MechGlyph } from "./MechGlyph";
import { mechReference } from "./mechReference";
import type { DisplayUnit } from "./boardUnits";

export function MechReferenceCard({ data }: { data: DisplayUnit }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [wikiOpen, setWikiOpen] = useState(false);
  const { unit, entry } = data;
  const reference = entry.isUnknown ? undefined : mechReference(unit.unitId);

  return (
    <>
      <div className="mech-reference-card">
        <span
          className="mech-emblem"
          data-player={data.index}
          aria-hidden="true"
        >
          <svg
            viewBox="-11 -11 22 22"
            width="21"
            height="21"
            aria-hidden="true"
          >
            <MechGlyph data={data} />
          </svg>
          {reference?.code ?? "?"}
        </span>
        <div>
          <h3>{entry.name}</h3>
          {!entry.isUnknown && (
            <p>
              {entry.isAir ? "Air mech" : "Ground mech"} ·{" "}
              <span className="numeric">{entry.cost}</span> supply
            </p>
          )}
        </div>
      </div>
      {reference && (
        <>
          <button
            className="wiki-button"
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              dialog.current?.showModal();
              setWikiOpen(true);
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d="M12 6c-3-2-6-3-9-2v14c3-1 6 0 9 2 3-2 6-3 9-2V4c-3-1-6 0-9 2v14" />
            </svg>
            Read Wiki
          </button>
          <dialog
            ref={dialog}
            className="mech-wiki-dialog"
            aria-labelledby={titleId}
            onClose={() => setWikiOpen(false)}
          >
            <header>
              <h2 id={titleId}>{entry.name} on the Wiki</h2>
              <div className="mech-wiki-actions">
                <a href={reference.url} target="_blank" rel="noreferrer">
                  Open original ↗
                </a>
                <button
                  type="button"
                  className="wiki-button"
                  onClick={() => dialog.current?.close()}
                >
                  Close
                </button>
              </div>
            </header>
            {wikiOpen && (
              <iframe
                src={reference.url}
                title={`${entry.name} Wiki article`}
                sandbox="allow-same-origin"
                referrerPolicy="no-referrer"
              />
            )}
          </dialog>
        </>
      )}
    </>
  );
}
