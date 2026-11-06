import type { AttainmentResult, BucketDefinition, QuarterValues } from "./targets";

export type RecordedPayment = {
  id: string;
  quarter: number;
  month: number;
  year: number;
  amount: number;
};

export type CompensationSettings = {
  salaryAtQaf: number;
  opiPercent: number;
  quarterShares: QuarterValues;
  bucketWeights: Record<string, number>;
  payments: RecordedPayment[];
};

export const defaultCompensation = (): CompensationSettings => ({
  salaryAtQaf: 0,
  opiPercent: 0,
  quarterShares: [25, 25, 25, 25],
  bucketWeights: {},
  payments: [],
});

const nonNegative = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;

const normalizePayments = (raw: unknown): RecordedPayment[] =>
  Array.isArray(raw)
    ? raw.flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const r = item as Record<string, unknown>;
        const quarter = Number(r["quarter"]);
        const month = Number(r["month"]);
        const year = Number(r["year"]);
        if (![1, 2, 3, 4].includes(quarter) || month < 1 || month > 12 || !Number.isInteger(year))
          return [];
        return [{
          id: typeof r["id"] === "string" && r["id"] ? r["id"] : `p${index}`,
          quarter, month, year,
          amount: typeof r["amount"] === "number" && Number.isFinite(r["amount"]) ? r["amount"] : 0,
        }];
      })
    : [];

export function normalizeCompensation(raw: unknown): CompensationSettings {
  const base = defaultCompensation();
  if (!raw || typeof raw !== "object") return base;
  const record = raw as Record<string, unknown>;
  const shares = Array.isArray(record["quarterShares"]) ? record["quarterShares"] : base.quarterShares;
  const weights = record["bucketWeights"] && typeof record["bucketWeights"] === "object"
    ? record["bucketWeights"] as Record<string, unknown> : {};
  return {
    salaryAtQaf: nonNegative(record["salaryAtQaf"]),
    opiPercent: Math.min(100, nonNegative(record["opiPercent"])),
    quarterShares: [0, 1, 2, 3].map((index) => Math.min(100, nonNegative(shares[index]))) as QuarterValues,
    bucketWeights: Object.fromEntries(Object.entries(weights).map(([id, value]) => [id, Math.min(100, nonNegative(value))])),
    payments: normalizePayments(record["payments"]),
  };
}

/** Compares calculated payouts (Q4 includes the annual accelerator true-up) with recorded payments. */
export function reconcilePayments(
  result: { quarters: { amount: number | null }[]; annual: { amount: number | null } },
  payments: RecordedPayment[],
) {
  const quarters = [1, 2, 3, 4].map((quarter) => {
    const calculated = result.quarters[quarter - 1]?.amount ?? null;
    const paid = payments.filter((p) => p.quarter === quarter).reduce((s, p) => s + p.amount, 0);
    const difference = calculated === null ? null : calculated - paid;
    return { quarter, calculated, paid, difference, missing: difference === null ? null : Math.max(0, difference) };
  });
  const totalPaid = quarters.reduce((s, q) => s + q.paid, 0);
  const annualDue = result.annual.amount;
  return {
    quarters,
    totalPaid,
    annualDue,
    annualRemaining: annualDue === null ? null : annualDue - totalPaid,
  };
}

/** Per-quarter chart series: expected at 100%, calculated payout, and what was already paid. */
export function paymentChartSeries(
  result: { quarters: { base: number; amount: number | null }[]; issues: string[] },
  selectedQuarters: number[],
  payments: RecordedPayment[],
) {
  return selectedQuarters.map((quarter) => {
    const payout = result.quarters[quarter - 1];
    const paid = payments
      .filter((p) => p.quarter === quarter)
      .reduce((sum, p) => sum + p.amount, 0);
    return {
      period: `Q${quarter}`,
      expected: result.issues.length ? null : (payout?.base ?? null),
      calculated: payout?.amount ?? null,
      paid,
    };
  });
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
  const regular = [0, 1, 2, 3].map((index) => period(index));
  const annual = period();
  // SAP/Callidus YTD rule: through quarter k, attainment = YTD actual / YTD target per bucket,
  // capped at 100% for Q1–Q3; quarter pays cumulative due minus what was due before (catch-up).
  const ytd = (k: number, accelerated: boolean) => {
    const base = annualBase * settings.quarterShares.slice(0, k + 1).reduce((s, v) => s + v, 0) / 100;
    let amount = 0;
    for (const bucket of buckets) {
      const weight = weights[bucket.id] ?? 0;
      if (weight === 0) continue;
      const data = annualAttainment.buckets.find((item) => item.id === bucket.id);
      const rows = data?.quarters.slice(0, k + 1) ?? [];
      const target = rows.reduce((s, r) => s + r.target, 0);
      if (!(target > 0)) return null;
      const actual = rows.reduce((s, r) => s + r.actual, 0);
      amount += base * weight / 100 * payoutRate(actual / target, accelerated);
    }
    return issues.length ? null : amount;
  };
  const cumulativeDue = [0, 1, 2].map((k) => ytd(k, false));
  // Hybrid rule: prior quarters deduct the officially recorded payment when one exists,
  // otherwise the theoretical amount calculated from the spreadsheet.
  const paidByQuarter = [1, 2, 3, 4].map((q) => {
    const list = (settings.payments ?? []).filter((p) => p.quarter === q);
    return list.length ? list.reduce((s, p) => s + p.amount, 0) : null;
  });
  const deducted: (number | null)[] = [];
  const priorDeducted = (index: number) =>
    deducted.slice(0, index).reduce<number | null>((s, v) => (s === null || v === null ? null : s + v), 0);
  const quarters = regular.map((quarter, index) => {
    if (index < 3) {
      const cum = cumulativeDue[index] ?? null;
      const prev = priorDeducted(index);
      const amount = cum === null || prev === null ? null : Math.max(0, cum - prev);
      deducted.push(paidByQuarter[index] ?? amount);
      const catchUp = amount === null || quarter.amount === null ? 0 : Math.max(0, amount - quarter.amount);
      const accel = ytd(index, true);
      const heldAccelerator = accel === null || cum === null ? 0 : Math.max(0, accel - cum);
      return { ...quarter, regularAmount: quarter.amount, catchUp, cumulativeDue: cum, heldAccelerator, trueUp: 0, amount };
    }
    const paidBefore = priorDeducted(3);
    const amount = annual.amount === null || paidBefore === null ? null : Math.max(0, annual.amount - paidBefore);
    const trueUp = amount === null || quarter.amount === null ? 0 : Math.max(0, amount - quarter.amount);
    return { ...quarter, regularAmount: quarter.amount, catchUp: 0, cumulativeDue: annual.amount, heldAccelerator: 0, trueUp, amount };
  });
  const quarterlyTotal = quarters.every((quarter) => quarter.amount !== null)
    ? quarters.reduce((sum, quarter) => sum + (quarter.amount ?? 0), 0) : null;
  return { annualBase, issues, quarters, annual, quarterlyTotal };
}