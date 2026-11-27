# PROJECT_SPEC: Tactibellum

> **Status:** Draft v1.0 (MVP Handoff Specification)  
> **Lizenz:** MIT  
> **Architekturtyp:** 100 % Client-Side Static Web Application (Local-First, Zero Backend)  
> **Zielplattform:** GitHub Pages (primär) + Self-Hostable Docker Static Container  

---

## 1. Produktvision & Scope

**Tactibellum** ist ein kostenloses, quelloffenes, rein statisches Replay-Analyse- und 2D-Taktikboard-Tool für **Mechabellum**. Spieler ziehen eine lokale `.grbr`-Replay-Datei per Drag & Drop in den Browser und erhalten sofort:
1. Eine interaktive, rundenbasierte **2D-Board-Ansicht** aller Spieler-Boards (Positionen, Footprints, Reichweiten, Techs, Upgrades, Spells, Devices).
2. **Statistische Verlaufskurven** (Army Value, Supply-Effizienz, Rollenverteilung, Tech-Investitionen, Lane-Balance).
3. **Deterministische, regelbasierte Taktik-Hinweise** (ohne KI) auf Basis versionierter Patch-Daten.
4. Einen **strukturierten Export** (JSON & Markdown), der später nahtlos an externe KI-Coaches oder Community-Tools übergeben werden kann.

### Strikt im Scope (MVP – Typ 1: Statische Analyse)
- Vollständiges Client-Side-Parsing von Mechabellum `.grbr`-Dateien (XML-basiertes Aktionslog).
- Rekonstruktion des exakten Deployment-Zustands pro Runde (`MatchSnapshot v1`) für 1v1 (und perspektivisch 2v2/FFA-Erkennung).
- Interaktives 2D-Taktikboard mit Runden-Navigation, Diff-Hervorhebung, Hover-Inspektor und Reichweiten-Overlays.
- Regelbasierte Analyse-Engine (Economy, Composition, Spatial Heuristics, Counter-Tag-Checks).
- Optionaler Import lokaler Match-Ergebnisdaten oder manueller Winner-Toggle (da `.grbr` selbst kein Kampfergebnis speichert).
- Mitgelieferte Sample-Replays für einen sofortigen Demo-Modus ohne eigene Datei.

### Strikt NICHT im Scope (Non-Goals für v1.0)
- **Kein** Live-Recording, kein Windows-Memory-Reading, kein In-Game-Overlay, kein Anti-Cheat-Risiko.
- **Keine** Kampf-Physik-Simulation (kein Frame-by-Frame-Combat-Playback, kein Projektil-/Target-Lock-Sim).
- **Keine** native LLM-/KI-API-Integration im MVP (nur saubere Daten-Exports und vorbereitete Schnittstellen).
- **Kein** Backend, keine User-Accounts, kein Tracking, keine Werbung, kein Upload von Nutzerdateien auf fremde Server.

---

## 2. Design-Sprache & UX („Mechabellum Wiki Aesthetic“)

Die gesamte UI orientiert sich visuell und strukturell direkt am **Mechabellum Wiki** (`https://wiki.mbxmas.com/` – Astro-Starlight-inspirierte, dunkle, hochlesbare Taktik-Dokumentations-Ästhetik, mobilfähig, werbefrei).

### Design-Prinzipien
- **Referenz-Check in Phase 0:** Der Agent prüft die visuelle Sprache von `https://wiki.mbxmas.com/` (Farbhierarchie, Surface-Kontraste, Typografie, Sidebar-Navigation, Tabellen-/Card-Dichte) und leitet daraus ein konsistentes CSS-Token-System ab.
- **Dark-First Tactical UI:** Tiefe Anthrazit-/Slate-Oberflächen (`#0f1218` / `#161b22` / `#1e2530`), feine 1px-Haarlinien-Rahmen (`rgba(255,255,255,0.08)`), klarer Textkontrast, keine überladenen Neon-Glow-Effekte.
- **Farbcodierung:**
  - Spieler 1 (Unten / Perspektiv-Spieler): Taktisches Cyan/Blau.
  - Spieler 2 (Oben / Gegner): Taktisches Amber/Orange-Rot.
  - Diff-Status: Smaragdgrün (Neu platziert), Violett (Tech/Upgrade), Grau/Gestrichelt (Verkauft/Bewegt).
  - Rule Findings: Info (Cyan), Hinweis (Amber), Kritische Lücke (Rot).
- **Typografie:** Klare geometrische Sans-Serif für UI/Text (`Inter` / System-UI) + zwingend **Monospace mit `tabular-nums`** (`JetBrains Mono` / System-Mono) für alle Zahlen, Koordinaten, Kosten, Runden und Tabellen.
- **Layout-Architektur (Desktop & Mobile):**
  - Top-Header: Logo (`Tactibellum`), geladener Match-Titel / Patch-Version, Datei-Wechsler, Export-Button, GitHub-Link.
  - Linke Sidebar (einklappbar, Wiki-Stil): Navigation zwischen Ansichten (`Overview`, `2D Tactical Board`, `Economy & Graphs`, `Rule Findings`, `Action Log`, `Raw JSON`).
  - Hauptbereich: Maximale Fläche für das 2D-Board bzw. Analyse-Karten; rechte Detail-Leiste (Inspector) für ausgewählte Einheiten/Runden.
- **Assets & Urheberrecht:** Keine gerippten Original-Grafiken aus Mechabellum. Alle Einheiten erhalten saubere, klar unterscheidbare SVG-Vektor-Tokens (z. B. kategorisiert nach Chaff, Ground, Air, Giant, Support + Kürzel/Level-Badge).

---

## 3. Tech-Stack & Architektur

### Gewählter Stack (optimiert für GitHub Pages, AI-Agents & OSS-Beiträge)
- **Framework:** React 19 + TypeScript (strict mode) + Vite
- **Styling:** Tailwind CSS v4 + CSS Design Tokens (`src/styles/tokens.css`)
- **2D-Board-Rendering:** HTML5 SVG oder Konva/Canvas (Empfehlung: **Zoom-/Pan-fähiges SVG** für gestochen scharfe Vektor-Tokens, direkte DOM-Hover/Click-Accessibility und CSS-Styling; bei Performance-Bedarf sauber hinter einer `BoardRenderer`-Schnittstelle austauschbar)
- **Charts:** Recharts oder Apache ECharts (tree-shaken, dark-themed)
- **XML-Parsing:** `fast-xml-parser` (reines TypeScript, 100 % browser-kompatibel)
- **Schema-Validierung:** `zod` (strikt typisierte Datenverträge an Modul-Grenzen)
- **State Management:** Zustand (leichtgewichtig, serialisierbar)
- **Testing & Qualität:** Vitest (Unit & Golden-Fixture-Tests), ESLint, Prettier, TypeScript `tsc --noEmit`
- **Package Manager:** `pnpm`

### Modulare Verzeichnisstruktur (Agent-Friendly)
Die Codebasis trennt strikt zwischen **Domain-Core** (framework-frei, rein TypeScript, 100 % unit-testbar) und **Web-UI**:

```text
tactibellum/
├── AGENTS.md                     # Kurze Einstiegsregeln & Commands für Coding-Agents
├── PROJECT_SPEC.md               # Diese Spezifikation
├── LICENSE                       # MIT License
├── README.md                     # Projektübersicht, Screenshots, Self-Hosting, Contributing
├── Dockerfile                    # Optionaler Static-Build (Nginx/Caddy) für Self-Hosting
├── .github/
│   └── workflows/
│       ├── ci.yml                # typecheck, lint, test, build auf jedem PR
│       └── deploy-pages.yml      # Automatischer Build & Deploy auf GitHub Pages
├── data/
│   └── patches/
│       ├── schema.json           # JSON-Schema für Patch-Datensätze
│       └── latest.json           # Units, Techs, Spells, Specialists, Items, Rollen-Tags
├── fixtures/
│   └── replays/                  # Kleine, anonymisierte Sample-.grbr-Dateien für Tests & Demo
└── src/
    ├── core/                     # 100% UI-frei, portabel (auch für zukünftige CLI/Workers nutzbar)
    │   ├── contracts/            # Zod-Schemas & TS-Typen (MatchSnapshot v1, AnalysisReport v1)
    │   ├── parser/               # .grbr XML -> RawReplay -> Normalisierte Events
    │   ├── state/                # Event-Reducer -> Rundenweise Board-Snapshots & Round-Diffs
    │   ├── game-data/            # Patch-Loader, ID-Lookup, Graceful-Fallback für unbekannte IDs
    │   ├── analytics/            # Deterministische Metriken & regelbasierte Taktik-Heuristiken
    │   │   ├── metrics/          # Economy, Composition, Spatial, Tempo
    │   │   └── rules/            # Modulare Regel-Plugins (z. B. NoAntiAirRule, FloatingSupplyRule)
    │   └── export/               # JSON- & KI-freundlicher Markdown-Report-Generator
    ├── extensions/               # Reservierte, schlanke Interfaces für spätere Phasen
    │   ├── ai-coach.interface.ts # Interface für späteres BYOK-LLM-Coaching
    │   └── telemetry.interface.ts# Interface für optionale externe Combat-Logs/Ergebnisse
    ├── ui/
    │   ├── layout/               # Wiki-Style Shell (Header, Sidebar, Inspector)
    │   ├── board/                # 2D-Taktikboard, Grid, Unit-Tokens, Range-Overlay, Timeline
    │   ├── charts/               # Economy-, Army-Value- & Composition-Diagramme
    │   ├── findings/             # Filterbare Rule-Findings & Round-Breakdown
    │   └── upload/               # Drag & Drop, Sample-Loader, Datenschutz-Hinweis
    └── styles/
        └── tokens.css            # Design-Tokens angelehnt an wiki.mbxmas.com

```

---

## 4. Datenverträge & Parser-Design

### 4.1 `.grbr`-Parser-Grundlagen & Referenzen

Da sich `.grbr`-XML-Tags und numerische Tech-/Unit-IDs über Mechabellum-Patches hinweg ändern können, gelten folgende Architekturregeln:

1. **Referenz-Analyse in Phase 1:** Zur Verifikation der XML-Struktur und ID-Mapping-Logik sind bestehende Open-Source-Referenzen heranzuziehen:
* `ShotgunCrocodile/mechabellum_replay_parser` (MIT-Lizenz, dokumentiert Aktions- & Tech-Lookup-Tabellen)
* `FogMoe/Mechabellum-Replays` (öffentlicher Community-Replay-Korpus für Parser-Tests – Lizenzbedingungen für Datensätze beachten, keine fremden Non-Commercial-Codezeilen kopieren!)


2. **Kein Crash bei unbekannten IDs (Graceful Degradation):** Taucht nach einem neuen Patch eine unbekannte Unit-, Tech-, Spell- oder Specialist-ID auf, darf der Parser niemals abbrechen. Stattdessen wird ein typisiertes Fallback-Objekt erzeugt (`Unknown Unit #4021`, `isUnknown: true`), in der UI dezent markiert und eine Copy-Button-Vorlage für einen GitHub-PR zur Ergänzung von `data/patches/latest.json` angeboten.
3. **Zweistufige Pipeline:**
`XML String` -> `parseRawReplay()` (verlustfreie Normalisierung der XML-Struktur) -> `reconstructMatch()` (deterministischer Zustandsautomat pro Runde -> `MatchSnapshot v1`).

### 4.2 Kern-Datenvertrag: `MatchSnapshot v1`

```ts
export interface MatchSnapshotV1 {
  schemaVersion: "1.0.0";
  meta: {
    fileName: string;
    gameVersion?: string;
    playedAt?: string;
    mode: "1v1" | "2v2" | "ffa" | "unknown";
    players: PlayerMeta[];
    winnerPlayerId?: string | null; // Optional via Log-Import oder manueller Auswahl
    unknownIds: UnknownIdOccurrence[];
  };
  rounds: RoundSnapshot[];
}

export interface RoundSnapshot {
  roundNumber: number;
  players: Record<string, PlayerRoundState>;
}

export interface PlayerRoundState {
  playerId: string;
  specialistId?: string;
  supplySpentThisRound: number;
  estimatedArmyValue: number;
  deploymentsUsed: number;
  unlockedUnits: string[];
  activeSpells: ActionRef[];
  towerUpgrades: ActionRef[];
  units: BoardUnit[];       // Exakter Board-Zustand zu Beginn der Kampfphase
  actions: RoundAction[];   // Geordnete Aktionen dieser Runde (Buy, Move, Sell, Upgrade, Tech, Item, Device)
}

export interface BoardUnit {
  instanceId: string;
  unitId: string;
  level: number;
  x: number;
  y: number;
  orientation?: number;
  techIds: string[];
  itemId?: string | null;
  statusThisRound: "existing" | "new" | "moved" | "upgraded" | "teched";
}

```

### 4.3 Patch-Datenbank (`data/patches/latest.json`)

Jede Einheit im Patch-Datensatz trägt maschinenlesbare taktische Tags, damit die statische Analyse-Engine ohne hartcodierte Einheiten-Namen funktioniert:

* `id`, `name`, `cost`, `unlockCost`, `tier` (`100` | `200` | `300` | `400` | `800`)
* `footprint`: `{ width, height }` (für maßstabsgetreue Darstellung auf dem 2D-Grid)
* `range`, `speed`, `isAir`, `canTargetAir`, `canTargetGround`
* `roles`: z. B. `["chaff"]`, `["chaff-clear"]`, `["single-target"]`, `["anti-air"]`, `["giant"]`, `["siege"]`
* `techs`: Map aus `techId -> { name, cost, statModifiers, addedRoles }`

---

## 5. Roadmap, Phasen & Meilensteine

Der Agent arbeitet diese Phasen sequenziell ab. Jede Phase bildet einen eigenständig lauffähigen, getesteten Slice.

### Phase 0: Repository-Bootstrap, CI/CD & Wiki-Design-System

**Ziel:** Produktionsreifes Projektgerüst mit automatischem Build, Tests, GitHub-Pages-Pipeline und konsistenter UI-Shell im Stil von `wiki.mbxmas.com`.

**Tasks:**

* Initialisiere Vite + React + TypeScript (strict) + Tailwind CSS v4 + Vitest + ESLint + Prettier (`pnpm`).
* Erstelle `AGENTS.md` mit klaren Projektregeln, Architektur-Grenzen und Verifikationsbefehlen (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`).
* Erstelle `LICENSE` (MIT), `README.md` (mit Fan-Project-Disclaimer) und `Dockerfile` (Multi-Stage Build -> Nginx Static).
* Richte `.github/workflows/ci.yml` und `.github/workflows/deploy-pages.yml` ein.
* Baue `src/styles/tokens.css` und die Wiki-Layout-Shell (Topbar, einklappbare Sidebar, Content-Container, Dark-Theme-Typografie mit Monospace-Zahlen).
* Implementiere die Landing-/Upload-Ansicht (Drag & Drop für `.grbr`, Hinweis „100 % lokal im Browser“, Demo-Button-Platzhalter).

**Meilenstein M0 (Definition of Done):**

* `pnpm typecheck && pnpm lint && pnpm test && pnpm build` läuft grün.
* App rendert fehlerfrei lokal (Desktop & Mobile) im Wiki-Look.
* GitHub-Pages-Workflow erzeugt ein valides `dist/`-Artefakt mit korrektem `base`-Pfad.

---

### Phase 1: `.grbr`-Parser-Core & State-Reconstruction Engine

**Ziel:** Deterministisches, 100 % getestetes Parsen realer `.grbr`-Dateien in das `MatchSnapshot v1`-Format.

**Tasks:**

* Analysiere reale `.grbr`-XML-Strukturen und lege 2–3 anonymisierte Referenz-Replays unter `fixtures/replays/` ab.
* Definiere alle Zod-Schemas in `src/core/contracts/`.
* Implementiere `data/patches/latest.json` (vollständiger Einheiten-Katalog inkl. Kosten, Reichweiten, Footprints, Rollen-Tags und gängigen Tech-IDs) sowie `src/core/game-data/` mit Graceful Fallback für unbekannte IDs.
* Implementiere `src/core/parser/` (XML-Parsing, Normalisierung von Spielern, Spezialisten, Runden-Aktionen, Koordinaten, Upgrades, Techs, Spells, Items, Devices).
* Implementiere `src/core/state/` (Event-Reducer, der Runde für Runde den Board-Zustand, Unit-Lifecycle `buy -> move -> upgrade -> sell` und Round-Diffs rekonstruiert).
* Schreibe umfassende Vitest-Golden-Tests gegen die Fixture-Replays + Negativtests (defekte XML, unbekannte Tech-IDs, leere Runden).

**Meilenstein M1 (Definition of Done):**

* Reale `.grbr`-Replays lassen sich im Browser droppen und werden in < 100 ms fehlerfrei in `MatchSnapshot v1` überführt.
* 100 % der Parser- und Reducer-Tests sind grün; unbekannte IDs führen zu sauberen Warnungen statt Abstürzen.
* Erste `Action Log`- und `Raw JSON`-Ansicht in der UI zeigt geparste Runden-Daten verifizierbar an.

---

### Phase 2: Interaktiver 2D-Taktik-Board-Viewer

**Ziel:** Herzstück der Anwendung – eine präzise, blitzschnelle, schachbrettartige 2D-Visualisierung jeder Runde.

**Tasks:**

* Kalibriere das Mechabellum-Koordinatensystem auf das 2D-Spielfeld (Symmetrie-Achse, eigene Hälfte, Gegner-Hälfte, linke/rechte Flankenzonen, Positionen der 4 Türme).
* Implementiere das interaktive 2D-Board (`src/ui/board/`):
* Zoom & Pan + „Reset View“-Button + Perspektiv-Flip („Flip Board“).
* Maßstabsgetreue Unit-Footprints mit eigenen SVG-Kategorie-Icons, Level-Badges, Tech-Indikatoren und Item-Markern.
* **Runden-Scrubber / Timeline-Controls:** Vor/Zurück (inkl. Pfeiltasten `←`/`→`), direkter Sprung zu jeder Runde.
* **Diff-Modus (Toggle):** Hebt farblich hervor, welche Einheiten in *dieser* Runde neu platziert, verschoben, geupgradet oder getecht wurden.
* **Taktische Overlays (Toggles):**
* Reichweiten-Kreise (`Range Circles`) für ausgewählte Einheiten oder alle Einheiten einer Rolle (z. B. Anti-Air-Abdeckung).
* Flank-Zonen & Tower-Schutzradien.
* Rollen-Filter (z. B. nur Chaff / nur Air / nur Anti-Air hervorheben).




* Implementiere den rechten **Unit- & Round-Inspector:** Klick auf eine Einheit zeigt Level, Kostenwert, aktive Techs, Item, Koordinaten, Reichweite und Rollen-Tags.

**Meilenstein M2 (Definition of Done):**

* Ein vollständiges 8–10-Runden-Match lässt sich flüssig per Tastatur oder Maus Runde für Runde auf dem 2D-Board durchklicken.
* Positionen, Flanken, Türme, Techs und Round-Diffs sind eindeutig und ohne Überlagerungs-Chaos lesbar.
* Board bleibt auch auf kleineren Viewports sauber bedienbar.

---

### Phase 3: Statische Analyse-Engine, Charts & Rule Findings

**Ziel:** Echter analytischer Mehrwert ohne KI – die App erklärt anhand harter Zahlen und Regeln, wo Stärken, Schwächen und Wendepunkte lagen.

**Tasks:**

* Implementiere Metrik-Module (`src/core/analytics/metrics/`):
* **Economy & Tempo:** Army Value pro Runde (beide Spieler im Vergleich), geschätzte Supply-Ausgaben, Deployment-Slot-Auslastung, Tech-Anteil am Gesamtwert.
* **Composition:** Prozentuale Rollenverteilung pro Runde (Chaff %, Chaff-Clear %, Single-Target %, Anti-Air %, Air %, Giant %).
* **Spatial Heuristics:** Army-Value-Split Links / Rechts / Flank (Asymmetrie-Erkennung), Tower-Exposition, Chaff-Tiefe (Front-to-Back-Abstand).


* Implementiere modulare **Rule-Engine (`src/core/analytics/rules/`)** – jede Regel ist eine kleine, isolierte Funktion `(snapshot, patchData) => RuleFinding[]`:
* `AntiAirGapRule`: Gegner baut Air-Wert auf, eigene Anti-Air-Abdeckung bleibt unter Schwellenwert.
* `ChaffRatioRule`: Chaff-Anteil fällt in Mid/Late-Game unter gesunden Bereich (z. B. < 15 %) oder übersteigt Extremwerte.
* `DeploymentWasteRule`: Offene Deployment-Slots trotz hoher freier Ressourcen.
* `TechOvercommitRule`: Hohe Tech-Investition in eine einzelne, leicht counterbare Einheitengruppe.
* `FlankExposureRule`: Signifikanter Flank-Commit ohne defensive Reaktion oder asymmetrische Entblößung eines Turms.
* `LaneImbalanceRule`: Extreme Überinvestition auf einer Seite bei offenem Gegenzug.


* Baue die **Charts & Overview-Ansichten (`src/ui/charts/`, `src/ui/findings/`)**:
* Interaktive Verlaufskurven (Klick auf eine Runde im Chart springt direkt auf diese Runde im 2D-Board).
* Runden-bezogene Findings-Liste mit Klick-to-Highlight (Klick auf ein Finding markiert die betroffene Runde & Zone/Einheiten auf dem Board).


* Optionaler **Ergebnis-Connector:** Manueller Winner-Toggle pro Match + optionaler Drag-&-Drop-Import der lokalen Spiel-Log-Datei, um Match-Sieger lokal zuzuordnen.

**Meilenstein M3 (Definition of Done):**

* Jede Regel hat eigene Unit-Tests mit positiven und negativen Szenarien.
* Alle Charts und Findings sind bidirektional mit der Runden-Auswahl des 2D-Boards synchronisiert.
* Alle Metriken erklären per Tooltip transparent ihre Berechnungsformel (kein „Black-Box-Score“).

---

### Phase 4: Export, Community-Readiness & Open-Source-Release (v1.0)

**Ziel:** Veröffentlichung als poliertes, selbsterklärendes Open-Source-Produkt für die Mechabellum-Community.

**Tasks:**

* Implementiere `src/core/export/`:
* Download als `MatchSnapshot v1` (`.json`) und `AnalysisReport v1` (`.json`).
* **„Copy AI-Ready Match Summary“ (Markdown):** Erzeugt eine kompakte, token-effiziente Zusammenfassung (Runden-Timeline, Economy-Diffs, Board-Rollen, getriggerte Rule Findings), die Nutzer direkt in beliebige LLMs pasten können.


* Binde 2–3 spannende Sample-Replays ein („Try Demo Match“-Buttons direkt auf der Startseite).
* Erstelle `CONTRIBUTING.md` mit Kurzanleitung: *„Neuer Mechabellum-Patch erschienen? So ergänzt du neue Unit-/Tech-IDs in 5 Minuten.“*
* Verifiziere Performance (Bundle-Size-Check, Lazy-Loading der Charts), Accessibility (Tastaturnavigation, Kontraste) und Mobile-Ansicht.
* Dokumentiere GitHub-Pages-Deployment und Docker-Self-Hosting in der `README.md`.

**Meilenstein M4 (Release v1.0 – Definition of Done):**

* Live-Demo läuft öffentlich auf GitHub Pages.
* Docker-Image baut und startet lokal unter Port 8080 ohne externe Abhängigkeiten.
* Zero Console Errors, alle CI-Checks grün, saubere `v1.0.0`-Release-Notes.

---

### Phase 5 (Post-MVP / Modulare Erweiterungs-Roadmap)

*Nicht Teil des initialen Builds – Architektur muss diese Erweiterungen aber durch saubere Interfaces in `src/extensions/` vorbereiten:*

1. **Phase 5A – Optionaler BYOK-KI-Coach (Client-Side):** Nutzer hinterlegt optional einen eigenen API-Key (OpenAI / Anthropic / Gemini / lokales Ollama) im Browser-Storage; `AnalysisReport v1` + Patch-JSON werden genutzt, um natürliche Coaching-Erklärungen pro Swing-Runde zu generieren.
2. **Phase 5B – Multi-Replay-Session-Tracker (Local-First):** Ordner-Upload mehrerer `.grbr`-Dateien mit lokaler Browser-Datenbank (IndexedDB / DuckDB-WASM) für persönliche Winrates, Lieblings-Units, Tech-Statistiken und Muster über 50+ Spiele.
3. **Phase 5C – Combat-Telemetry-Adapter (Typ 2):** Offenes JSON-Importformat für optionale externe Combat-Logs (z. B. per-Unit-Damage/Death-Timestamps aus externen Community-Tools), die sich ohne Umbau als zusätzliche Zeitleiste in den bestehenden Viewer einhängen lassen.

---

## 6. Arbeitsregeln für den Coding-Agent

1. **Slice-weises Arbeiten:** Implementiere genau eine Phase (oder einen klar abgegrenzten Sub-Slice) pro Pull Request / Commit-Serie. Beginne erst mit Phase `N+1`, wenn alle DoD-Kriterien von Phase `N` grün sind.
2. **Core vor UI:** Domain-Logik (Parser, State-Reducer, Metriken, Regeln) gehört strikt nach `src/core/` und darf **keine** React-/DOM-Imports enthalten.
3. **Keine Halluzinationen beim `.grbr`-Format:** XML-Tag-Namen und ID-Mappings dürfen nicht geraten werden. Falls beim Start von Phase 1 noch keine echte `.grbr`-Datei im Ordner `fixtures/replays/` liegt, fordere explizit 1–2 reale Beispieldateien (oder Referenz-Schema) an bzw. dokumentiere verifizierte vs. vorläufige Felder klar getrennt.
4. **Verifikationspflicht:** Führe nach jeder Änderung `pnpm typecheck && pnpm test && pnpm build` aus. Keine ungetesteten Parser- oder Regel-Änderungen committen.
5. **Dokumentation schlank halten:** Halte `AGENTS.md` aktuell und kurz; keine aufgeblähten ADRs oder redundanten Kommentare im Code.