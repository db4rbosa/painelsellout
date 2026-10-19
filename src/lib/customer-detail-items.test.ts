import { describe, expect, it } from "vitest";
import { summarizeCustomerItems } from "./customer-detail-items";
import type { SalesRow } from "./sales-data";

const row = (values: Partial<SalesRow> = {}): SalesRow => ({
  fiscalYear: 2026, fiscalQuarter: 1, fiscalMonth: 1, fiscalWeek: 1,
  monthLabel: "Jan", sku: "CT45", lob: "Mobility", revenue: 100, quantity: 2,
  account: "Account", endUser: "Cliente", disti: "Disti", reseller: "Revenda",
  billTo: "HQ", shipTo: "Destino", cbm: "—", segment: "KAM", state: "SP", city: "São Paulo",
  ...values,
});

describe("customer detail items", () => {
  it("sums repeated partnumbers within a month across transactions and LOBs, including returns", () => {
    const result = summarizeCustomerItems([
      row(), row({ fiscalWeek: 2, revenue: 50, quantity: 3, lob: "Software" }),
      row({ revenue: -10, quantity: -1 }), row({ sku: "CT47", revenue: 20, quantity: 1 }),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ sku: "CT45", revenue: 140, quantity: 4, lob: "Mobility · Software" });
    expect(result.reduce((total, item) => total + item.revenue, 0)).toBe(160);
    expect(result.reduce((total, item) => total + item.quantity, 0)).toBe(5);
  });

  it("orders year, quarter and month descending without merging the same partnumber across periods", () => {
    const result = summarizeCustomerItems([
      row({ revenue: 900 }),
      row({ fiscalQuarter: 4, fiscalMonth: 10, monthLabel: "Oct", revenue: 200 }),
      row({ fiscalQuarter: 3, fiscalMonth: 9, monthLabel: "Sep", revenue: 500 }),
      row({ fiscalQuarter: 4, fiscalMonth: 12, monthLabel: "Dec", revenue: 10 }),
      row({ fiscalYear: 2025, fiscalQuarter: 4, fiscalMonth: 12, revenue: 1000 }),
    ]);
    expect(result.map(({ fiscalYear, fiscalQuarter, fiscalMonth, revenue }) =>
      [fiscalYear, fiscalQuarter, fiscalMonth, revenue],
    )).toEqual([[2026, 4, 12, 10], [2026, 4, 10, 200], [2026, 3, 9, 500], [2026, 1, 1, 900], [2025, 4, 12, 1000]]);
  });
});