import { describe, expect, it } from "vitest";
import {
  quarterRangeLabel,
  summarizeEndUserPartnumbers,
  summarizePartnumberDetails,
} from "./partnumber-details";
import type { SalesRow } from "./sales-data";

const row = (values: Partial<SalesRow> = {}): SalesRow => ({
  fiscalYear: 2026, fiscalQuarter: 1, fiscalMonth: 1, fiscalWeek: 1,
  monthLabel: "Jan", sku: "CT45", lob: "Scanners", revenue: 100, quantity: 2,
  account: "Account", endUser: "Cliente", disti: "Disti", reseller: "Revenda",
  billTo: "HQ", shipTo: "Destino", cbm: "—", segment: "KAM", state: "SP", city: "São Paulo",
  ...values,
});

describe("partnumber details", () => {
  it("sums all months of a quarter and LOB into one row, including returns", () => {
    const result = summarizePartnumberDetails([
      row(), row({ fiscalMonth: 2, revenue: 50, quantity: 3 }),
      row({ fiscalMonth: 3, revenue: -10, quantity: -1 }), row({ lob: "Software", revenue: 20, quantity: 1 }),
    ]);
    expect(result[0]?.rows).toHaveLength(2);
    expect(result[0]).toMatchObject({ totalRevenue: 160, totalQuantity: 5 });
    expect(result[0]?.rows[0]).toMatchObject({ fiscalQuarter: 1, lob: "Scanners", revenue: 140, quantity: 4 });
  });

  it("orders quarters ascending and keeps the product description", () => {
    const result = summarizePartnumberDetails([
      row({ fiscalQuarter: 4, description: "Leitor" }),
      row({ fiscalQuarter: 2 }),
    ]);
    expect(result[0]?.rows.map((r) => r.fiscalQuarter)).toEqual([2, 4]);
    expect(result[0]?.description).toBe("Leitor");
    expect(quarterRangeLabel(result[0]!)).toBe("Q2-Q4");
  });

  it("orders partnumbers alphabetically", () => {
    const result = summarizePartnumberDetails([row({ sku: "BBB", revenue: 500 }), row({ sku: "AAA" })]);
    expect(result.map((group) => group.sku)).toEqual(["AAA", "BBB"]);
  });

  it("groups by end user per account before partnumber", () => {
    const result = summarizeEndUserPartnumbers([
      row({ endUser: "Zeta" }), row({ endUser: "Alfa", account: "B" }), row({ endUser: "Alfa", account: "A" }),
    ]);
    expect(result.map((g) => [g.endUser, g.account])).toEqual([["Alfa", "A"], ["Alfa", "B"], ["Zeta", "Account"]]);
    expect(result[0]?.totalRevenue).toBe(100);
  });
});
