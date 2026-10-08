import type { AttainmentResult, BucketDefinition, QuarterValues } from "./targets";

export type CompensationSettings = {
  salaryAtQaf: number;
  opiPercent: number;
  quarterShares: QuarterValues;
  bucketWeights: Record<string, number>;
};

export const defaultCompensation = (): CompensationSettings => ({
  salaryAtQaf: 0,
  opiPercent: 0,
  quarterShares: [25, 25, 25, 25],
  bucketWeights: {},
});

const nonNegative = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;

export function normalizeCompensation(raw: unknown): CompensationSettings {
  const base = defaultCompensation();
  if (!raw || typeof raw !== "object") return base;
  const record = raw as Record<string, unknown>;
  const shares = Array.isArray(record.quarterShares) ? record.quarterShares : base.quarterShares;
  const weights = record.bucketWeights && typeof record.bucketWeights === "object"
    ? record.bucketWeights as Record<string, unknown> : {};
  return {
    salaryAtQaf: nonNegative(record.salaryAtQaf),
    opiPercent: Math.min(100, nonNegative(record.opiPercent)),
    quarterShares: [0, 1, 2, 3].map((index) => Math.min(100, nonNegative(shares[index]))) as QuarterValues,
    bucketWeights: Object.fromEntries(Object.entries(weights).map(([id, value]) => [id, Math.min(100, nonNegative(value))])),
  };
}

export function resolvedBucketWeights(settings: CompensationSettings, buckets: BucketDefinition[]) {
  const hasWeights = buckets.some((bucket) => settings.bucketWeights[bucket.id] !== undefined);
  return Object.fromEntries(buckets.map((bucket, index) => [bucket.id, hasWeights
    ? settings.bucketWeights[bucket.id] ?? 0
    : index === buckets.length - 1
      ? 100 - Math.floor(10000 / buckets.length) / 100 * index
      : Math.floor(10000 / buckets.length) / 100]));
}

export function compensationIssues(settings: CompensationSettings, buckets: BucketDefinition[]) {
  const issues: string[] = [];
  if (settings.salaryAtQaf <= 0) issues.push("Informe o salário na assinatura do QAF.");
  if (settings.opiPercent <= 0) issues.push("Informe o percentual do OPI.");
  if (Math.abs(settings.quarterShares.reduce((sum, value) => sum + value, 0) - 100) > 0.000001)
    issues.push("A distribuição dos quarters deve somar 100%.");
  const weights = resolvedBucketWeights(settings, buckets);
  if (Math.abs(Object.values(weights).reduce((sum, value) => sum + value, 0) - 100) > 0.000001)
    issues.push("Os pesos dos bolsos devem somar 100%.");
  return issues;
}

// Ratios in, payout ratios out. Preserve the literal increment and explicit 100% anchor.
export function payoutRate(attainment: number, annual: boolean): number {
  if (!Number.isFinite(attainment) || attainment < 0.6) return 0;
  if (attainment < 1) return (46.66 + (attainment * 100 - 60) * 1.333) / 100;
  if (!annual) return 1;
  if (attainment <= 1.5) return 1 + (attainment - 1) * 2.5;
  if (attainment <= 2) return 2.25 + (attainment - 1.5);
  return 2.75;
}

export function calculateCompensation(
  settings: CompensationSettings,
  buckets: BucketDefinition[],
  annualAttainment: AttainmentResult,
) {
  const issues = compensationIssues(settings, buckets);
  const annualBase = 13 * settings.salaryAtQaf * settings.opiPercent / 100;
  const weights = resolvedBucketWeights(settings, buckets);
  const period = (quarterIndex?: number) => {
    const base = annualBase * (quarterIndex === undefined ? 1 : (settings.quarterShares[quarterIndex] ?? 0) / 100);
    const details = buckets.map((bucket) => {
      const data = annualAttainment.buckets.find((item) => item.id === bucket.id);
      const result = quarterIndex === undefined ? data?.total : data?.quarters[quarterIndex];
      const weight = weights[bucket.id] ?? 0;
      const rate = result?.attainment === null || result?.attainment === undefined
        ? null : payoutRate(result.attainment, quarterIndex === undefined);
      const amount = rate === null ? null : base * weight / 100 * rate;
      return { id: bucket.id, name: bucket.name, attainment: result?.attainment ?? null, weight, rate, amount };
    });
    const valid = !issues.length && details.every((item) => item.weight === 0 || item.rate !== null);
    return { base, details, amount: valid ? details.reduce((sum, item) => sum + (item.amount ?? 0), 0) : null };
  };
  const quarters = [0, 1, 2, 3].map((index) => period(index));
  const annual = period();
  const quarterlyTotal = quarters.every((quarter) => quarter.amount !== null)
    ? quarters.reduce((sum, quarter) => sum + (quarter.amount ?? 0), 0) : null;
  return { annualBase, issues, quarters, annual, quarterlyTotal };
}