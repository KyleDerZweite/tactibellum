import { XMLParser, XMLValidator } from "fast-xml-parser";
import { children, index, node, string } from "./xml-fields";
import type { XmlNode } from "./xml-fields";

export const MAX_REPLAY_BYTES = 8 * 1024 * 1024;

export interface RawReplayAction {
  sourceType: string;
  fields: XmlNode;
}

export interface RawReplayRound {
  roundNumber: number;
  checkpoint?: XmlNode;
  actions: RawReplayAction[];
}

export interface RawReplay {
  fileName: string;
  version?: string;
  battleInfo: XmlNode;
  players: {
    id: string;
    name: string;
    team?: string;
    rounds: RawReplayRound[];
  }[];
  matchCheckpoints: { roundNumber: number; fields: XmlNode }[];
  roundNumbers: number[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  ignoreDeclaration: true,
  parseTagValue: false,
  trimValues: false,
  maxNestedTags: 48,
  stopNodes: [
    "BattleRecord.playerRecords.PlayerRecord.data.unitDatas",
    "BattleRecord.playerRecords.PlayerRecord.data.styleData",
    "BattleRecord.matchDatas.MatchSnapshotData.lastFightResult",
    "BattleRecord.matchDatas.MatchSnapshotData.randomStateData",
    "BattleRecord.matchDatas.MatchSnapshotData.reinforcePool",
    "BattleRecord.playerRecords.PlayerRecord.playerRoundRecords.PlayerRoundRecord.playerData.randomStateData",
    "BattleRecord.playerRecords.PlayerRecord.playerRoundRecords.PlayerRoundRecord.playerData.reinforceRandomStateData",
  ],
});

function hasBinaryBytes(value: string) {
  for (let i = 0; i < value.length; i++) {
    const byte = value.charCodeAt(i);
    if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte >= 127)
      return true;
  }
  return false;
}

function xmlText(input: string | Uint8Array): string {
  if (typeof input === "string") {
    if (
      input.length > MAX_REPLAY_BYTES ||
      new TextEncoder().encode(input).length > MAX_REPLAY_BYTES
    )
      throw new Error("The replay exceeds the 8 MiB limit.");
    return input.replace(/^\uFEFF/, "").trim();
  }
  if (input.byteLength > MAX_REPLAY_BYTES)
    throw new Error("The replay exceeds the 8 MiB limit.");

  // Latin-1 decoding maps each byte to one code unit, including binary padding.
  // Decode only the payload as UTF-8 so invalid bytes in the wrapper are fine.
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const scan = new TextDecoder("iso-8859-1").decode(input);
  const open = scan.search(/<\?xml(?=\s)|<BattleRecord(?=[\s>])/);
  const close = scan.lastIndexOf("</BattleRecord>");
  const prefix = scan.slice(0, open).replace(/^ï»¿/, "");
  const suffix = scan.slice(close + "</BattleRecord>".length);
  try {
    if (
      open >= 0 &&
      close > open &&
      (hasBinaryBytes(prefix) || hasBinaryBytes(suffix))
    ) {
      return decoder.decode(
        input.subarray(open, close + "</BattleRecord>".length),
      );
    }
    return decoder.decode(input).trim();
  } catch {
    throw new Error("The replay XML is not valid UTF-8.");
  }
}

function records(values: XmlNode[], label: string) {
  const seen = new Set<number>();
  return values.map((value) => {
    const roundNumber = index(value.round);
    if (roundNumber === undefined || seen.has(roundNumber))
      throw new Error(
        `The replay contains an invalid or duplicate ${label} round.`,
      );
    seen.add(roundNumber);
    return { value, roundNumber };
  });
}

export function parseRawReplay(
  input: string | Uint8Array,
  fileName = "Replay",
): RawReplay {
  const xml = xmlText(input);
  if (!xml) throw new Error("The replay file is empty.");
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml))
    throw new Error("Replay XML cannot contain DTD or entity declarations.");
  const valid = XMLValidator.validate(xml);
  if (valid !== true)
    throw new Error(`Malformed replay XML at line ${valid.err.line}.`);
  let document: XmlNode;
  try {
    document = node(parser.parse(xml));
  } catch {
    throw new Error("The replay XML could not be read.");
  }
  if (Object.keys(document).length !== 1 || document.BattleRecord === undefined)
    throw new Error("The file does not contain a BattleRecord.");
  const root = node(document.BattleRecord);
  const seen = new Set<string>();
  const players = children(root.playerRecords, "PlayerRecord").map((player) => {
    const id = string(player.id);
    if (!id || seen.has(id))
      throw new Error("The replay contains a missing or duplicate player ID.");
    if (Object.hasOwn(Object.prototype, id))
      throw new Error("The replay contains a reserved player ID.");
    seen.add(id);
    return {
      id,
      name: string(player.name) ?? `Player ${seen.size}`,
      team: string(player.team) ?? string(node(player.data).team),
      rounds: records(
        children(player.playerRoundRecords, "PlayerRoundRecord"),
        "player",
      )
        .map(({ value, roundNumber }) => ({
          roundNumber,
          checkpoint:
            value.playerData === undefined ? undefined : node(value.playerData),
          actions: children(value.actionRecords, "MatchActionData").map(
            (fields) => ({
              sourceType:
                string(fields["@_xsi:type"]) ??
                string(fields["@_type"]) ??
                Object.entries(fields)
                  .find(([key]) => /^@_[^:]+:type$/.test(key))?.[1]
                  ?.toString() ??
                "Unspecified",
              fields,
            }),
          ),
        }))
        .sort((a, b) => a.roundNumber - b.roundNumber),
    };
  });
  if (!players.length) throw new Error("The replay contains no players.");

  const matchCheckpoints = records(
    children(root.matchDatas, "MatchSnapshotData"),
    "match",
  ).map(({ value, roundNumber }) => ({ roundNumber, fields: value }));

  return {
    fileName,
    version: string(root.Version),
    battleInfo: node(root.BattleInfo),
    players,
    matchCheckpoints,
    roundNumbers: [
      ...new Set([
        ...matchCheckpoints.map(({ roundNumber }) => roundNumber),
        ...players.flatMap((player) =>
          player.rounds.map((round) => round.roundNumber),
        ),
      ]),
    ].sort((a, b) => a - b),
  };
}
