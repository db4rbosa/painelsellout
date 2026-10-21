import { describe, expect, it } from "vitest";
import { quarterRangeLabel, summarizePartnumberDetails } from "./partnumber-details";
import type { SalesRow } from "./sales-data";

const row = (values: Partial<SalesRow> = {}): SalesRow => ({
  fiscalYear: 2026, fiscalQuarter: 1, fiscalMonth: 1, fiscalWeek: 1,
  monthLabel: "Jan", sku: "CT45", lob: "Scanners", revenue: 100, quantity: 2,
  account: "Account", endUser: "Cliente", disti: "Disti", reseller: "Revenda",
  billTo: "HQ", shipTo: "Destino", cbm: "—", segment: "KAM", state: "SP", city: "São Paulo",
  ...values,
});

describe("partnumber details", () => {
  it("sums repeated partnumbers per month and LOB, including returns", () => {
    const result = summarizePartnumberDetails([
      row(), row({ fiscalWeek: 2, revenue: 50, quantity: 3 }),
      row({ revenue: -10, quantity: -1 }), row({ lob: "Software", revenue: 20, quantity: 1 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.rows).toHaveLength(2);
    expect(result[0]).toMatchObject({ totalRevenue: 160, totalQuantity: 5, lobs: ["Scanners", "Software"] });
    expect(result[0]?.rows[0]).toMatchObject({ lob: "Scanners", revenue: 140, quantity: 4, periodLabel: "jan/26" });
  });

  it("orders months ascending within each partnumber and labels periods as month/year", () => {
    const result = summarizePartnumberDetails([
      row({ fiscalQuarter: 4, fiscalMonth: 10, revenue: 10 }),
      row({ fiscalQuarter: 3, fiscalMonth: 9, revenue: 20 }),
      row({ fiscalQuarter: 3, fiscalMonth: 8, revenue: 30 }),
      row({ fiscalQuarter: 1, fiscalMonth: 2, revenue: 40 }),
    ]);
    expect(result[0]?.rows.map(({ fiscalMonth, periodLabel }) => [fiscalMonth, periodLabel])).toEqual([
      [2, "fev/26"], [8, "ago/26"], [9, "set/26"], [10, "out/26"],
    ]);
    expect(quarterRangeLabel(result[0]!)).toBe("Q1-Q4");
  });

  it("orders partnumbers alphabetically and labels a single quarter", () => {
    const result = summarizePartnumberDetails([
      row({ sku: "BBB", revenue: 500 }),
      row({ sku: "AAA", revenue: 10 }),
      row({ sku: "AAA", revenue: 5 }),
    ]);
    expect(result.map((group) => group.sku)).toEqual(["AAA", "BBB"]);
    expect(quarterRangeLabel(result[0]!)).toBe("Q1");
  });
});
