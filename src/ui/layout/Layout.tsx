import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useWorkspace } from "../workspace/store";
import type { ReplayView } from "../workspace/store";

const views: [ReplayView, string][] = [
  ["overview", "Overview"],
  ["planner", "Analysis Board"],
  ["board", "Tactical Board"],
  ["charts", "Economy & Graphs"],
  ["findings", "Rule Findings"],
  ["action-log", "Action Log"],
  ["raw-json", "Raw JSON"],
];

interface LayoutProps {
  children: ReactNode;
  replayName?: string;
  patch?: string;
}

export function Layout({ children, replayName, patch }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const view = useWorkspace((state) => state.view);
  const setView = useWorkspace((state) => state.setView);
  const menuButton = useRef<HTMLButtonElement>(null);

  return (
    <div
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          sidebarOpen &&
          menuButton.current?.getClientRects().length
        ) {
          setSidebarOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar" data-view={view}>
        <button
          className="menu-button"
          type="button"
          ref={menuButton}
          aria-expanded={sidebarOpen}
          aria-controls="workspace-sidebar"
          onClick={() => setSidebarOpen((open) => !open)}
        >
          Menu
        </button>
        <button
          className="desktop-menu-button"
          type="button"
          aria-expanded={!desktopCollapsed}
          aria-controls="workspace-sidebar"
          onClick={() => setDesktopCollapsed((collapsed) => !collapsed)}
        >
          Menu
        </button>
        <a className="brand" href={import.meta.env.BASE_URL}>
          Tactibellum
        </a>
        <span className="replay-name" title={replayName}>
          {replayName ?? "No replay selected"}
          {patch && ` · Patch ${patch}`}
        </span>
        {view !== "overview" && replayName && (
          <a
            className="board-change-replay"
            href="#replay-upload"
            onClick={() => setView("overview")}
          >
            Change replay
          </a>
        )}
        <a
          className="source-link"
          href="https://github.com/KyleDerZweite/tactibellum"
        >
          GitHub
        </a>
      </header>

      <div className="workspace" data-sidebar-collapsed={desktopCollapsed}>
        <aside
          className="sidebar"
          id="workspace-sidebar"
          data-open={sidebarOpen}
        >
          <nav aria-label="Replay views">
            <ul className="view-list">
              {views.map(([id, label]) => {
                const enabled =
                  id === "overview" || id === "planner" || Boolean(replayName);
                return (
                  <li
                    key={id}
                    className={enabled ? undefined : "unavailable-view"}
                  >
                    {enabled ? (
                      <a
                        href="#main"
                        aria-current={view === id ? "page" : undefined}
                        onClick={(event) => {
                          event.preventDefault();
                          setView(id);
                          setSidebarOpen(false);
                          document.getElementById("main")?.focus();
                        }}
                      >
                        {label}
                      </a>
                    ) : (
                      label
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="resource-links">
            <a href="https://wiki.mbxmas.com/">Mechabellum Wiki</a>
            <a href="https://mechabellum-companion.netlify.app/">
              Mechabellum Companion
            </a>
          </div>
        </aside>

        <main id="main" tabIndex={-1} className="main-content" data-view={view}>
          {children}
        </main>
      </div>
    </div>
  );
}
