import { describe, expect, it } from "vitest";
import { buildExecutiveHighlights, goalHealth } from "./executive-highlights";
import type { SalesRow } from "./sales-data";
import type { AttainmentResult } from "./targets";

const row = (p: Partial<SalesRow>): SalesRow =>
  ({ fiscalMonth: 1, monthLabel: "Jan", account: "A", endUser: "X", revenue: 0, ...p }) as SalesRow;
const bucket = (name: string, actual: number, target: number) => ({
  id: name,
  name,
  months: [],
  quarters: [],
  total: { actual, target, attainment: target > 0 ? actual / target : null },
});

describe("executive highlights", () => {
  it("classifies goal health thresholds", () => {
    expect(goalHealth(1)).toBe("above");
    expect(goalHealth(0.9)).toBe("onTrack");
    expect(goalHealth(0.89)).toBe("attention");
    expect(goalHealth(null)).toBe("noTarget");
  });

  it("computes gap, leader, laggard, top customer per account and peak month", () => {
    const attainment: AttainmentResult = {
      buckets: [bucket("M1", 80, 100), bucket("M4", 60, 50)],
    };
    const rows = [
      row({ endUser: "Amazon", account: "A", revenue: 30, fiscalMonth: 2, monthLabel: "Feb" }),
      row({ endUser: "Amazon", account: "B", revenue: 20 }),
      row({ endUser: "Beta", account: "A", revenue: 50 }),
    ];
    const h = buildExecutiveHighlights(rows, attainment);
    expect(h.gap).toBe(10);
    expect(h.leader?.name).toBe("M4");
    expect(h.laggard?.name).toBe("M1");
    expect(h.topCustomer).toMatchObject({ name: "Beta", share: 0.5 });
    expect(h.peakMonth).toEqual({ label: "Jan", revenue: 70 });
  });
});
