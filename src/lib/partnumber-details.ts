import type { SalesRow } from "./sales-data";

export type PartnumberPeriodRow = {
  fiscalYear: number;
  fiscalQuarter: number;
  fiscalWeek: number;
  lob: string;
  revenue: number;
  quantity: number;
};

export type PartnumberGroup = {
  sku: string;
  rows: PartnumberPeriodRow[];
  lobs: string[];
  quarterMin: number;
  quarterMax: number;
  totalRevenue: number;
  totalQuantity: number;
};

/**
 * Aggregates the already-scoped rows by partnumber, then by fiscal
 * year/quarter/week and LOB. Periods are sorted by quarter and week in
 * ascending order; partnumbers are sorted by total revenue descending.
 */
export function summarizePartnumberDetails(rows: SalesRow[]): PartnumberGroup[] {
  const bySku = new Map<
    string,
    {
      periods: Map<string, PartnumberPeriodRow>;
      lobs: Set<string>;
      quarterMin: number;
      quarterMax: number;
      totalRevenue: number;
      totalQuantity: number;
    }
  >();

  for (const row of rows) {
    const sku = row.sku.trim() || "—";
    let group = bySku.get(sku);
    if (!group) {
      group = {
        periods: new Map(),
        lobs: new Set(),
        quarterMin: row.fiscalQuarter,
        quarterMax: row.fiscalQuarter,
        totalRevenue: 0,
        totalQuantity: 0,
      };
      bySku.set(sku, group);
    }
    const key = JSON.stringify([row.fiscalYear, row.fiscalQuarter, row.fiscalWeek, row.lob]);
    const period = group.periods.get(key) ?? {
      fiscalYear: row.fiscalYear,
      fiscalQuarter: row.fiscalQuarter,
      fiscalWeek: row.fiscalWeek,
      lob: row.lob,
      revenue: 0,
      quantity: 0,
    };
    period.revenue += row.revenue;
    period.quantity += row.quantity;
    group.periods.set(key, period);
    group.lobs.add(row.lob);
    group.quarterMin = Math.min(group.quarterMin, row.fiscalQuarter);
    group.quarterMax = Math.max(group.quarterMax, row.fiscalQuarter);
    group.totalRevenue += row.revenue;
    group.totalQuantity += row.quantity;
  }

  return [...bySku.entries()]
    .map(([sku, group]) => ({
      sku,
      rows: [...group.periods.values()].sort(
        (a, b) =>
          a.fiscalYear - b.fiscalYear ||
          a.fiscalQuarter - b.fiscalQuarter ||
          a.fiscalWeek - b.fiscalWeek ||
          a.lob.localeCompare(b.lob),
      ),
      lobs: [...group.lobs].sort((a, b) => a.localeCompare(b)),
      quarterMin: group.quarterMin,
      quarterMax: group.quarterMax,
      totalRevenue: group.totalRevenue,
      totalQuantity: group.totalQuantity,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue || a.sku.localeCompare(b.sku));
}

export const quarterRangeLabel = (group: PartnumberGroup): string =>
  group.quarterMin === group.quarterMax
    ? `Q${group.quarterMin}`
    : `Q${group.quarterMin}-Q${group.quarterMax}`;
