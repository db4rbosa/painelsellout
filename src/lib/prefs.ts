import {
  emptyFilters,
  FILTER_DIMS,
  type DimensionKey,
  type Filters,
  type Granularity,
} from "./sales-data";
import { emptyTargets, type Targets } from "./targets";

export type DashboardPrefs = {
  accounts: string[];
  filters: Filters;
  groupBy: DimensionKey | "none";
  granularity: Granularity;
  metric: "revenue" | "quantity";
  chartType: "area" | "line" | "bar";
  stacked: boolean;
  topN: number;
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
  targetsByGroup: {},
  selectedQuarters: [1, 2, 3, 4],
  accountsByQuarter: {},
});

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const numOr = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;

export function normalizePrefs(raw: unknown): DashboardPrefs {
  const base = defaultPrefs();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;

  const filters = emptyFilters();
  const rawFilters = (r["filters"] ?? {}) as Record<string, unknown>;
  for (const k of FILTER_DIMS) filters[k] = strArray(rawFilters[k]);

  const targetsByGroup: Record<string, Targets> = {};
  const rawTargets = (r["targetsByGroup"] ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(rawTargets)) {
    const t = (value ?? {}) as Record<string, unknown>;
    const quarters = Array.isArray(t["quarters"]) ? (t["quarters"] as unknown[]) : [];
    const servicesQuarters = Array.isArray(t["servicesQuarters"])
      ? (t["servicesQuarters"] as unknown[])
      : [];
    targetsByGroup[key] = {
      annual: numOr(t["annual"], 0),
      quarters: [0, 1, 2, 3].map((i) => numOr(quarters[i], 0)) as Targets["quarters"],
      servicesQuarters: [0, 1, 2, 3].map((i) =>
        numOr(servicesQuarters[i], 0),
      ) as Targets["servicesQuarters"],
    };
  }

  const rawSelectedQuarters = Array.isArray(r["selectedQuarters"])
    ? (r["selectedQuarters"] as unknown[])
    : base.selectedQuarters;
  const selectedQuarters = rawSelectedQuarters.filter(
    (quarter): quarter is number =>
      typeof quarter === "number" && Number.isInteger(quarter) && quarter >= 1 && quarter <= 4,
  );
  const rawAccountsByQuarter =
    r["accountsByQuarter"] && typeof r["accountsByQuarter"] === "object"
      ? (r["accountsByQuarter"] as Record<string, unknown>)
      : {};
  const accountsByQuarter: Record<number, string[]> = {};
  for (const quarter of [1, 2, 3, 4]) {
    accountsByQuarter[quarter] = strArray(rawAccountsByQuarter[String(quarter)]);
  }

  return {
    accounts: strArray(r["accounts"]),
    filters,
    groupBy: (typeof r["groupBy"] === "string" ? r["groupBy"] : base.groupBy) as
      | DimensionKey
      | "none",
    granularity: oneOf(r["granularity"], ["month", "quarter", "week"] as const, "month"),
    metric: oneOf(r["metric"], ["revenue", "quantity"] as const, "revenue"),
    chartType: oneOf(r["chartType"], ["area", "line", "bar"] as const, "area"),
    stacked: typeof r["stacked"] === "boolean" ? r["stacked"] : true,
    topN: numOr(r["topN"], 8),
    targetsByGroup,
    selectedQuarters: selectedQuarters.length ? selectedQuarters : base.selectedQuarters,
    accountsByQuarter,
  };
}

export const targetsForGroup = (prefs: DashboardPrefs, key: string): Targets =>
  prefs.targetsByGroup[key] ?? emptyTargets();
