# Tactibellum

> **🚧 Work in Progress / Under Construction**

[![CI](https://github.com/KyleDerZweite/tactibellum/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/KyleDerZweite/tactibellum/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/KyleDerZweite/tactibellum/actions/workflows/deploy-pages.yml/badge.svg?branch=main)](https://github.com/KyleDerZweite/tactibellum/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Status: WIP](https://img.shields.io/badge/status-WIP-orange)](PROJECT_SPEC.md)

Tactibellum is a Mechabellum analysis board and local replay viewer. Arrange mechs, check range and arrival timing, and share the setup. Open a `.grbr` replay to review deployment rounds, compare economy and positioning, or copy a round to the analysis board. Replay files stay on your device. [Open Tactibellum on GitHub Pages](https://kylederzweite.github.io/tactibellum/).

## Analysis board

Open **Analysis Board** to place units on the standard 1v1 map. Drag a unit or set its coordinates in the inspector. Set levels, techs, and equipment for each unit. To start from a replay, select **Edit this round in Analysis Board** in the replay viewer.

- **Timing** estimates straight-line arrival and when a moving unit enters its range of the goal. The table compares arrival times to the first chaff unit or, when no chaff estimate is available, the first unit. The estimate uses map units and base movement, with supported range and speed effects.
- **Damage breakpoints** report per-member damage, hits to kill, and time from first impact using the nominal attack interval. The bundled build `2.0.0.5.2340` supports 12 attacker types and all 33 unit types as targets. The inspector lists assumptions and unavailable effects. Data comes from a [pinned extraction of the game configuration](https://github.com/qbisi/mechcore/tree/c6326dae74da9542e03c34da0c0b8066be193ae6/config).
- **Copy board link** puts unit types, placements, loadouts, and catalog version in a URL fragment. A recipient can open the same board without an account. The link contains no replay file, player identifiers, or replay history.

## Development

Use Node.js 24 and the pnpm version declared in [package.json](package.json).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm typecheck
pnpm lint
pnpm test
VITE_BASE_PATH=/tactibellum/ pnpm build
VITE_BASE_PATH=/tactibellum/ pnpm preview
```

## Hosting

For GitHub Pages, select **GitHub Actions** under **Settings → Pages → Build and deployment**. Pushes to `main` run the checks and deploy the resulting `dist/` artifact under the repository path.

For self-hosting, build the image and open http://localhost:8080/.

```sh
docker build -t tactibellum .
docker run --rm -p 8080:80 tactibellum
```

## Community resources

- [Mechabellum Wiki](https://wiki.mbxmas.com/)
- [Mechabellum Companion](https://mechabellum-companion.netlify.app/)
- [Sasha Learns](https://sashalearns.com/) and its [match archive](https://sashalearns.com/results?view=matches&window=50). Replay downloads require an account and may contain player names.

Tactibellum is an unofficial fan project. It has no affiliation with or endorsement from Game River or Dreamhaven. Mechabellum belongs to its respective rights holders. Tactibellum's source code is available under the [MIT License](LICENSE).

## Replay format and fixtures

Choose or drop one `.grbr` file, or use **Try demo match**. Browse rounds with the arrow keys on the board. Select a chart round or **Show on board** in Rule Findings to jump to that round. Use **Overview** to record the winner manually. **Action Log** shows ordered deployment actions. **Raw JSON** shows the reconstructed snapshot or the source records. Its unknown ID template contains patch and catalog IDs and omits player names.

Select a mech to see its replay details and patch data in the unit inspector. **Read Wiki** opens the linked article in the viewer and offers an external link. The article loads from the community wiki when you open it. The board and inspector use original unit marks and the bundled patch catalog.

- [Flank pressure](fixtures/replays/flank-pressure.grbr) and [Unknown and empty](fixtures/replays/unknown-and-empty.grbr) are synthetic. The first is a nine-round demo. The second exercises empty rounds, unknown IDs and missing placement. [Reference 2340](fixtures/replays/reference-2340.grbr) contains the first two real deployment rounds of an [upstream capture](https://github.com/jtk18/mechabellum-rs/blob/cbb6445941a7ff6238486e8ccce51cf96dae2c05/crates/mechabellum/fixtures/battle_record_2340.xml). It keeps deployment records and uses replacement player names and IDs. See the [upstream MIT notice](fixtures/replays/LICENSE.jtk18.txt).
- Verified with local copies of 1v1 builds 959, 1425, 2324 and 2340 on 2026-11-27. The reader accepts UTF-8 BattleRecord XML with an optional BOM and the observed native layout with binary data around the XML. The file limit is 8 MiB. The parser rejects invalid XML, DTDs, and entity declarations. Field references include the [MIT replay parser](https://github.com/ShotgunCrocodile/mechabellum_replay_parser) and [mechabellum-rs](https://github.com/jtk18/mechabellum-rs).
- The reducer treats `playerData` as a start-of-round checkpoint. It uses the zero-based unit level, instance index, position, rotation, equipment, active techs and commander skill indexes. It applies actions in source order through Finish Deploy. An adjacent checkpoint can supply missing coordinates for the same unit ID and index. Units without placement evidence have `positionKnown: false`. Coordinates on these units are placeholders. Modern replays carry buy coordinates and deployment undo records. Known reinforcement drops and Field Recovery unit sales use their observed unit and skill fields.
- Checkpoint supply normally precedes the current round's income. The snapshot records available supply when the checkpoint explicitly includes income. Supply spent sums supported action costs from the catalog. Army value uses base purchase cost plus half that cost per added level. Legacy patches can use the bundled catalog as a fallback. These estimates omit unsupported effects and unknown costs. Construction targets, some specialist effects, multiplayer reconstruction, and combat outcomes are outside the verified deployment model. Unsupported records remain available in the source JSON.
- For private verification, keep original replay files outside the repository and open them in the local app. The [Sasha Learns match archive](https://sashalearns.com/results?view=matches&window=50) requires signing in to download replays. Downloaded files can contain player identifiers.
