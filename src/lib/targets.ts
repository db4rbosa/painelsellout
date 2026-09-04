import type { SalesRow } from "./sales-data";

export type Targets = { annual: number; quarters: [number, number, number, number] };

const STORAGE_KEY = "sales-out-targets-v1";

export const emptyTargets = (): Targets => ({ annual: 0, quarters: [0, 0, 0, 0] });

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
  return found ?? emptyTargets();
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

export function buildAttainment(rows: SalesRow[], targets: Targets) {
  const actualByMonth = new Array(12).fill(0) as number[];
  for (const r of rows) {
    const idx = r.fiscalMonth - 1;
    if (idx >= 0 && idx < 12) actualByMonth[idx] = (actualByMonth[idx] ?? 0) + r.revenue;
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

  const half = (from: number, to: number, label: string): AttainmentRow => {
    const actual = actualByQuarter.slice(from, to).reduce((a, b) => a + b, 0);
    const target = targets.quarters.slice(from, to).reduce((a, b) => a + b, 0);
    return { label, actual, target, attainment: target > 0 ? actual / target : null };
  };

  const h1 = half(0, 2, "1º Semestre (H1)");
  const h2 = half(2, 4, "2º Semestre (H2)");
  const totalActual = actualByQuarter.reduce((a, b) => a + b, 0);
  const fyTarget =
    targets.annual > 0 ? targets.annual : targets.quarters.reduce((a, b) => a + b, 0);
  const fullYear: AttainmentRow = {
    label: "Ano Fiscal (FY)",
    actual: totalActual,
    target: fyTarget,
    attainment: fyTarget > 0 ? totalActual / fyTarget : null,
  };

  return { months, quarters, halves: [h1, h2], fullYear };
}
