import type { SalesRow } from "./sales-data";
import type { AttainmentResult } from "./targets";

export type GoalHealth = "above" | "onTrack" | "attention" | "noTarget";

export type BucketHealth = {
  name: string;
  attainment: number | null;
  gap: number;
  health: GoalHealth;
};

export type ExecutiveHighlights = {
  actual: number;
  target: number;
  attainment: number | null;
  gap: number;
  health: GoalHealth;
  leader: { name: string; attainment: number } | null;
  laggard: { name: string; attainment: number; gap: number } | null;
  bucketHealth: BucketHealth[];
  topCustomer: { name: string; account: string; revenue: number; share: number } | null;
  topCustomers: { name: string; account: string; revenue: number; share: number }[];
  peakMonth: { label: string; revenue: number } | null;
  peakMonths: { label: string; revenue: number }[];
};

/** Classifica a saúde da meta: ≥100% acima, ≥90% no ritmo, abaixo disso atenção. */
export function goalHealth(attainment: number | null): GoalHealth {
  if (attainment === null) return "noTarget";
  if (attainment >= 1) return "above";
  if (attainment >= 0.9) return "onTrack";
  return "attention";
}

export function buildExecutiveHighlights(
  rows: SalesRow[],
  attainment: AttainmentResult,
): ExecutiveHighlights {
  let actual = 0;
  let target = 0;
  const ranked: { name: string; attainment: number; gap: number }[] = [];
  for (const bucket of attainment.buckets) {
    actual += bucket.total.actual;
    target += bucket.total.target;
    if (bucket.total.attainment !== null)
      ranked.push({
        name: bucket.name,
        attainment: bucket.total.attainment,
        gap: Math.max(0, bucket.total.target - bucket.total.actual),
      });
  }
  ranked.sort((a, b) => b.attainment - a.attainment);
  const ratio = target > 0 ? actual / target : null;

  const customers = new Map<string, { name: string; account: string; revenue: number }>();
  const months = new Map<number, { label: string; revenue: number }>();
  let revenue = 0;
  for (const row of rows) {
    revenue += row.revenue;
    const key = `${row.account}\u0000${row.endUser}`;
    const c = customers.get(key) ?? { name: row.endUser, account: row.account, revenue: 0 };
    c.revenue += row.revenue;
    customers.set(key, c);
    const m = months.get(row.fiscalMonth) ?? { label: row.monthLabel, revenue: 0 };
    m.revenue += row.revenue;
    months.set(row.fiscalMonth, m);
  }
  const topCustomers = [...customers.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3)
    .map((c) => ({ ...c, share: revenue !== 0 ? c.revenue / revenue : 0 }));
  const peakMonths = [...months.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  const top = topCustomers[0];
  const peak = peakMonths[0];

  const bucketHealth: BucketHealth[] = attainment.buckets.map((bucket) => ({
    name: bucket.name,
    attainment: bucket.total.attainment,
    gap: Math.max(0, bucket.total.target - bucket.total.actual),
    health: goalHealth(bucket.total.attainment),
  }));

  return {
    actual,
    target,
    attainment: ratio,
    gap: Math.max(0, target - actual),
    health: goalHealth(ratio),
    leader: ranked[0] ? { name: ranked[0].name, attainment: ranked[0].attainment } : null,
    laggard: ranked.length > 1 ? (ranked[ranked.length - 1] ?? null) : null,
    bucketHealth,
    topCustomer: top ?? null,
    topCustomers,
    peakMonth: peak ?? null,
    peakMonths,
  };
}
