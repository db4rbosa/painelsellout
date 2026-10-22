import type { SalesRow } from "./sales-data";

export type PartnumberQuarterRow = {
  fiscalQuarter: number;
  lob: string;
  revenue: number;
  quantity: number;
};

export type PartnumberGroup = {
  sku: string;
  description: string;
  rows: PartnumberQuarterRow[];
  lobs: string[];
  quarterMin: number;
  quarterMax: number;
  totalRevenue: number;
  totalQuantity: number;
};

export type EndUserPartnumberGroup = {
  endUser: string;
  account: string;
  partnumbers: PartnumberGroup[];
  totalRevenue: number;
  totalQuantity: number;
};

/**
 * Aggregates already-scoped rows by partnumber, then by fiscal quarter and
 * LOB. Quarters ascend within each partnumber; partnumbers are alphabetical.
 */
export function summarizePartnumberDetails(rows: SalesRow[]): PartnumberGroup[] {
  const bySku = new Map<
    string,
    {
      description: string;
      quarters: Map<string, PartnumberQuarterRow>;
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
        description: "",
        quarters: new Map(),
        lobs: new Set(),
        quarterMin: row.fiscalQuarter,
        quarterMax: row.fiscalQuarter,
        totalRevenue: 0,
        totalQuantity: 0,
      };
      bySku.set(sku, group);
    }
    if (!group.description && row.description?.trim()) group.description = row.description.trim();
    const key = JSON.stringify([row.fiscalQuarter, row.lob]);
    const quarter = group.quarters.get(key) ?? {
      fiscalQuarter: row.fiscalQuarter,
      lob: row.lob,
      revenue: 0,
      quantity: 0,
    };
    quarter.revenue += row.revenue;
    quarter.quantity += row.quantity;
    group.quarters.set(key, quarter);
    group.lobs.add(row.lob);
    group.quarterMin = Math.min(group.quarterMin, row.fiscalQuarter);
    group.quarterMax = Math.max(group.quarterMax, row.fiscalQuarter);
    group.totalRevenue += row.revenue;
    group.totalQuantity += row.quantity;
  }

  return [...bySku.entries()]
    .map(([sku, group]) => ({
      sku,
      description: group.description,
      rows: [...group.quarters.values()].sort(
        (a, b) => a.fiscalQuarter - b.fiscalQuarter || a.lob.localeCompare(b.lob),
      ),
      lobs: [...group.lobs].sort((a, b) => a.localeCompare(b)),
      quarterMin: group.quarterMin,
      quarterMax: group.quarterMax,
      totalRevenue: group.totalRevenue,
      totalQuantity: group.totalQuantity,
    }))
    .sort((a, b) => a.sku.localeCompare(b.sku));
}

/** Groups rows by End User (kept apart per Account), then by partnumber. Alphabetical. */
export function summarizeEndUserPartnumbers(rows: SalesRow[]): EndUserPartnumberGroup[] {
  const byCustomer = new Map<string, SalesRow[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.endUser, row.account]);
    const list = byCustomer.get(key);
    if (list) list.push(row);
    else byCustomer.set(key, [row]);
  }
  return [...byCustomer.entries()]
    .map(([key, list]) => {
      const [endUser, account] = JSON.parse(key) as [string, string];
      const partnumbers = summarizePartnumberDetails(list);
      return {
        endUser,
        account,
        partnumbers,
        totalRevenue: partnumbers.reduce((s, p) => s + p.totalRevenue, 0),
        totalQuantity: partnumbers.reduce((s, p) => s + p.totalQuantity, 0),
      };
    })
    .sort((a, b) => a.endUser.localeCompare(b.endUser) || a.account.localeCompare(b.account));
}

export const quarterRangeLabel = (group: PartnumberGroup): string =>
  group.quarterMin === group.quarterMax
    ? `Q${group.quarterMin}`
    : `Q${group.quarterMin}-Q${group.quarterMax}`;
