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
  servicesMonths: AttainmentRow[];
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

const isServiceLine = (lineOfBusiness: string) => {
  const normalized = lineOfBusiness.trim().toLocaleLowerCase("en-US");
  return normalized === "service" || normalized === "services";
};

export function buildAttainment(
  rows: SalesRow[],
  targets: Targets,
  selectedQuarters: number[] = [1, 2, 3, 4],
  accountsByQuarter: QuarterAccounts = {},
): AttainmentResult {
  const safeSelectedQuarters = Array.isArray(selectedQuarters)
    ? selectedQuarters.filter(
        (quarter) => Number.isInteger(quarter) && quarter >= 1 && quarter <= 4,
      )
    : [1, 2, 3, 4];
  const selectedQuarterList = safeSelectedQuarters.length
    ? safeSelectedQuarters
    : [1, 2, 3, 4];
  const quarterTargets = Array.isArray(targets?.quarters) ? targets.quarters : [0, 0, 0, 0];
  const servicesTargets = Array.isArray(targets?.servicesQuarters)
    ? targets.servicesQuarters
    : [0, 0, 0, 0];
  const actualByMonth = new Array(12).fill(0) as number[];
  const servicesByMonth = new Array(12).fill(0) as number[];
  const servicesByQuarter = [0, 0, 0, 0];
  const selected = new Set(selectedQuarterList);
  const accountSets = new Map<number, Set<string>>(
    selectedQuarterList.map((quarter) => [
      quarter,
      new Set(accountsByQuarter?.[quarter] ?? []),
    ]),
  );

  for (const r of rows) {
    if (!selected.has(r.fiscalQuarter)) continue;
    const quarterAccounts = accountSets.get(r.fiscalQuarter);
    if (!quarterAccounts?.size || !quarterAccounts.has(r.account)) continue;
    const idx = r.fiscalMonth - 1;
    if (isServiceLine(r.lob)) {
      if (idx >= 0 && idx < 12) {
        servicesByMonth[idx] = (servicesByMonth[idx] ?? 0) + r.revenue;
      }
      const quarterIndex = r.fiscalQuarter - 1;
      if (quarterIndex >= 0 && quarterIndex < 4) {
        servicesByQuarter[quarterIndex] = (servicesByQuarter[quarterIndex] ?? 0) + r.revenue;
      }
    } else if (idx >= 0 && idx < 12) {
      actualByMonth[idx] = (actualByMonth[idx] ?? 0) + r.revenue;
    }
  }
  const quarterTarget = (q: number) => quarterTargets[q - 1] ?? 0;
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
  const monthlyTargets = actualByMonth.map((_, i) => {
    const quarter = quarterOf(i + 1);
    return selected.has(quarter) ? quarterTarget(quarter) / 3 : 0;
  });
  const monthlyServicesTargets = servicesByMonth.map((_, i) => {
    const quarter = quarterOf(i + 1);
    return selected.has(quarter) ? (servicesTargets[quarter - 1] ?? 0) / 3 : 0;
  });

  const months: AttainmentRow[] = actualByMonth.map((actual, i) => {
    const target = monthlyTargets[i] ?? 0;
    return {
      label: labels[i] ?? String(i + 1),
      actual,
      target,
      attainment: target > 0 ? actual / target : null,
    };
  });
  const servicesMonths: AttainmentRow[] = servicesByMonth.map((actual, i) => {
    const target = monthlyServicesTargets[i] ?? 0;
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
    const target = servicesTargets[i] ?? 0;
    return {
      label: `Q${i + 1}`,
      actual,
      target,
      attainment: target > 0 ? actual / target : null,
    };
  });
  const includedIndexes = selectedQuarterList.map((quarter) => quarter - 1);
  const totalActual = includedIndexes.reduce((sum, index) => sum + (actualByQuarter[index] ?? 0), 0);
  const totalTarget = includedIndexes.reduce((sum, index) => sum + (quarterTargets[index] ?? 0), 0);
  const servicesActual = includedIndexes.reduce(
    (sum, index) => sum + (servicesByQuarter[index] ?? 0),
    0,
  );
  const servicesTarget = includedIndexes.reduce(
    (sum, index) => sum + (servicesTargets[index] ?? 0),
    0,
  );

  return {
    months,
    servicesMonths,
    quarters,
    servicesQuarters,
    total: totalOf(totalActual, totalTarget),
    servicesTotal: totalOf(servicesActual, servicesTarget),
  };
}
