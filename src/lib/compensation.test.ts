import { describe, expect, it } from "vitest";
import {
  calculateCompensation,
  compensationIssues,
  defaultCompensation,
  payoutRate,
  resolvedBucketWeights,
  type CompensationSettings,
} from "./compensation";
import { defaultPrefs, normalizePrefs } from "./prefs";
import { buildAttainment, type AttainmentResult, type BucketDefinition } from "./targets";
import type { SalesRow } from "./sales-data";

const buckets: BucketDefinition[] = [
  { id: "m1", name: "M1", lineOfBusiness: ["Mobility"] },
  { id: "m4", name: "M4", lineOfBusiness: ["Service"] },
];
const settings: CompensationSettings = {
  salaryAtQaf: 10000,
  opiPercent: 20,
  quarterShares: [10, 20, 30, 40],
  bucketWeights: { m1: 70, m4: 30 },
};
const attainment = (m1: number | null, m4: number | null): AttainmentResult => ({
  buckets: buckets.map((bucket, index) => {
    const ratio = index === 0 ? m1 : m4;
    return {
      ...bucket,
      months: [],
      quarters: [1, 2, 3, 4].map((q) => ({
        label: `Q${q}`,
        actual: (ratio ?? 0) * 100,
        target: ratio === null ? 0 : 100,
        attainment: ratio,
      })),
      total: { actual: (ratio ?? 0) * 400, target: ratio === null ? 0 : 400, attainment: ratio },
    };
  }),
});

describe("LT_PAYCURVE_P2_60_PCT", () => {
  it.each([
    [-1, 0],
    [0, 0],
    [0.5999, 0],
    [0.6, 0.4666],
    [0.61, 0.47993],
    [0.8, 0.7332],
    [0.9999, 0.9996667],
    [1, 1],
  ])("attainment %s pays %s at or below target", (ratio, expected) => {
    expect(payoutRate(ratio, false)).toBeCloseTo(expected, 8);
    expect(payoutRate(ratio, true)).toBeCloseTo(expected, 8);
  });
  it.each([1.01, 1.5, 2, 3])("caps quarter payout at 100%% for attainment %s", (ratio) =>
    expect(payoutRate(ratio, false)).toBe(1),
  );
  it.each([
    [1.01, 1.025],
    [1.25, 1.625],
    [1.5, 2.25],
    [1.51, 2.26],
    [1.75, 2.5],
    [2, 2.75],
    [2.01, 2.75],
    [9, 2.75],
  ])("annual attainment %s pays %s", (ratio, expected) =>
    expect(payoutRate(ratio, true)).toBeCloseTo(expected, 8),
  );
});

describe("compensation settings and amounts", () => {
  it.each([0, 1, 2])(
    "Q%s never pays above its 100 percent base even at 200 percent attainment",
    (index) => {
      const result = calculateCompensation(settings, buckets, attainment(2, 2));
      expect(result.quarters[index]?.amount).toBe(
        (26000 * (settings.quarterShares[index] ?? 0)) / 100,
      );
    },
  );
  it("applies the annual accelerator to the full Q1-Q4 actual, not a single overachieving quarter", () => {
    const rows = [200, 100, 0, 100].map(
      (revenue, index) =>
        ({
          account: "Account",
          lob: "Mobility",
          fiscalQuarter: index + 1,
          fiscalMonth: index * 3 + 1,
          revenue,
        }) as SalesRow,
    );
    const annual = buildAttainment(
      rows,
      { annual: 0, byBucket: { m1: [100, 100, 100, 100] } },
      [buckets[0]].filter((bucket): bucket is BucketDefinition => bucket !== undefined),
      [1, 2, 3, 4],
      { 1: ["Account"], 2: ["Account"], 3: ["Account"], 4: ["Account"] },
    );
    const result = calculateCompensation(
      { ...settings, bucketWeights: { m1: 100 } },
      [buckets[0]].filter((bucket): bucket is BucketDefinition => bucket !== undefined),
      annual,
    );
    expect(result.quarters[0]?.amount).toBe(2600);
    expect(result.annual.details[0]?.attainment).toBe(1);
    expect(result.annual.amount).toBe(26000);
  });
  it("calculates annual OPI using 13 salaries and percentage", () =>
    expect(calculateCompensation(settings, buckets, attainment(1, 1)).annualBase).toBe(26000));
  it("distributes OPI by configurable quarter percentages", () =>
    expect(
      calculateCompensation(settings, buckets, attainment(1, 1)).quarters.map((q) => q.amount),
    ).toEqual([2600, 5200, 7800, 10400]));
  it("applies curves per bucket before weighting, not to weighted attainment", () => {
    const result = calculateCompensation(settings, buckets, attainment(0.5, 1.5));
    expect(result.quarters[0]?.amount).toBe(780);
    expect(result.annual.amount).toBe(17550);
  });
  it("requires quarter shares to sum to 100", () => {
    const invalid = {
      ...settings,
      quarterShares: [25, 25, 25, 20] as [number, number, number, number],
    };
    expect(compensationIssues(invalid, buckets)).toHaveLength(1);
    expect(calculateCompensation(invalid, buckets, attainment(1, 1)).annual.amount).toBeNull();
  });
  it("requires bucket weights to sum to 100", () => {
    const invalid = { ...settings, bucketWeights: { m1: 70, m4: 20 } };
    expect(compensationIssues(invalid, buckets)).toHaveLength(1);
    expect(
      calculateCompensation(invalid, buckets, attainment(1, 1)).quarters[0]?.amount,
    ).toBeNull();
  });
  it("does not invent attainment for a weighted bucket without target", () =>
    expect(calculateCompensation(settings, buckets, attainment(1, null)).annual.amount).toBeNull());
  it("permits missing target only for a zero-weight bucket", () =>
    expect(
      calculateCompensation(
        { ...settings, bucketWeights: { m1: 100, m4: 0 } },
        buckets,
        attainment(1, null),
      ).annual.amount,
    ).toBe(26000));
  it("preserves existing preferences and new compensation values", () => {
    const prefs = normalizePrefs({ ...defaultPrefs(), compensation: settings });
    expect(prefs.compensation).toEqual(settings);
    expect(normalizePrefs({ accounts: ["Account"] }).compensation).toEqual(defaultCompensation());
  });
  it("initial equal bucket weights sum exactly to 100 even for three buckets", () =>
    expect(
      Object.values(
        resolvedBucketWeights(defaultCompensation(), [
          ...buckets,
          { id: "third", name: "Third", lineOfBusiness: [] },
        ]),
      ).reduce((sum, value) => sum + value, 0),
    ).toBe(100));
  it("annual attainment uses all four quarters and includes overlapping LOBs fully per bucket", () => {
    const overlapping = buckets.map((bucket) => ({ ...bucket, lineOfBusiness: ["Service"] }));
    const rows = [1, 2, 3, 4].map(
      (q) =>
        ({
          account: "Account",
          lob: "Service",
          fiscalQuarter: q,
          fiscalMonth: (q - 1) * 3 + 1,
          revenue: q * 100,
        }) as SalesRow,
    );
    const result = buildAttainment(
      rows,
      { annual: 0, byBucket: { m1: [100, 100, 100, 100], m4: [100, 100, 100, 100] } },
      overlapping,
      [1, 2, 3, 4],
      { 1: ["Account"], 2: ["Account"], 3: ["Account"], 4: ["Account"] },
    );
    expect(result.buckets.map((bucket) => bucket.total.actual)).toEqual([1000, 1000]);
    expect(calculateCompensation(settings, overlapping, result).annual.amount).toBe(71500);
  });
});
