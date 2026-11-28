import { strFromU8, strToU8, unzlibSync, zlibSync } from "fflate";
import {
  scenarioPrefix,
  scenarioSchema,
  type Scenario,
} from "../contracts/scenario";

const maxEncodedLength = 32000;
const maxJsonLength = 96_000;

export function encodeScenario(input: Scenario): string {
  const canonical = scenarioSchema.parse(input);
  const json = JSON.stringify(canonical);
  if (json.length > maxJsonLength)
    throw new Error("This board is too large to share.");
  const encoded = btoa(strFromU8(zlibSync(strToU8(json)), true))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  if (encoded.length > maxEncodedLength)
    throw new Error("This board is too large to share.");
  return scenarioPrefix + encoded;
}

export function decodeScenario(fragment: string): Scenario {
  const encoded = fragment.slice(scenarioPrefix.length);
  if (
    !fragment.startsWith(scenarioPrefix) ||
    encoded.length > maxEncodedLength ||
    !/^[A-Za-z0-9_-]+$/.test(encoded)
  ) {
    throw new Error("The board link is invalid or too large.");
  }
  try {
    const binary = atob(encoded.replaceAll("-", "+").replaceAll("_", "/"));
    // Limit the output allocation even when the URL is supplied by a third party.
    const json = unzlibSync(strToU8(binary, true), {
      out: new Uint8Array(maxJsonLength + 1),
    });
    if (json.length > maxJsonLength) throw new Error("Board data too large.");
    return scenarioSchema.parse(JSON.parse(strFromU8(json)));
  } catch {
    throw new Error(
      "The board link has invalid data or an unsupported version.",
    );
  }
}
