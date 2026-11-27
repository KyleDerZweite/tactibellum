import { expect, it } from "vitest";
import demo from "../../../fixtures/replays/flank-pressure.grbr?raw";
import patchFile from "../../../data/patches/latest.json";
import { analysisReportSchema } from "../contracts/analysis";
import type {
  BoardUnit,
  MatchSnapshotV1,
  PlayerRoundState,
  RoundSnapshot,
} from "../contracts/match";
import type { PatchData, PatchUnit } from "../contracts/patch";
import { loadPatchData } from "../game-data";
import { parseRawReplay } from "../parser";
import { reconstructMatch } from "../state";
import {
  analyzeMatch,
  AntiAirGapRule,
  ChaffRatioRule,
  DeploymentWasteRule,
  TechOvercommitRule,
  FlankExposureRule,
  LaneImbalanceRule,
} from "./index";

function catalogUnit(
  id: string,
  cost: number,
  roles: string[],
  extra?: Partial<PatchUnit>,
): PatchUnit {
  return {
    id,
    name: id,
    cost,
    roles,
    unlockCost: 0,
    tier: 100,
    footprint: { width: 1, height: 1 },
    range: null,
    speed: null,
    isAir: false,
    canTargetAir: false,
    canTargetGround: true,
    techs: {},
    ...extra,
  };
}

const patch: PatchData = {
  version: "test",
  notes: [],
  sources: [],
  items: {},
  devices: {},
  towers: {},
  spells: {},
  specialists: {},
  blueprints: {},
  units: {
    chaff: catalogUnit("chaff", 100, ["chaff"]),
    ground: catalogUnit("ground", 400, ["single-target"], {
      techs: {
        aa: {
          name: "AA",
          cost: 400,
          addedRoles: ["anti-air"],
          statModifiers: {},
        },
        unknownPrice: {
          name: "Unknown price",
          cost: null,
          addedRoles: [],
          statModifiers: {},
        },
      },
    }),
    air: catalogUnit("air", 500, [], { isAir: true }),
    aa: catalogUnit("aa", 200, [], { canTargetAir: true }),
  },
};

function unit(
  unitId: string,
  x = -140,
  y = -170,
  extra?: Partial<BoardUnit>,
): BoardUnit {
  return {
    instanceId: unitId,
    unitId,
    x,
    y,
    level: 1,
    techIds: [],
    statusThisRound: "existing",
    ...extra,
  };
}

function state(
  playerId: string,
  units: BoardUnit[],
  overrides?: Partial<PlayerRoundState>,
): PlayerRoundState {
  return {
    playerId,
    units,
    actions: [],
    unlockedUnits: [],
    activeSpells: [],
    towerUpgrades: [],
    estimatedArmyValue: units.reduce(
      (sum, unit) => sum + (patch.units[unit.unitId]?.cost ?? 0),
      0,
    ),
    deploymentsUsed: 2,
    supplySpentThisRound: 0,
    ...overrides,
  };
}

function round(
  roundNumber: number,
  own: BoardUnit[],
  enemy: BoardUnit[],
  overrides?: Partial<PlayerRoundState>,
): RoundSnapshot {
  return {
    roundNumber,
    players: {
      own: state("own", own, overrides),
      enemy: state("enemy", enemy),
    },
  };
}

function match(...rounds: RoundSnapshot[]): MatchSnapshotV1 {
  return {
    schemaVersion: "1.0.0",
    meta: {
      fileName: "test",
      mapId: "1021",
      mode: "1v1",
      players: [
        { id: "own", name: "Own" },
        { id: "enemy", name: "Enemy" },
      ],
      unknownIds: [],
    },
    rounds,
  };
}

it("reports an opposing air investment against zero anti-air", () => {
  expect(
    AntiAirGapRule(match(round(3, [unit("ground")], [unit("air")])), patch),
  ).toMatchObject([
    {
      playerId: "own",
      evidence: { enemyAirValue: 500, antiAirShare: 0 },
      highlight: { units: [{ playerId: "enemy", instanceId: "air" }] },
    },
  ]);
});

it("credits researched anti-air and skips air gaps with unknown roles", () => {
  expect(
    AntiAirGapRule(
      match(
        round(
          3,
          [unit("ground", -140, -170, { techIds: ["aa"] })],
          [unit("air")],
        ),
      ),
      patch,
    ),
  ).toEqual([]);
  expect(
    AntiAirGapRule(match(round(3, [unit("unknown")], [unit("air")])), patch),
  ).toEqual([]);
});

it("reports low and excessive chaff in the mid-game", () => {
  expect(
    ChaffRatioRule(match(round(3, [unit("ground")], [unit("chaff")])), patch),
  ).toMatchObject([
    {
      playerId: "enemy",
      title: "High chaff share",
      evidence: { chaffShare: 1 },
    },
    { playerId: "own", title: "Low chaff share", evidence: { chaffShare: 0 } },
  ]);
});

it("accepts 20% chaff and skips opening rounds and empty boards", () => {
  expect(
    ChaffRatioRule(
      match(
        round(2, [unit("ground")], []),
        round(3, [unit("ground"), unit("chaff")], []),
      ),
      patch,
    ),
  ).toEqual([]);
});

it("reports remaining supply with an unused recorded slot", () => {
  expect(
    DeploymentWasteRule(
      match(
        round(1, [], [], {
          deploymentSlots: 3,
          actions: [
            {
              kind: "buy",
              sourceType: "PAD_BuyUnit",
              unitId: "ground",
              instanceId: "1",
            },
            {
              kind: "buy",
              sourceType: "PAD_BuyUnit",
              unitId: "ground",
              instanceId: "2",
            },
          ],
        }),
        round(2, [], [], { checkpointSupply: 275 }),
      ),
      patch,
    ),
  ).toMatchObject([
    {
      roundNumber: 1,
      playerId: "own",
      evidence: {
        unusedSlots: 1,
        carryoverAfterRound: 275,
        deploymentCapacityEstimated: 0,
      },
    },
  ]);
});

it("ignores current supply, gaps and next-round checkpoints containing income", () => {
  const actions = [
    {
      kind: "buy" as const,
      sourceType: "PAD_BuyUnit",
      unitId: "ground",
      instanceId: "1",
    },
  ];
  expect(
    DeploymentWasteRule(
      match(
        round(1, [], [], {
          deploymentsUsed: 1,
          checkpointSupply: 500,
          actions,
        }),
        round(2, [], [], {
          deploymentsUsed: 1,
          checkpointSupply: 500,
          supplyAvailable: 500,
          actions,
        }),
        round(4, [], [], { checkpointSupply: 500 }),
      ),
      patch,
    ),
  ).toEqual([]);
});

it("withholds unused deployment slots when a purchase cannot be reconstructed", () => {
  const snapshot = match(
    round(1, [], [], {
      deploymentsUsed: 1,
      actions: [{ kind: "buy", sourceType: "PAD_BuyUnit" }],
    }),
    round(2, [], [], { checkpointSupply: 500 }),
  );
  expect(DeploymentWasteRule(snapshot, patch)).toEqual([]);
});

it("treats inherited property names as unknown unit and technology IDs", () => {
  const unknown = unit("constructor", -140, -170, { techIds: ["777"] });
  const inheritedTech = unit("ground", -140, -190, { techIds: ["toString"] });
  const snapshot = match(round(3, [unknown, inheritedTech], [unit("air")]));
  const report = analyzeMatch(snapshot, patch);
  expect(report.rounds[0].players.own.composition.unknownUnits).toBe(1);
  expect(report.findings.filter(({ playerId }) => playerId === "own")).toEqual(
    [],
  );
});

it("withholds unused slots when the reducer rejects an occupied-instance buy", () => {
  const replay = parseRawReplay(demo);
  const [first, second] = replay.players[0].rounds;
  first.actions.splice(-1, 0, {
    sourceType: "PAD_BuyUnit",
    fields: { UID: "15", UIDX: "2" },
  });
  if (!second.checkpoint) throw new Error("Missing demo checkpoint.");
  second.checkpoint.supply = "500";
  const catalog = loadPatchData(patchFile);
  const snapshot = reconstructMatch(replay, catalog);
  expect(snapshot.meta.warnings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        message: expect.stringContaining("occupied unit index 2"),
      }),
    ]),
  );
  expect(snapshot.rounds[0].players["1"].deploymentsUsed).toBe(1);
  expect(
    DeploymentWasteRule(snapshot, catalog).find(
      ({ roundNumber, playerId }) => roundNumber === 1 && playerId === "1",
    ),
  ).toBeUndefined();
});

it("detects concentrated tech facing enemy chaff and charges once per type", () => {
  const teched = unit("ground", -140, -170, { techIds: ["aa"] });
  expect(
    TechOvercommitRule(
      match(
        round(
          3,
          [teched, { ...teched, instanceId: "second" }],
          [unit("chaff")],
        ),
      ),
      patch,
    ),
  ).toMatchObject([
    {
      playerId: "own",
      evidence: {
        unitTechValue: 400,
        totalTechValue: 400,
        enemyCounterShare: 1,
      },
    },
  ]);
});

it("requires counter evidence and known tech prices", () => {
  const teched = unit("ground", -140, -170, { techIds: ["aa"] });
  const unknownPrice = { ...teched, techIds: ["aa", "unknownPrice"] };
  expect(
    TechOvercommitRule(
      match(
        round(3, [teched], [unit("ground")]),
        round(4, [unknownPrice], [unit("chaff")]),
      ),
      patch,
    ),
  ).toEqual([]);
});

it("highlights enemy flank units and their world region at an exposed tower", () => {
  const north = unit("chaff", 140, 170);
  const flank = unit("air", -330, -170);
  expect(
    FlankExposureRule(
      match(
        round(
          3,
          [unit("ground", 140), unit("chaff", -100, -110)],
          [north, flank],
        ),
      ),
      patch,
    ),
  ).toMatchObject([
    {
      playerId: "own",
      title: "Energy Tower exposed on the world left",
      evidence: { friendlyValue: 100, opposingFlankValue: 500 },
      highlight: {
        region: { x: -360, y: -310 },
        units: [{ playerId: "enemy", instanceId: "air" }],
      },
    },
  ]);
});

it("skips guarded flanks, unknown placements and round-one flank threats", () => {
  const north = unit("chaff", 140, 170);
  const flank = unit("air", -330, -170);
  expect(
    FlankExposureRule(
      match(
        round(1, [unit("chaff", -140)], [north, flank]),
        round(2, [unit("ground", -140)], [north, flank]),
        round(
          3,
          [unit("chaff", -140, -170, { positionKnown: false })],
          [north, flank],
        ),
      ),
      patch,
    ),
  ).toEqual([]);
});

it("detects an opponent's world-right pressure against a world-left stack", () => {
  expect(
    LaneImbalanceRule(
      match(round(3, [unit("ground")], [unit("air", 140, 170)])),
      patch,
    ),
  ).toMatchObject([
    {
      playerId: "own",
      title: "Open world right lane",
      evidence: { laneValueGap: 500, otherLaneShare: 1 },
      highlight: {
        region: { x: 0, y: -310 },
        units: [{ playerId: "enemy", instanceId: "air" }],
      },
    },
    { playerId: "enemy", title: "Open world left lane" },
  ]);
});

it("ignores balanced lines, missing value and unsupported modes", () => {
  const balanced = match(
    round(3, [unit("ground"), unit("air", 140)], [unit("air", 140, 170)]),
  );
  expect(
    LaneImbalanceRule(balanced, patch).filter(
      ({ playerId }) => playerId === "own",
    ),
  ).toEqual([]);
  const unknown = match(
    round(3, [unit("ground"), unit("unknown", 140)], [unit("air", 140, 170)]),
  );
  expect(LaneImbalanceRule(unknown, patch)).toEqual([]);
  const unsupported = match(
    round(3, [unit("ground")], [unit("air", 140, 170)]),
  );
  unsupported.meta.mode = "2v2";
  expect(analyzeMatch(unsupported, patch).findings).toEqual([]);
});

it("uses adjacent snapshots and retains observed tech after a sale", () => {
  const first = round(1, [unit("ground")], [], {
    checkpointSupply: 900,
    deploymentsUsed: 3,
    activeOfficerIds: ["officer"],
    actions: [
      {
        kind: "tech",
        sourceType: "test",
        unitId: "ground",
        ref: { id: "aa", name: "AA" },
        cost: 400,
      },
      {
        kind: "tech",
        sourceType: "test",
        unitId: "ground",
        ref: { id: "unknownPrice", name: "Unknown" },
        undone: true,
      },
    ],
  });
  const second = round(2, [unit("chaff")], [], {
    checkpointSupply: 250,
    supplySpentThisRound: 100,
  });
  const fourth = round(4, [], [], { checkpointSupply: 200 });
  const report = analyzeMatch(match(fourth, first, second), patch);
  expect(report.rounds.map(({ roundNumber }) => roundNumber)).toEqual([
    1, 2, 4,
  ]);
  expect(report.rounds[0].players.own.economy).toMatchObject({
    armyValueDelta: null,
    carryoverAfterRound: 250,
    deploymentCapacity: 2,
    deploymentCapacityEstimated: true,
    deploymentUtilization: 1.5,
    techValue: 400,
  });
  expect(report.rounds[1].players.own.economy).toMatchObject({
    armyValueDelta: -300,
    supplyEfficiency: -3,
    carryoverAfterRound: null,
    techValue: 400,
  });
  expect(report.rounds[2].players.own.economy.armyValueDelta).toBeNull();
});

it("computes overlapping value shares and spatial coverage with partial positions", () => {
  const own = [
    unit("ground", -140, -170, { level: 2, techIds: ["aa"] }),
    unit("chaff", 140, -150),
    unit("chaff", 150, -200, { instanceId: "other" }),
    unit("chaff", 0, 0, { instanceId: "unplaced", positionKnown: false }),
    unit("unknown"),
  ];
  const enemy = [unit("chaff", 140, 170), unit("air", -330, -170)];
  const report = analyzeMatch(match(round(3, own, enemy)), patch);
  const metrics = report.rounds[0].players.own;
  expect(metrics.composition.unknownUnits).toBe(1);
  expect(metrics.composition.shares).toMatchObject({
    "single-target": 2 / 3,
    "anti-air": 2 / 3,
    chaff: 1 / 3,
  });
  expect(metrics.spatial).toEqual({
    leftArmyValue: 600,
    rightArmyValue: 200,
    flankArmyValue: 0,
    chaffDepth: 50,
    towerDefense: [
      { towerId: "south-energy", friendlyValue: 600, opposingFlankValue: 500 },
      { towerId: "south-research", friendlyValue: 200, opposingFlankValue: 0 },
    ],
  });
  expect(report.rounds[0].players.enemy.spatial?.flankArmyValue).toBe(500);
});

it("reconstructs the nine-round demo into a deterministic valid report", () => {
  const patch = loadPatchData(patchFile);
  const snapshot = reconstructMatch(
    parseRawReplay(demo, "flank-pressure.grbr"),
    patch,
  );
  const report = analyzeMatch(snapshot, patch);
  expect(report.rounds).toHaveLength(9);
  expect(report.findings.some(({ ruleId }) => ruleId === "anti-air-gap")).toBe(
    true,
  );
  expect(new Set(report.findings.map(({ id }) => id)).size).toBe(
    report.findings.length,
  );
  expect(analysisReportSchema.parse(report)).toEqual(report);
  expect(analyzeMatch(snapshot, patch)).toEqual(report);
});

it("reports uneven tower defense when the enemy threatens the weak half without a flank", () => {
  const snapshot = match(
    round(3, [unit("ground", 140)], [unit("air", -140, 170)]),
  );
  expect(
    FlankExposureRule(snapshot, patch).filter(
      ({ playerId }) => playerId === "own",
    ),
  ).toMatchObject([
    {
      evidence: {
        friendlyValue: 0,
        otherTowerFriendlyValue: 400,
        opposingLaneValue: 500,
        opposingFlankValue: 0,
      },
    },
  ]);
});

it("distinguishes a missing spatial measurement from a measured zero", () => {
  const snapshot = match(
    round(3, [unit("ground")], [unit("chaff", 0, 0, { positionKnown: false })]),
  );
  const { own, enemy } = analyzeMatch(snapshot, patch).rounds[0].players;
  expect(own.spatial).toMatchObject({
    leftArmyValue: 400,
    rightArmyValue: 0,
    chaffDepth: null,
    towerDefense: [],
  });
  expect(enemy.spatial).toBeNull();
});
