const wiki = "https://wiki.mbxmas.com/units/";

// Article paths are taken from the English wiki's unit index. Centurion uses wiki.gg.
const references = new Map<string, readonly [string, string]>([
  ["1", ["FT", "ground/fortress/"]],
  ["2", ["MK", "ground/marksman/"]],
  ["3", ["VU", "ground/vulcan/"]],
  ["4", ["MP", "ground/melting-point/"]],
  ["5", ["RH", "ground/rhino/"]],
  ["6", ["WA", "air/wasp/"]],
  ["7", ["MU", "ground/mustang/"]],
  ["8", ["SB", "ground/steel-ball/"]],
  ["9", ["FG", "ground/fang/"]],
  ["10", ["CR", "ground/crawler/"]],
  ["11", ["OV", "air/overlord/"]],
  ["12", ["ST", "ground/stormcaller/"]],
  ["13", ["SH", "ground/sledgehammer/"]],
  ["14", ["HK", "ground/hacker/"]],
  ["15", ["AR", "ground/arclight/"]],
  ["16", ["PH", "air/phoenix/"]],
  ["17", ["WF", "ground/war-factory/"]],
  ["18", ["WR", "air/wraith/"]],
  ["19", ["SC", "ground/scorpion/"]],
  ["20", ["FB", "ground/fire-badger/"]],
  ["21", ["SA", "ground/sabertooth/"]],
  ["22", ["TY", "ground/typhoon/"]],
  ["23", ["SW", "ground/sandworm/"]],
  ["24", ["TA", "ground/tarantula/"]],
  ["25", ["PR", "air/phantom-ray/"]],
  ["26", ["FS", "ground/farseer/"]],
  ["27", ["RA", "air/raiden/"]],
  ["28", ["HO", "ground/hound/"]],
  ["29", ["AB", "air/abyss/"]],
  ["30", ["VE", "ground/void-eye/"]],
  ["31", ["VX", "ground/vortex/"]],
  ["32", ["CE", "https://mechabellum.wiki.gg/wiki/Centurion"]],
  ["2002", ["MO", "ground/mountain/"]],
]);

export function mechReference(unitId: string) {
  const reference = references.get(unitId);
  return (
    reference && { code: reference[0], url: new URL(reference[1], wiki).href }
  );
}
