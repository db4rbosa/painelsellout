import type { SalesRow } from "./sales-data";

const MONTH_ABBR_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

export type PartnumberPeriodRow = {
  fiscalYear: number;
  fiscalQuarter: number;
  fiscalMonth: number;
  periodLabel: string;
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

const periodLabelFor = (fiscalYear: number, fiscalMonth: number): string => {
  const month = MONTH_ABBR_PT[fiscalMonth - 1] ?? "?";
  return `${month}/${String(fiscalYear % 100).padStart(2, "0")}`;
};

/**
 * Aggregates the already-scoped rows by partnumber, then by fiscal
 * year/month and LOB. Periods are sorted by year and month in ascending
 * order; partnumbers are sorted alphabetically.
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
    const key = JSON.stringify([row.fiscalYear, row.fiscalMonth, row.lob]);
    const period = group.periods.get(key) ?? {
      fiscalYear: row.fiscalYear,
      fiscalQuarter: row.fiscalQuarter,
      fiscalMonth: row.fiscalMonth,
      periodLabel: periodLabelFor(row.fiscalYear, row.fiscalMonth),
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
          a.fiscalMonth - b.fiscalMonth ||
          a.lob.localeCompare(b.lob),
      ),
      lobs: [...group.lobs].sort((a, b) => a.localeCompare(b)),
      quarterMin: group.quarterMin,
      quarterMax: group.quarterMax,
      totalRevenue: group.totalRevenue,
      totalQuantity: group.totalQuantity,
    }))
    .sort((a, b) => a.sku.localeCompare(b.sku));
}

export const quarterRangeLabel = (group: PartnumberGroup): string =>
  group.quarterMin === group.quarterMax
    ? `Q${group.quarterMin}`
    : `Q${group.quarterMin}-Q${group.quarterMax}`;
