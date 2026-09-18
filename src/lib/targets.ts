import type { SalesRow } from "./sales-data";

export type QuarterValues = [number, number, number, number];

export type Targets = {
  annual: number;
  quarters: QuarterValues;
  servicesQuarters: QuarterValues;
};

const STORAGE_KEY = "sales-out-targets-v1";

export const emptyTargets = (): Targets => ({
  annual: 0,
  quarters: [0, 0, 0, 0],
  servicesQuarters: [0, 0, 0, 0],
});

export const groupKey = (accounts: string[]): string =>
  [...accounts].sort((a, b) => a.localeCompare(b)).join(" | ");

const readAll = (): Record<string, Targets> => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, Targets>;
  } catch {
    return {};
  }
};

export function loadTargets(accounts: string[]): Targets {
  if (!accounts.length) return emptyTargets();
  const all = readAll();
  const first = accounts[0];
  const found =
    all[groupKey(accounts)] ?? (accounts.length === 1 && first ? all[first] : undefined);
  if (!found) return emptyTargets();
  return {
    annual: found.annual ?? 0,
    quarters: found.quarters ?? [0, 0, 0, 0],
    servicesQuarters: found.servicesQuarters ?? [0, 0, 0, 0],
  };
}

export function saveTargets(accounts: string[], targets: Targets) {
  if (typeof window === "undefined" || !accounts.length) return;
  try {
    const all = readAll();
    all[groupKey(accounts)] = targets;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export type AttainmentRow = {
  label: string;
  actual: number;
  target: number;
  attainment: number | null;
};

const quarterOf = (month: number) => Math.min(4, Math.max(1, Math.ceil(month / 3)));

export type QuarterAccounts = Record<number, string[]>;

export type AttainmentTotal = {
  actual: number;
  target: number;
  attainment: number | null;
};

export type AttainmentResult = {
  months: AttainmentRow[];
  quarters: AttainmentRow[];
  servicesQuarters: AttainmentRow[];
  total: AttainmentTotal;
  servicesTotal: AttainmentTotal;
};

const totalOf = (actual: number, target: number): AttainmentTotal => ({
  actual,
  target,
  attainment: target > 0 ? actual / target : null,
});

export function buildAttainment(
  rows: SalesRow[],
  targets: Targets,
  selectedQuarters: number[],
  accountsByQuarter: QuarterAccounts,
): AttainmentResult {
  const actualByMonth = new Array(12).fill(0) as number[];
  const servicesByQuarter = [0, 0, 0, 0];
  const selected = new Set(selectedQuarters);
  const accountSets = new Map<number, Set<string>>(
    selectedQuarters.map((quarter) => [quarter, new Set(accountsByQuarter[quarter] ?? [])]),
  );

  for (const r of rows) {
    if (!selected.has(r.fiscalQuarter)) continue;
    const quarterAccounts = accountSets.get(r.fiscalQuarter);
    if (!quarterAccounts?.size || !quarterAccounts.has(r.account)) continue;
    const idx = r.fiscalMonth - 1;
    if (idx >= 0 && idx < 12) actualByMonth[idx] = (actualByMonth[idx] ?? 0) + r.revenue;
    if (r.lob.trim().toLowerCase() === "services") {
      const quarterIndex = r.fiscalQuarter - 1;
      if (quarterIndex >= 0 && quarterIndex < 4) {
        servicesByQuarter[quarterIndex] = (servicesByQuarter[quarterIndex] ?? 0) + r.revenue;
      }
    }
  }
  const quarterTarget = (q: number) => targets.quarters[q - 1] ?? 0;
  const actualByQuarter = [0, 0, 0, 0];
  actualByMonth.forEach((v, i) => {
    const qi = quarterOf(i + 1) - 1;
    actualByQuarter[qi] = (actualByQuarter[qi] ?? 0) + v;
  });

  const labels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthlyTargets = actualByMonth.map((_, i) => quarterTarget(quarterOf(i + 1)) / 3);

  const months: AttainmentRow[] = actualByMonth.map((actual, i) => {
    const target = monthlyTargets[i] ?? 0;
    return {
      label: labels[i] ?? String(i + 1),
      actual,
      target,
      attainment: target > 0 ? actual / target : null,
    };
  });

  const quarters: AttainmentRow[] = actualByQuarter.map((actual, i) => {
    const target = quarterTarget(i + 1);
    return {
      label: `Q${i + 1}`,
      actual,
      target,
      attainment: target > 0 ? actual / target : null,
    };
  });
  const servicesQuarters: AttainmentRow[] = servicesByQuarter.map((actual, i) => {
    const target = targets.servicesQuarters[i] ?? 0;
    return {
      label: `Q${i + 1}`,
      actual,
      target,
      attainment: target > 0 ? actual / target : null,
    };
  });
  const includedIndexes = selectedQuarters.map((quarter) => quarter - 1);
  const totalActual = includedIndexes.reduce((sum, index) => sum + (actualByQuarter[index] ?? 0), 0);
  const totalTarget = includedIndexes.reduce((sum, index) => sum + (targets.quarters[index] ?? 0), 0);
  const servicesActual = includedIndexes.reduce(
    (sum, index) => sum + (servicesByQuarter[index] ?? 0),
    0,
  );
  const servicesTarget = includedIndexes.reduce(
    (sum, index) => sum + (targets.servicesQuarters[index] ?? 0),
    0,
  );

  return {
    months,
    quarters,
    servicesQuarters,
    total: totalOf(totalActual, totalTarget),
    servicesTotal: totalOf(servicesActual, servicesTarget),
  };
}
