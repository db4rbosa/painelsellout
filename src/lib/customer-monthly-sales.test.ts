import { describe, expect, it } from "vitest";
import { buildCustomerMonthlySales } from "./customer-monthly-sales";
import type { SalesRow } from "./sales-data";

const row = (values: Partial<SalesRow>): SalesRow => ({
  fiscalYear: 2026, fiscalQuarter: 1, fiscalMonth: 1, fiscalWeek: 1,
  monthLabel: "Jan", lob: "Mobility", disti: "—", reseller: "—", billTo: "—",
  shipTo: "—", endUser: "Cliente A", sku: "SKU", cbm: "—", account: "Account A",
  segment: "—", state: "—", city: "—", revenue: 100, quantity: 1, ...values,
});

describe("monthly customer sales", () => {
  it("finds the largest monthly sale, not the annual leader, and separates services", () => {
    const result = buildCustomerMonthlySales([
      row({ revenue: 500 }), row({ fiscalMonth: 2, revenue: 500 }),
      row({ endUser: "Cliente B", fiscalMonth: 3, monthLabel: "Mar", revenue: 800 }),
      row({ endUser: "Cliente B", fiscalMonth: 3, revenue: -50 }),
      row({ lob: "Service", revenue: 2000 }),
    ]);
    expect(result.maiorVendaMensal).toMatchObject([{ clienteFinal: "Cliente B", mesFiscal: 3, vendasUSD: 750 }]);
    expect(result.maiorReceitaTotalMensal).toMatchObject([{ clienteFinal: "Cliente A", vendasUSD: 500, servicosUSD: 2000, receitaTotalUSD: 2500 }]);
  });
  it("does not combine namesakes across accounts and preserves ties", () => {
    const result = buildCustomerMonthlySales([row({}), row({ account: "Account B" }), row({ endUser: "Cliente B", revenue: 150 })]);
    expect(result.maiorVendaMensal).toMatchObject([{ clienteFinal: "Cliente B", vendasUSD: 150 }]);
    expect(buildCustomerMonthlySales([row({}), row({ account: "Account B" })]).maiorVendaMensal).toHaveLength(2);
    expect(buildCustomerMonthlySales([]).maiorVendaMensal).toEqual([]);
  });
});