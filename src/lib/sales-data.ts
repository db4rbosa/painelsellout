export type SalesRow = {
  fiscalYear: number;
  fiscalQuarter: number;
  fiscalMonth: number;
  fiscalWeek: number;
  monthLabel: string;
  lob: string;
  disti: string;
  reseller: string;
  billTo: string;
  shipTo: string;
  endUser: string;
  sku: string;
  cbm: string;
  account: string;
  segment: string;
  state: string;
  city: string;
  revenue: number;
  quantity: number;
};

export const MONTH_LABELS = [
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

export const DIMENSIONS = [
  { key: "lob", label: "Linha de Negócio" },
  { key: "disti", label: "Distribuidor" },
  { key: "reseller", label: "Revenda" },
  { key: "billTo", label: "Bill To" },
  { key: "shipTo", label: "Ship To" },
  { key: "endUser", label: "Cliente Final" },
  { key: "sku", label: "SKU" },
  { key: "cbm", label: "CBM" },
  { key: "account", label: "Account / Vendedor" },
  { key: "segment", label: "Segmento (KAM/CBM)" },
  { key: "state", label: "Estado" },
  { key: "city", label: "Cidade" },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]["key"];

export type Granularity = "month" | "quarter" | "week";

const num = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const cleaned = v.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const str = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
};

type RawRow = Record<string, unknown>;

const pick = (r: RawRow, ...names: string[]): unknown => {
  for (const n of names) {
    const v = r[n.toLowerCase()];
    if (v !== undefined) return v;
  }
  return undefined;
};

const normalizeKeys = (r: RawRow): RawRow => {
  const out: RawRow = {};
  for (const [k, v] of Object.entries(r)) out[k.trim().toLowerCase()] = v;
  return out;
};

export function normalizeRows(rawRows: RawRow[]): SalesRow[] {
  return rawRows
    .map(normalizeKeys)
    .map((r) => {
      const month = num(pick(r, "Fiscal Month"));
      return {
        fiscalYear: num(pick(r, "Fiscal Year")),
        fiscalQuarter: num(pick(r, "Fiscal Quarter")) || Math.ceil(month / 3) || 1,
        fiscalMonth: month,
        fiscalWeek: num(pick(r, "Fiscal Week")),
        monthLabel:
          str(pick(r, "Months")) !== "—"
            ? str(pick(r, "Months"))
            : (MONTH_LABELS[month - 1] ?? "—"),
        lob: str(pick(r, "Line of Business")),
        disti: str(pick(r, "Disti Std Name")),
        reseller: str(pick(r, "Reseller")),
        billTo: str(pick(r, "Bill To HQ - Name", "Bill to Name")),
        shipTo: str(pick(r, "Ship to Name")),
        endUser: str(pick(r, "End User")),
        sku: str(pick(r, "Validated SKU Code")),
        cbm: str(pick(r, "CBM")),
        account: str(pick(r, "Account")),
        segment: str(pick(r, "VENDEDORES")),
        state: str(pick(r, "Bill To HQ - State")),
        city: str(pick(r, "Bill To HQ - City")),
        revenue: num(pick(r, "Extended Net Price USD")),
        quantity: num(pick(r, "Quantity")),
      } satisfies SalesRow;
    })
    .filter((r) => r.fiscalMonth > 0);
}

export async function parseWorkbook(file: File): Promise<SalesRow[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { dense: true });
  const sheetName = wb.SheetNames[0]!;
  const sheet = wb.Sheets[sheetName]!;
  const raw = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null });
  return normalizeRows(raw);
}

export const uniqueValues = (rows: SalesRow[], key: DimensionKey): string[] =>
  Array.from(new Set(rows.map((r) => r[key]))).sort((a, b) => a.localeCompare(b));

export const FILTER_DIMS = ["billTo", "reseller", "shipTo", "endUser", "disti"] as const;
export type FilterKey = (typeof FILTER_DIMS)[number];

export const FILTER_LABELS: Record<FilterKey, string> = {
  billTo: "Bill To HQ - Name",
  reseller: "Reseller",
  shipTo: "Ship to Name",
  endUser: "End User",
  disti: "Disti Std Name",
};

export type Filters = Record<FilterKey, string[]>;

export const emptyFilters = (): Filters => ({
  billTo: [],
  reseller: [],
  shipTo: [],
  endUser: [],
  disti: [],
});

export const countActiveFilters = (f: Filters) =>
  FILTER_DIMS.reduce((acc, k) => acc + (f[k].length ? 1 : 0), 0);

export function filterRows(rows: SalesRow[], accounts: string[], filters: Filters): SalesRow[] {
  const accountSet = accounts.length ? new Set(accounts) : null;
  const sets = FILTER_DIMS.map(
    (k) => [k, filters[k].length ? new Set(filters[k]) : null] as const,
  ).filter(([, s]) => s !== null) as [FilterKey, Set<string>][];

  if (!accountSet && !sets.length) return rows;

  return rows.filter((r) => {
    if (accountSet && !accountSet.has(r.account)) return false;
    for (const [k, s] of sets) if (!s.has(r[k])) return false;
    return true;
  });
}

export const periodKey = (row: SalesRow, g: Granularity): string =>
  g === "month"
    ? `${String(row.fiscalMonth).padStart(2, "0")} ${row.monthLabel}`
    : g === "quarter"
      ? `Q${row.fiscalQuarter}`
      : `W${String(row.fiscalWeek).padStart(2, "0")}`;

export type SeriesPoint = { period: string } & Record<string, number | string>;

export function buildSeries(
  rows: SalesRow[],
  dim: DimensionKey | "none",
  g: Granularity,
  metric: "revenue" | "quantity",
  topN = 8,
): { data: SeriesPoint[]; keys: string[] } {
  const totalsByGroup = new Map<string, number>();
  const byPeriod = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const group = dim === "none" ? "Total" : row[dim];
    const p = periodKey(row, g);
    const v = row[metric];
    totalsByGroup.set(group, (totalsByGroup.get(group) ?? 0) + v);
    if (!byPeriod.has(p)) byPeriod.set(p, new Map());
    const m = byPeriod.get(p)!;
    m.set(group, (m.get(group) ?? 0) + v);
  }

  const ranked = [...totalsByGroup.entries()].sort((a, b) => b[1] - a[1]);
  const keys = ranked.slice(0, topN).map(([k]) => k);
  const hasOthers = ranked.length > keys.length;

  const data: SeriesPoint[] = [...byPeriod.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, m]) => {
      const point: SeriesPoint = { period };
      let others = 0;
      for (const [group, v] of m) {
        if (keys.includes(group)) point[group] = Math.round(v);
        else others += v;
      }
      for (const k of keys) if (point[k] === undefined) point[k] = 0;
      if (hasOthers) point["Outros"] = Math.round(others);
      return point;
    });

  return { data, keys: hasOthers ? [...keys, "Outros"] : keys };
}

export const sum = (rows: SalesRow[], metric: "revenue" | "quantity" = "revenue") =>
  rows.reduce((acc, r) => acc + r[metric], 0);

export const fmtUSD = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);

export const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
