import type { DisplayUnit } from "./boardUnits";

const glyphs = {
  air: "M0 -8 8 6 0 3 -8 6Z",
  giant: "M-7 -5 0 -8 7 -5 7 5 0 8 -7 5Z M-3 0H3 M0 -3V3",
  chaff: "M-6 -3h4v4h-4z M2 -3h4v4H2z M-2 3h4v4h-4z",
  "chaff-clear": "M-7 -5 0 1 7 -5 M-7 1 0 7 7 1",
  "anti-air": "M-7 6 0 -7 7 6 M-4 1H4",
  ground: "M0 -7 7 0 0 7 -7 0Z M-3 0H3",
  unknown: "M-4 -4Q0 -9 4 -4Q6 -1 0 2V3 M0 6V8",
};

export function MechGlyph({
  data: { entry, roles },
  transform,
}: {
  data: DisplayUnit;
  transform?: string;
}) {
  const category = entry.isUnknown
    ? "unknown"
    : ((["air", "giant", "chaff", "chaff-clear", "anti-air"] as const).find(
        (role) => roles.includes(role),
      ) ?? "ground");
  return (
    <path className="board-glyph" d={glyphs[category]} transform={transform} />
  );
}
