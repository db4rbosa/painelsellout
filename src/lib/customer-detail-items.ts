import type { SalesRow } from "./sales-data";

export type CustomerDetailItem = Pick<
  SalesRow,
  "fiscalYear" | "fiscalQuarter" | "fiscalMonth" | "monthLabel" | "sku" | "revenue" | "quantity"
> & { lob: string };

/** Input is already scoped to one customer/Account and the dashboard filters. */
export function summarizeCustomerItems(rows: SalesRow[]): CustomerDetailItem[] {
  const groups = new Map<string, { item: CustomerDetailItem; lobs: Set<string> }>();
  for (const row of rows) {
    const sku = row.sku.trim() || "—";
    const key = JSON.stringify([row.fiscalYear, row.fiscalQuarter, row.fiscalMonth, sku]);
    const group = groups.get(key) ?? {
      item: {
        fiscalYear: row.fiscalYear,
        fiscalQuarter: row.fiscalQuarter,
        fiscalMonth: row.fiscalMonth,
        monthLabel: row.monthLabel,
        sku,
        lob: "",
        revenue: 0,
        quantity: 0,
      },
      lobs: new Set<string>(),
    };
    group.item.revenue += row.revenue;
    group.item.quantity += row.quantity;
    group.lobs.add(row.lob);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(({ item, lobs }) => ({ ...item, lob: [...lobs].sort().join(" · ") }))
    .sort((a, b) =>
      b.fiscalYear - a.fiscalYear ||
      b.fiscalQuarter - a.fiscalQuarter ||
      b.fiscalMonth - a.fiscalMonth ||
      b.revenue - a.revenue ||
      a.sku.localeCompare(b.sku),
    );
}