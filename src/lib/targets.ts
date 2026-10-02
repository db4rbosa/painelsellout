import type { SalesRow } from "./sales-data";

export type QuarterValues = [number, number, number, number];

export type BucketDefinition = {
  id: string;
  name: string;
  lineOfBusiness: string[];
};

export type Targets = {
  annual: number;
  byBucket: Record<string, QuarterValues>;
};

export const DEFAULT_BUCKETS: BucketDefinition[] = [
  {
    id: "revenue-m1",
    name: "REVENUE - M1",
    lineOfBusiness: ["Mobility", "Printer", "Printers", "Scanner", "Scanners", "Software"],
  },
  {
    id: "services-m4",
    name: "SERVIÇOS - M4",
    lineOfBusiness: ["Service", "Services"],
  },
];

export const emptyQuarterValues = (): QuarterValues => [0, 0, 0, 0];

export const emptyTargets = (buckets: BucketDefinition[] = DEFAULT_BUCKETS): Targets => ({
  annual: 0,
  byBucket: Object.fromEntries(buckets.map((bucket) => [bucket.id, emptyQuarterValues()])),
});

export const groupKey = (accounts: string[]): string =>
  [...accounts].sort((a, b) => a.localeCompare(b)).join(" | ");

export const normalizeLob = (value: string) => value.trim().toLocaleLowerCase("en-US");

export const bucketsForRow = (row: SalesRow, buckets: BucketDefinition[]) => {
  const lob = normalizeLob(row.lob);
  return buckets.filter((bucket) =>
    bucket.lineOfBusiness.some((value) => normalizeLob(value) === lob),
  );
};

export const bucketForRow = (row: SalesRow, buckets: BucketDefinition[]) =>
  bucketsForRow(row, buckets)[0];

export type AttainmentRow = {
  label: string;
  actual: number;
  target: number;
  attainment: number | null;
};

export type QuarterAccounts = Record<number, string[]>;

export type AttainmentTotal = {
  actual: number;
  target: number;
  attainment: number | null;
};

export type BucketAttainment = {
  id: string;
  name: string;
  months: AttainmentRow[];
  quarters: AttainmentRow[];
  total: AttainmentTotal;
};

export type AttainmentResult = {
  buckets: BucketAttainment[];
};

const totalOf = (actual: number, target: number): AttainmentTotal => ({
  actual,
  target,
  attainment: target > 0 ? actual / target : null,
});

const quarterOf = (month: number) => Math.min(4, Math.max(1, Math.ceil(month / 3)));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function buildAttainment(
  rows: SalesRow[],
  targets: Targets,
  buckets: BucketDefinition[] = DEFAULT_BUCKETS,
  selectedQuarters: number[] = [1, 2, 3, 4],
  accountsByQuarter: QuarterAccounts = {},
): AttainmentResult {
  const validQuarters = selectedQuarters.filter(
    (quarter) => Number.isInteger(quarter) && quarter >= 1 && quarter <= 4,
  );
  const selected = new Set(validQuarters.length ? validQuarters : [1, 2, 3, 4]);
  const accountSets = new Map<number, Set<string>>(
    [...selected].map((quarter) => [quarter, new Set(accountsByQuarter[quarter] ?? [])]),
  );

  const actuals = new Map(buckets.map((bucket) => [bucket.id, new Array(12).fill(0) as number[]]));
  for (const row of rows) {
    if (!selected.has(row.fiscalQuarter)) continue;
    const quarterAccounts = accountSets.get(row.fiscalQuarter);
    if (!quarterAccounts?.size || !quarterAccounts.has(row.account)) continue;
    const monthIndex = row.fiscalMonth - 1;
    if (monthIndex < 0 || monthIndex >= 12) continue;
    for (const bucket of bucketsForRow(row, buckets)) {
      const values = actuals.get(bucket.id);
      if (values) values[monthIndex] = (values[monthIndex] ?? 0) + row.revenue;
    }
  }

  return {
    buckets: buckets.map((bucket) => {
      const monthlyActuals = actuals.get(bucket.id) ?? new Array(12).fill(0);
      const quarterTargets = targets.byBucket[bucket.id] ?? emptyQuarterValues();
      const months = monthlyActuals.map((actual, index) => {
        const quarter = quarterOf(index + 1);
        const target = selected.has(quarter) ? (quarterTargets[quarter - 1] ?? 0) / 3 : 0;
        return {
          label: MONTHS[index] ?? String(index + 1),
          actual,
          target,
          attainment: target > 0 ? actual / target : null,
        };
      });
      const quarters = [1, 2, 3, 4].map((quarter) => {
        const actual = monthlyActuals
          .slice((quarter - 1) * 3, quarter * 3)
          .reduce((sum, value) => sum + value, 0);
        const target = quarterTargets[quarter - 1] ?? 0;
        return {
          label: `Q${quarter}`,
          actual,
          target,
          attainment: target > 0 ? actual / target : null,
        };
      });
      const included = [...selected].map((quarter) => quarter - 1);
      const actual = included.reduce((sum, index) => sum + (quarters[index]?.actual ?? 0), 0);
      const target = included.reduce((sum, index) => sum + (quarterTargets[index] ?? 0), 0);
      return { id: bucket.id, name: bucket.name, months, quarters, total: totalOf(actual, target) };
    }),
  };
}
