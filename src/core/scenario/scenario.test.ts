import pinnedPatch from "../../../data/patches/latest.json";
import demo from "../../../fixtures/replays/flank-pressure.grbr?raw";
import { loadPatchData } from "../game-data";
import { parseRawReplay } from "../parser";
import { reconstructMatch } from "../state";
import { scenarioFromReplay } from "./fromReplay";
import { estimateArrival } from "./timing";
import { expect, it } from "vitest";
import { decodeScenario, encodeScenario } from "./share";

it("shares a versioned board and ignores metadata outside the contract", () => {
  const board = {
    version: 1 as const,
    patchVersion: "2.0.0.5.2340",
    fileName: "private-replay.grbr",
    units: [
      {
        id: "u1",
        unitId: "15",
        side: "south" as const,
        x: 0,
        y: -100,
        level: 2,
        techIds: ["10215"],
        itemId: "13030001",
      },
    ],
  };
  const fragment = encodeScenario(board);
  expect(fragment).toMatch(/^#board=[\w-]+$/);
  expect(decodeScenario(fragment)).toEqual({
    version: board.version,
    patchVersion: board.patchVersion,
    units: board.units,
  });
  expect(() => decodeScenario("#board=???")).toThrow();
  expect(() =>
    encodeScenario({ ...board, units: [...board.units, ...board.units] }),
  ).toThrow();
  expect(() =>
    encodeScenario({
      ...board,
      units: [{ ...board.units[0], techIds: ["10215", "10215"] }],
    }),
  ).toThrow("Scenario tech IDs must be unique.");
});

it("keeps a typical late-round board within a 2000-character URL", () => {
  const board = {
    version: 1 as const,
    patchVersion: "2.0.0.5.2340",
    units: Array.from({ length: 58 }, (_, index) => ({
      id: `u${index + 1}`,
      unitId: String((index % 28) + 1),
      side: index % 2 === 0 ? ("north" as const) : ("south" as const),
      x: ((index * 31) % 698) - 349,
      y: ((index * 57) % 598) - 299,
      level: (index % 4) + 1,
      techIds: index % 3 ? [String(10001 + (index % 11))] : [],
    })),
  };
  const url = "https://kylederzweite.github.io/tactibellum/";
  const fragment = encodeScenario(board);
  expect(url.length + fragment.length).toBeLessThan(2000);
  expect(decodeScenario(fragment)).toEqual(board);
  board.units[0].level = 10;
  expect(() => encodeScenario(board)).toThrow();
});

it("copies and shares replay rotation and loadout under a fresh unit ID", () => {
  const patch = loadPatchData(pinnedPatch);
  const match = reconstructMatch(parseRawReplay(demo), patch);
  const round = match.rounds.at(-1);
  expect(round).toBeDefined();
  const { scenario } = scenarioFromReplay(
    match,
    round!.roundNumber,
    patch.version,
  );
  const shared = decodeScenario(encodeScenario(scenario));
  expect(shared.units).toContainEqual(
    expect.objectContaining({
      id: expect.stringMatching(/^u\d+$/),
      x: -48,
      y: 100,
      orientation: 90,
      level: 4,
      itemId: "13030001",
      techIds: ["10215", "10915", "3115"],
    }),
  );
});

it("estimates travel and range entry from distance plus known movement and range buffs", () => {
  const patch = loadPatchData(pinnedPatch);
  const result = estimateArrival(
    {
      id: "u1",
      unitId: "15",
      x: 0,
      y: -170,
      side: "south",
      level: 2,
      techIds: ["10215"],
    },
    { x: 0, y: 0 },
    patch,
  );
  expect(result).toMatchObject({
    distance: 170,
    speed: 7,
    range: 135,
    inRange: 5,
  });
  expect(result?.arrival).toBeCloseTo(24.2857, 3);
  expect(
    estimateArrival(
      {
        id: "missing",
        unitId: "missing",
        x: 0,
        y: 0,
        level: 1,
        side: "south",
        techIds: [],
      },
      { x: 0, y: 10 },
      patch,
    ),
  ).toBeUndefined();
});
