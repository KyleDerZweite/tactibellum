import { describe, expect, it } from "vitest";
import demo from "../../fixtures/replays/flank-pressure.grbr?raw";
import unknown from "../../fixtures/replays/unknown-and-empty.grbr?raw";
import reference from "../../fixtures/replays/reference-2340.grbr?raw";
import patchFile from "../../data/patches/latest.json";
import { createGameCatalog, loadPatchData } from "./game-data";
import { MAX_REPLAY_BYTES, parseRawReplay } from "./parser";
import { reconstructMatch } from "./state";

const patch = loadPatchData(patchFile);
const minimal =
  "<BattleRecord><playerRecords><PlayerRecord><id>1</id></PlayerRecord></playerRecords></BattleRecord>";

describe("replay parser", () => {
  it("reads plain XML, UTF-8 BOM and UTF-8 XML with binary prefix and footer", () => {
    const payload = new TextEncoder().encode(`\uFEFF${minimal}`);
    const wrapped = new Uint8Array(payload.length + 8);
    wrapped.set([0x00, 0x9d, 0xa3, 0xff], 0);
    wrapped.set(payload, 4);
    wrapped.set([0xca, 0xfe, 0x00, 0x1f], 4 + payload.length);
    expect(parseRawReplay(wrapped)).toEqual(parseRawReplay(payload));
    expect(parseRawReplay(payload)).toEqual(parseRawReplay(minimal));
  });

  it.each([
    ["", /empty/],
    ["<BattleRecord>", /Malformed/],
    ["<Other/>", /BattleRecord/],
    ["<BattleRecord/>", /no players/],
    [
      `<!DOCTYPE BattleRecord [<!ENTITY a "custom">]>${minimal}`,
      /DTD or entity/,
    ],
    [`<!ENTITY a "custom">${minimal}`, /DTD or entity/],
    [`${minimal}<Other/>`, /Malformed|BattleRecord/],
    [`${minimal}text after XML`, /Malformed|BattleRecord/],
  ])("rejects malformed or unsupported input %#", (input, expected) => {
    expect(() => parseRawReplay(input)).toThrow(expected);
  });

  it("bounds input before XML parsing", () => {
    expect(() => parseRawReplay(new Uint8Array(MAX_REPLAY_BYTES + 1))).toThrow(
      /8 MiB/,
    );
    expect(() => parseRawReplay("é".repeat(MAX_REPLAY_BYTES / 2 + 1))).toThrow(
      /8 MiB/,
    );
  });

  it("rejects a player ID reserved by the round record", () => {
    expect(() =>
      parseRawReplay(minimal.replace("<id>1</id>", "<id>__proto__</id>")),
    ).toThrow(/reserved player ID/);
  });

  it("preserves match checkpoint fields which have no reducer mapping", () => {
    const xml = minimal.replace(
      "</BattleRecord>",
      "<matchDatas><MatchSnapshotData><round>2</round><futureState><value>42</value></futureState></MatchSnapshotData></matchDatas></BattleRecord>",
    );
    expect(parseRawReplay(xml).matchCheckpoints).toEqual([
      { roundNumber: 2, fields: { round: "2", futureState: { value: "42" } } },
    ]);
  });

  it("preserves unknown action payload and builds an empty replay", () => {
    const raw = parseRawReplay(unknown);
    expect(raw.players[0].rounds[0].actions[3]).toMatchObject({
      sourceType: "PAD_Experimental",
      fields: { Data: "original test payload", ID: "444" },
    });
    expect(reconstructMatch(parseRawReplay(minimal), patch)).toMatchObject({
      rounds: [],
      meta: {
        warnings: expect.arrayContaining([
          { message: "The replay contains no deployment rounds." },
        ]),
      },
    });
  });
});

describe("deployment reconstruction", () => {
  it("matches a de-identified native checkpoint after Elite Specialist purchases", () => {
    const replay = parseRawReplay(reference, "reference-2340.grbr");
    const snapshot = reconstructMatch(replay, patch);
    expect(snapshot.meta).toMatchObject({
      gameVersion: "2340",
      mapId: "1021",
      mode: "1v1",
    });
    expect(snapshot.rounds.map(({ roundNumber }) => roundNumber)).toEqual([
      1, 2,
    ]);
    expect(snapshot.meta.players.map(({ team }) => team)).toEqual(["0", "0"]);
    const elite = snapshot.rounds[0].players["900001"];
    expect(elite.specialistId).toBe("20032");
    expect(
      elite.units
        .filter(({ statusThisRound }) => statusThisRound === "new")
        .map(({ instanceId, unitId, level }) => ({
          instanceId,
          unitId,
          level,
        })),
    ).toEqual([
      { instanceId: "5", unitId: "9", level: 2 },
      { instanceId: "6", unitId: "9", level: 2 },
    ]);
  });

  it("keeps the recruitment level of a nonfirst Elite Specialist across a missing officer checkpoint", () => {
    const replay = parseRawReplay(
      reference.replaceAll(
        "<int>20032</int>",
        "<int>10002</int><int>20032</int>",
      ),
    );
    const secondCheckpoint = replay.players[0].rounds.find(
      ({ roundNumber }) => roundNumber === 2,
    )?.checkpoint;
    if (!secondCheckpoint) throw new Error("Missing fixture checkpoint.");
    delete secondCheckpoint.officers;
    const snapshot = reconstructMatch(replay, patch);
    const [first, second] = snapshot.rounds.map(
      ({ players }) => players["900001"],
    );
    expect(first.specialistId).toBe("10002");
    expect(
      first.units.find(({ instanceId }) => instanceId === "5")?.level,
    ).toBe(2);
    expect(
      second.units.find(({ instanceId }) => instanceId === "5")?.level,
    ).toBe(2);
    expect(
      second.units
        .filter(({ instanceId }) => instanceId === "8" || instanceId === "9")
        .map(({ level }) => level),
    ).toEqual([2, 2]);
  });

  it("produces a nine-round golden board, economy and ordered lifecycle", () => {
    const match = reconstructMatch(parseRawReplay(demo, "demo.grbr"), patch);
    expect(match.meta).toMatchObject({
      fileName: "demo.grbr",
      mode: "1v1",
      gameVersion: "2340",
      unknownIds: [],
      warnings: [],
    });
    expect(match.rounds.map((round) => round.roundNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    const states = match.rounds.map((round) => round.players["1"]);
    expect(
      states.map(({ units, deploymentsUsed }) => [
        units.length,
        deploymentsUsed,
      ]),
    ).toEqual([
      [3, 1],
      [4, 1],
      [4, 1],
      [5, 1],
      [6, 1],
      [7, 1],
      [8, 1],
      [9, 1],
      [10, 1],
    ]);
    expect(states[0].actions.map((action) => action.kind)).toEqual([
      "buy",
      "move",
      "move",
      "finish",
    ]);
    expect(states[1].units.find((unit) => unit.instanceId === "1")?.level).toBe(
      2,
    );
    expect(states[2].units.find((unit) => unit.instanceId === "1")?.level).toBe(
      2,
    );
    expect(states[2].removedUnits?.map((unit) => unit.instanceId)).toEqual([
      "0",
    ]);
    expect(states[2].actions[0]).toMatchObject({
      kind: "sell",
      ref: { id: "900001" },
    });
    expect(states[3].checkpointSupply).toBe(900);
    expect(states[3].supplyAvailable).toBeUndefined();
    expect(
      states[6].actions
        .filter((action) => action.kind === "buy")
        .map((action) => action.undone),
    ).toEqual([true, undefined]);
    expect(
      states[8].units.find((unit) => unit.instanceId === "1"),
    ).toMatchObject({
      x: -48,
      y: 100,
      orientation: 90,
      level: 4,
      itemId: "13030001",
      techIds: ["10215", "10915", "3115"],
    });
    expect(states[8].units.at(-1)).toMatchObject({
      instanceId: "10",
      x: -97,
      y: 146,
      statusThisRound: "new",
    });
    expect(states[8].supplySpentThisRound).toBe(
      (patch.units["1"].unlockCost ?? 0) + patch.units["1"].cost,
    );
  });

  it("keeps empty rounds, type-safe unknown IDs and unresolved positions", () => {
    const match = reconstructMatch(parseRawReplay(unknown), patch);
    const [first, second, third] = match.rounds;
    expect(first.players.b).toMatchObject({ units: [], actions: [] });
    expect(first.players.a.units[1]).toMatchObject({
      unitId: "4021",
      x: 42,
      y: -72,
    });
    expect(second.players.a.units[2]).toMatchObject({
      unitId: "10",
      positionKnown: false,
    });
    expect(third.players.a.actions).toEqual([]);
    expect(first.players.a.actions[2]).toMatchObject({
      ref: { id: "9999", isUnknown: true },
    });
    expect(first.players.a.actions[3]).toMatchObject({
      kind: "unknown",
      sourceType: "PAD_Experimental",
    });
    expect(match.meta.unknownIds).toEqual(
      expect.arrayContaining([
        { kind: "unit", id: "4021", roundNumber: 1, playerId: "a" },
        { kind: "tech", id: "9999", roundNumber: 2, playerId: "a" },
      ]),
    );
    expect(createGameCatalog(patch).unit("constructor")).toMatchObject({
      isUnknown: true,
      cost: null,
    });
  });

  it("reconstructs an encoded unit drop without charging a purchase or deployment", () => {
    const xml = unknown.replace(
      '<MatchActionData xsi:type="PAD_BuyUnit">',
      `<MatchActionData xsi:type="PAD_ChooseReinforceItem"><ID>1012210</ID><Index>0</Index></MatchActionData>
      <MatchActionData xsi:type="PAD_BuyUnit">`,
    );
    const {
      players: { a },
    } = reconstructMatch(parseRawReplay(xml), patch).rounds[0];
    expect(a.actions[0]).toMatchObject({ kind: "reinforcement", unitId: "10" });
    expect(
      a.units.filter(
        (unit) => unit.instanceId === "1" || unit.instanceId === "2",
      ),
    ).toMatchObject([
      { unitId: "10", level: 2, positionKnown: false },
      { unitId: "10", level: 2, positionKnown: false },
    ]);
    expect(a.units.at(-1)).toMatchObject({
      unitId: "4021",
      instanceId: "3",
      positionKnown: false,
    });
    expect(a.deploymentsUsed).toBe(1);
  });

  it("uses a matching checkpoint to identify an unlogged spawn and keeps its final level", () => {
    const xml = unknown
      .replace(
        /<MatchActionData xsi:type="PAD_BuyUnit">[\s\S]*?<\/MatchActionData>/,
        `<MatchActionData xsi:type="PAD_MoveUnit"><moveUnitDatas><MoveUnitData>
          <unitID>4021</unitID><unitIndex>1</unitIndex><position><x>42</x><y>-72</y></position>
        </MoveUnitData></moveUnitDatas></MatchActionData>
        <MatchActionData xsi:type="PAD_UpgradeUnit"><UIDX>1</UIDX></MatchActionData>`,
      )
      .replace(
        /<id>4021<\/id>\s*<Index>1<\/Index>\s*<Level>0<\/Level>/,
        "<id>4021</id><Index>1</Index><Level>1</Level>",
      );
    const {
      players: { a },
    } = reconstructMatch(parseRawReplay(xml), patch).rounds[0];
    expect(a.units[1]).toMatchObject({
      unitId: "4021",
      level: 2,
      x: 42,
      y: -72,
    });
    expect(a.deploymentsUsed).toBe(0);
  });

  it("discards a deployment spell when the matching skill is cancelled", () => {
    const xml = unknown.replace(
      '<MatchActionData xsi:type="PAD_Experimental">',
      `<MatchActionData xsi:type="PAD_ReleaseCommanderSkill"><ID>300001</ID><SkillIndex>2</SkillIndex>
      <Positions><MapVector><x>12</x><y>17</y></MapVector></Positions></MatchActionData>
      <MatchActionData xsi:type="PAD_CancelReleaseCommanderSkill"><ID>0</ID><SkillIndex>2</SkillIndex></MatchActionData>
      <MatchActionData xsi:type="PAD_Experimental">`,
    );
    const {
      players: { a },
    } = reconstructMatch(parseRawReplay(xml), patch).rounds[0];
    expect(a.activeSpells).toEqual([]);
    expect(a.actions.slice(3, 5)).toMatchObject([
      { kind: "spell", undone: true, position: { x: 12, y: 17 } },
      { kind: "undo", ref: { id: "300001" } },
    ]);
  });
});
