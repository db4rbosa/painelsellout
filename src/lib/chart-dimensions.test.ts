import { describe, expect, it } from "vitest";
import { CHART_DIMENSIONS, chartGrouping } from "./chart-dimensions";

describe("chart grouping choices", () => {
  for (const key of ["billTo", "shipTo", "state", "city"] as const) {
    it(`excludes ${key} and migrates its saved grouping`, () => {
      expect(CHART_DIMENSIONS.map((dimension) => dimension.key)).not.toContain(key);
      expect(chartGrouping(key)).toBe("lob");
    });
  }
  it("preserves customer and reseller grouping", () => {
    expect(chartGrouping("endUser")).toBe("endUser");
    expect(chartGrouping("reseller")).toBe("reseller");
  });
});