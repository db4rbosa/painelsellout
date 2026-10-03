import { describe, expect, it } from "vitest";
import { buildCustomerSkuDetail } from "./customer-sku-detail";
import { emptyFilters, FILTER_LABELS, type SalesRow } from "./sales-data";

const row = (overrides: Partial<SalesRow>): SalesRow => ({
  fiscalYear: 2026,
  fiscalQuarter: 1,
  fiscalMonth: 1,
  fiscalWeek: 1,
  monthLabel: "Jan",
  lob: "Mobility",
  disti: "Distribuidor",
  reseller: "Revenda",
  billTo: "Revenda HQ",
  shipTo: "Destino",
  endUser: "Lojas Riachuelo",
  sku: "CT45",
  cbm: "—",
  account: "Raphael Manso",
  segment: "KAM",
  state: "SP",
  city: "São Paulo",
  revenue: 100,
  quantity: 1,
  ...overrides,
});

const build = (question: string, rows: SalesRow[], overrides: Partial<Parameters<typeof buildCustomerSkuDetail>[0]> = {}) =>
  buildCustomerSkuDetail({
    question,
    rows,
    accounts: ["Raphael Manso"],
    selectedQuarters: [1, 2, 3, 4],
    accountsByQuarter: {
      1: ["Raphael Manso"],
      2: ["Raphael Manso"],
      3: ["Raphael Manso"],
      4: ["Raphael Manso"],
    },
    filters: emptyFilters(),
    filterLabels: FILTER_LABELS,
    ...overrides,
  });

describe("buildCustomerSkuDetail", () => {
  it("groups every SKU, keeps negatives and separates services", () => {
    const rows = [
      row({ revenue: 100, quantity: 2 }),
      row({ revenue: -10, quantity: -1 }),
      row({ lob: "Service", sku: "—", revenue: 25, quantity: 1 }),
      ...Array.from({ length: 16 }, (_, index) =>
        row({ sku: `SKU-${index}`, lob: "Software", revenue: index + 1, quantity: 1 }),
      ),
    ];
    const result = build("Quais SKUs foram vendidos para a Riachuelo?", rows);
    expect(result.status).toBe("completo");
    if (result.status !== "completo") return;
    expect(result.itens).toHaveLength(18);
    expect(result.itens.find((item) => item.sku === "CT45")).toMatchObject({
      quantidade: 1,
      receitaUSD: 90,
      categoria: "Vendas",
    });
    expect(result.itens.find((item) => item.sku === "SKU não informado")?.categoria).toBe("Serviços");
    expect(result.subtotais.Serviços.receitaUSD).toBe(25);
    expect(result.subtotais["Total geral"].receitaUSD).toBe(235);
  });

  it("respects quarter and account selections", () => {
    const rows = [
      row({ fiscalQuarter: 1, revenue: 100 }),
      row({ fiscalQuarter: 2, revenue: 200 }),
      row({ fiscalQuarter: 1, account: "Outro Account", revenue: 300 }),
    ];
    const result = build("Riachuelo", rows, {
      selectedQuarters: [1],
      accountsByQuarter: { 1: ["Raphael Manso"], 2: [], 3: [], 4: [] },
    });
    expect(result.status).toBe("completo");
    if (result.status !== "completo") return;
    expect(result.subtotais["Total geral"].receitaUSD).toBe(100);
  });

  it("does not merge ambiguous customer matches", () => {
    const result = build("Mostre as vendas da Amazon", [
      row({ endUser: "Amazon Brasil" }),
      row({ endUser: "Amazon Serviços" }),
    ]);
    expect(result.status).toBe("ambiguo");
    if (result.status !== "ambiguo") return;
    expect(result.clientesPossiveis).toEqual(["Amazon Brasil", "Amazon Serviços"]);
  });
});