import type { SalesRow } from "./sales-data";

export type Targets = { annual: number; quarters: [number, number, number, number] };

const STORAGE_KEY = "sales-out-targets-v1";

export const emptyTargets = (): Targets => ({ annual: 0, quarters: [0, 0, 0, 0] });

export function loadTargets(person: string): Targets {
  if (typeof window === "undefined") return emptyTargets();
  try {
    const all = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      Targets
    >;
    return all[person] ?? emptyTargets();
  } catch {
    return emptyTargets();
  }
}

export function saveTargets(person: string, targets: Targets) {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      Targets
    >;
    all[person] = targets;
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
    if (r.fiscalMonth >= 1 && r.fiscalMonth <= 12) actualByMonth[r.fiscalMonth - 1] += r.revenue;
  }
  const actualByQuarter = [0, 0, 0, 0];
  actualByMonth.forEach((v, i) => {
    actualByQuarter[quarterOf(i + 1) - 1] += v;
  });

  const monthlyTargets = actualByMonth.map((_, i) => targets.quarters[quarterOf(i + 1) - 1] / 3);

  const months: AttainmentRow[] = actualByMonth.map((actual, i) => ({
    label: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
    actual,
    target: monthlyTargets[i],
    attainment: monthlyTargets[i] > 0 ? actual / monthlyTargets[i] : null,
  }));

  const quarters: AttainmentRow[] = actualByQuarter.map((actual, i) => ({
    label: `Q${i + 1}`,
    actual,
    target: targets.quarters[i],
    attainment: targets.quarters[i] > 0 ? actual / targets.quarters[i] : null,
  }));

  const half = (from: number, to: number, label: string): AttainmentRow => {
    const actual = actualByQuarter.slice(from, to).reduce((a, b) => a + b, 0);
    const target = targets.quarters.slice(from, to).reduce((a, b) => a + b, 0);
    return { label, actual, target, attainment: target > 0 ? actual / target : null };
  };

  const h1 = half(0, 2, "1º Semestre (H1)");
  const h2 = half(2, 4, "2º Semestre (H2)");
  const totalActual = actualByQuarter.reduce((a, b) => a + b, 0);
  const fyTarget = targets.annual > 0 ? targets.annual : targets.quarters.reduce((a, b) => a + b, 0);
  const fullYear: AttainmentRow = {
    label: "Ano Fiscal (FY)",
    actual: totalActual,
    target: fyTarget,
    attainment: fyTarget > 0 ? totalActual / fyTarget : null,
  };

  return { months, quarters, halves: [h1, h2], fullYear };
}
