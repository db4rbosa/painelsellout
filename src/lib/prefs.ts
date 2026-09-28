import {
  emptyFilters,
  FILTER_DIMS,
  type DimensionKey,
  type Filters,
  type Granularity,
} from "./sales-data";
import {
  DEFAULT_BUCKETS,
  emptyQuarterValues,
  emptyTargets,
  type BucketDefinition,
  type QuarterValues,
  type Targets,
} from "./targets";

export type DashboardPrefs = {
  accounts: string[];
  filters: Filters;
  groupBy: DimensionKey | "none";
  granularity: Granularity;
  metric: "revenue" | "quantity";
  chartType: "area" | "line" | "bar";
  stacked: boolean;
  topN: number;
  buckets: BucketDefinition[];
  targetsByGroup: Record<string, Targets>;
  selectedQuarters: number[];
  accountsByQuarter: Record<number, string[]>;
};

export const defaultPrefs = (): DashboardPrefs => ({
  accounts: [],
  filters: emptyFilters(),
  groupBy: "lob",
  granularity: "month",
  metric: "revenue",
  chartType: "area",
  stacked: true,
  topN: 8,
  buckets: DEFAULT_BUCKETS.map((bucket) => ({ ...bucket, lineOfBusiness: [...bucket.lineOfBusiness] })),
  targetsByGroup: {},
  selectedQuarters: [1, 2, 3, 4],
  accountsByQuarter: {},
});

const strArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const numOr = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : fallback;
const quarterValues = (value: unknown): QuarterValues => {
  const values = Array.isArray(value) ? value : [];
  return [0, 1, 2, 3].map((index) => numOr(values[index], 0)) as QuarterValues;
};

const normalizeBuckets = (value: unknown): BucketDefinition[] => {
  if (!Array.isArray(value)) return defaultPrefs().buckets;
  const used = new Set<string>();
  const buckets = value.slice(0, 4).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const id = typeof raw["id"] === "string" && raw["id"] ? raw["id"] : `bucket-${index + 1}`;
    const name = typeof raw["name"] === "string" && raw["name"].trim() ? raw["name"].trim() : `Bolso ${index + 1}`;
    const lineOfBusiness = strArray(raw["lineOfBusiness"]).filter((lob) => {
      const key = lob.trim().toLocaleLowerCase("en-US");
      if (!key || used.has(key)) return false;
      used.add(key);
      return true;
    });
    return [{ id, name, lineOfBusiness }];
  });
  return buckets.length ? buckets : defaultPrefs().buckets;
};

export function normalizePrefs(raw: unknown): DashboardPrefs {
  const base = defaultPrefs();
  if (!raw || typeof raw !== "object") return base;
  const record = raw as Record<string, unknown>;
  const filters = emptyFilters();
  const rawFilters = (record["filters"] ?? {}) as Record<string, unknown>;
  for (const key of FILTER_DIMS) filters[key] = strArray(rawFilters[key]);
  const buckets = normalizeBuckets(record["buckets"]);

  const targetsByGroup: Record<string, Targets> = {};
  const rawTargets = (record["targetsByGroup"] ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(rawTargets)) {
    const target = (value ?? {}) as Record<string, unknown>;
    const rawByBucket = target["byBucket"] && typeof target["byBucket"] === "object"
      ? target["byBucket"] as Record<string, unknown>
      : null;
    const byBucket: Record<string, QuarterValues> = {};
    for (const bucket of buckets) byBucket[bucket.id] = quarterValues(rawByBucket?.[bucket.id]);
    if (!rawByBucket) {
      const first = buckets[0];
      const second = buckets[1];
      if (first) byBucket[first.id] = quarterValues(target["quarters"]);
      if (second) byBucket[second.id] = quarterValues(target["servicesQuarters"]);
    }
    targetsByGroup[key] = { annual: numOr(target["annual"], 0), byBucket };
  }

  const selectedQuarters = (Array.isArray(record["selectedQuarters"])
    ? record["selectedQuarters"]
    : base.selectedQuarters).filter(
      (quarter): quarter is number => typeof quarter === "number" && Number.isInteger(quarter) && quarter >= 1 && quarter <= 4,
    );
  const rawAccounts = record["accountsByQuarter"] && typeof record["accountsByQuarter"] === "object"
    ? record["accountsByQuarter"] as Record<string, unknown>
    : {};
  const accountsByQuarter: Record<number, string[]> = {};
  for (const quarter of [1, 2, 3, 4]) accountsByQuarter[quarter] = strArray(rawAccounts[String(quarter)]);

  return {
    accounts: strArray(record["accounts"]),
    filters,
    groupBy: (typeof record["groupBy"] === "string" ? record["groupBy"] : base.groupBy) as DimensionKey | "none",
    granularity: oneOf(record["granularity"], ["month", "quarter", "week"] as const, "month"),
    metric: oneOf(record["metric"], ["revenue", "quantity"] as const, "revenue"),
    chartType: oneOf(record["chartType"], ["area", "line", "bar"] as const, "area"),
    stacked: typeof record["stacked"] === "boolean" ? record["stacked"] : true,
    topN: numOr(record["topN"], 8),
    buckets,
    targetsByGroup,
    selectedQuarters: selectedQuarters.length ? selectedQuarters : base.selectedQuarters,
    accountsByQuarter,
  };
}

export const targetsForGroup = (prefs: DashboardPrefs, key: string): Targets => {
  const targets = prefs.targetsByGroup[key] ?? emptyTargets(prefs.buckets);
  return {
    ...targets,
    byBucket: Object.fromEntries(
      prefs.buckets.map((bucket) => [bucket.id, targets.byBucket[bucket.id] ?? emptyQuarterValues()]),
    ),
  };
};