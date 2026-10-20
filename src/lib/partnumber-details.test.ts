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
  it("sums repeated partnumbers per week and LOB, including returns", () => {
    const result = summarizePartnumberDetails([
      row(), row({ revenue: 50, quantity: 3 }),
      row({ revenue: -10, quantity: -1 }), row({ lob: "Software", revenue: 20, quantity: 1 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.rows).toHaveLength(2);
    expect(result[0]).toMatchObject({ totalRevenue: 160, totalQuantity: 5, lobs: ["Scanners", "Software"] });
    expect(result[0]?.rows[0]).toMatchObject({ lob: "Scanners", revenue: 140, quantity: 4 });
  });

  it("orders quarters and weeks ascending within each partnumber", () => {
    const result = summarizePartnumberDetails([
      row({ fiscalQuarter: 4, fiscalWeek: 40, revenue: 10 }),
      row({ fiscalQuarter: 3, fiscalWeek: 35, revenue: 20 }),
      row({ fiscalQuarter: 3, fiscalWeek: 30, revenue: 30 }),
      row({ fiscalQuarter: 1, fiscalWeek: 5, revenue: 40 }),
    ]);
    expect(result[0]?.rows.map(({ fiscalQuarter, fiscalWeek }) => [fiscalQuarter, fiscalWeek])).toEqual([
      [1, 5], [3, 30], [3, 35], [4, 40],
    ]);
    expect(quarterRangeLabel(result[0]!)).toBe("Q1-Q4");
  });

  it("orders partnumbers by total revenue descending and labels a single quarter", () => {
    const result = summarizePartnumberDetails([
      row({ sku: "AAA", revenue: 10 }),
      row({ sku: "BBB", revenue: 500 }),
      row({ sku: "AAA", revenue: 5 }),
    ]);
    expect(result.map((group) => group.sku)).toEqual(["BBB", "AAA"]);
    expect(quarterRangeLabel(result[0]!)).toBe("Q1");
  });
});
