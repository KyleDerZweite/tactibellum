import { describe, expect, it } from "vitest";
import catalog from "../../../data/patches/latest.json";
import { loadPatchData } from "../game-data";
import { calculateBreakpoint } from "./index";

const patch = loadPatchData(catalog);
const crawler = { unitId: "10", level: 1, techIds: [] };
const marksman = { unitId: "2", level: 1, techIds: [] };

describe("stationary breakpoints", () => {
  it("counts individual hits and measures elapsed time after first contact", () => {
    expect(calculateBreakpoint(patch, crawler, crawler)).toMatchObject({
      status: "available",
      hp: 250,
      damage: 79,
      hits: 4,
      oneHit: false,
    });
    const result = calculateBreakpoint(patch, crawler, crawler);
    expect(result.status === "available" && result.ttkSeconds).toBeCloseTo(1.8);
    expect(calculateBreakpoint(patch, marksman, crawler)).toMatchObject({
      oneHit: true,
      ttkSeconds: 0,
    });
  });
  it("scales by level, sums enhancements and truncates once", () => {
    expect(
      calculateBreakpoint(
        patch,
        { ...crawler, level: 2, techIds: ["10710"], itemIds: ["13030004"] },
        { ...crawler, level: 3, itemId: "13030002" },
      ),
    ).toMatchObject({ damage: 395, hp: 1312, hits: 4 });
  });
  it("reports all unsupported selections and domain mismatches", () => {
    const result = calculateBreakpoint(
      patch,
      { ...crawler, techIds: ["missing"], level: 10 },
      { ...crawler, unitId: "6", itemIds: ["missing"] },
    );
    expect(result.status === "unavailable" && result.reasons).toHaveLength(4);
  });
  it("allows complex weapons as targets and refuses to predict their hits", () => {
    const fortress = { ...crawler, unitId: "1" };
    expect(calculateBreakpoint(patch, crawler, fortress).status).toBe(
      "available",
    );
    expect(calculateBreakpoint(patch, fortress, crawler).status).toBe(
      "unavailable",
    );
  });
  it("accepts a legacy unit without stats and reports missing data", () => {
    const legacy = loadPatchData({
      ...catalog,
      units: { 2: { ...catalog.units["2"], combat: undefined } },
    });
    expect(calculateBreakpoint(legacy, marksman, marksman).status).toBe(
      "unavailable",
    );
  });
});
