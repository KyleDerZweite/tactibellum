import { loadPatchData } from "../../core/game-data";

const data = import.meta.glob("../../../data/patches/*.json", {
  eager: true,
  import: "default",
});

export function patchFor(version?: string) {
  const exact = data[`../../../data/patches/${version}.json`];
  const candidate = exact ?? data["../../../data/patches/latest.json"];
  return candidate === undefined ? undefined : loadPatchData(candidate);
}
