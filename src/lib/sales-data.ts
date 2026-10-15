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
  { key: "billTo", label: "Revenda HQ" },
  { key: "shipTo", label: "Destino Entrega" },
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

export const parseSalesNumber = (v: unknown, fieldName?: string): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    let cleaned = v.trim().replace(/\s/g, "");
    const negative = /^\(.*\)$/.test(cleaned);
    if (negative) cleaned = cleaned.slice(1, -1);
    if (cleaned.includes(",") && cleaned.includes(".")) {
      cleaned =
        cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
          ? cleaned.replace(/\./g, "").replace(",", ".")
          : cleaned.replace(/,/g, "");
    } else if (cleaned.includes(",")) {
      cleaned = /^[-+]?\d{1,3}(,\d{3})+$/.test(cleaned)
        ? cleaned.replace(/,/g, "")
        : cleaned.replace(",", ".");
    } else if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(cleaned)) cleaned = cleaned.replace(/\./g, "");
    const n = Number(cleaned);
    if (cleaned && Number.isFinite(n)) return negative ? -n : n;
  }
  const displayVal = String(v).slice(0, 30);
  throw new Error(
    `${fieldName ? `O campo "${fieldName}"` : "Valor"} contém dado inválido: "${displayVal}"`,
  );
};
const num = parseSalesNumber;

const str = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
};

type RawRow = Record<string, unknown>;
export type ImportIssue = { row: number; field: string; value: string; reason: string };
export type WorkbookImportResult = {
  rows: SalesRow[];
  issues: ImportIssue[];
  excludedRows: number;
};

export function normalizeRows(rawRows: RawRow[]): SalesRow[] {
  const headers = [...new Set(rawRows.flatMap((row) => Object.keys(row)))];
  return matrixToRows([headers, ...rawRows.map((row) => headers.map((header) => row[header]))]);
}

let fastPromise: Promise<typeof import("./xlsx-fast")> | null = null;
let xlsxPromise: Promise<typeof import("xlsx")> | null = null;

export function preloadWorkbookParser(): Promise<unknown> {
  fastPromise ??= import("./xlsx-fast");
  return fastPromise;
}

const loadXlsx = () => (xlsxPromise ??= import("xlsx"));

export function matrixToRows(matrix: unknown[][]): SalesRow[] {
  return matrixToImportResult(matrix).rows;
}

export function matrixToImportResult(
  matrix: unknown[][] & { sourceRows?: number[] },
): WorkbookImportResult {
  if (!matrix.length) return { rows: [], issues: [], excludedRows: 0 };

  const idx = new Map<string, number>();
  (matrix[0] ?? []).forEach((h, i) => {
    const key = String(h ?? "")
      .trim()
      .toLowerCase();
    if (key && !idx.has(key)) idx.set(key, i);
  });
  const col = (...names: string[]): number => {
    for (const n of names) {
      const i = idx.get(n.toLowerCase());
      if (i !== undefined) return i;
    }
    return -1;
  };

  const cYear = col("Fiscal Year");
  const cQuarter = col("Fiscal Quarter");
  const cMonth = col("Fiscal Month");
  const cWeek = col("Fiscal Week");
  const cMonths = col("Months");
  const cLob = col("Line of Business");
  const cDisti = col("Disti Std Name");
  const cReseller = col("Reseller");
  const cBillTo = col("Bill To HQ - Name", "Bill to Name");
  const cShipTo = col("Ship to Name");
  const cEndUser = col("End User");
  const cSku = col("Validated SKU Code");
  const cCbm = col("CBM");
  const cAccount = col("Account");
  const cSegment = col("VENDEDORES");
  const cState = col("Bill To HQ - State");
  const cCity = col("Bill To HQ - City");
  const cRevenue = col("Extended Net Price USD");
  const cQty = col("Quantity");

  const required = [
    ["Fiscal Year", cYear],
    ["Fiscal Month", cMonth],
    ["Line of Business", cLob],
    ["Account", cAccount],
    ["Extended Net Price USD", cRevenue],
    ["Quantity", cQty],
  ] as const;
  const missing = required.filter(([, index]) => index < 0).map(([name]) => name);
  if (missing.length) throw new Error(`Colunas obrigatórias ausentes: ${missing.join(", ")}.`);

  const out: SalesRow[] = [];
  const issues: ImportIssue[] = [];
  let excludedRows = 0;
  const years = new Set<number>();
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (!r || !r.some((value) => value !== null && value !== undefined && value !== "")) continue;
    const at = (c: number): unknown => (c >= 0 ? r[c] : undefined);
    if (at(cMonth) === null || at(cMonth) === undefined || at(cMonth) === "") continue;
    const issueStart = issues.length;
    const readNumber = (
      column: number,
      field: string,
      valid: (v: number) => boolean = () => true,
      reason = "Informe um número válido; erros de célula ou fórmulas sem resultado não podem ser calculados.",
    ) => {
      const raw = at(column);
      try {
        const value = num(raw);
        if (valid(value)) return value;
      } catch {
        /* Preserve the original invalid value in the diagnostic. */
      }
      issues.push({
        row: matrix.sourceRows?.[i] ?? i + 1,
        field,
        value: String(raw ?? "(vazio)"),
        reason,
      });
      return 0;
    };
    const month = readNumber(
      cMonth,
      "Fiscal Month",
      (v) => Number.isInteger(v) && v >= 1 && v <= 12,
      "O mês fiscal deve ser um inteiro de 1 a 12.",
    );
    const year = readNumber(
      cYear,
      "Fiscal Year",
      (v) => Number.isInteger(v) && v > 0,
      "O ano fiscal deve ser um inteiro positivo.",
    );
    const quarter =
      at(cQuarter) === null || at(cQuarter) === undefined || at(cQuarter) === ""
        ? Math.ceil(month / 3)
        : readNumber(
            cQuarter,
            "Fiscal Quarter",
            (v) => Number.isInteger(v) && v >= 1 && v <= 4,
            "O quarter fiscal deve ser um inteiro de 1 a 4.",
          );
    const week = readNumber(cWeek, "Fiscal Week");
    const revenue = readNumber(cRevenue, "Extended Net Price USD");
    const quantity = readNumber(cQty, "Quantity");
    if (issues.length > issueStart) {
      excludedRows++;
      continue;
    }
    years.add(year);
    const label = str(at(cMonths));
    out.push({
      fiscalYear: year,
      fiscalQuarter: quarter,
      fiscalMonth: month,
      fiscalWeek: week,
      monthLabel: label !== "—" ? label : (MONTH_LABELS[month - 1] ?? "—"),
      lob: str(at(cLob)),
      disti: str(at(cDisti)),
      reseller: str(at(cReseller)),
      billTo: str(at(cBillTo)),
      shipTo: str(at(cShipTo)),
      endUser: str(at(cEndUser)),
      sku: str(at(cSku)),
      cbm: str(at(cCbm)),
      account: str(at(cAccount)),
      segment: str(at(cSegment)),
      state: str(at(cState)),
      city: str(at(cCity)),
      revenue,
      quantity,
    });
  }
  if (years.size > 1)
    throw new Error(
      "A planilha contém mais de um ano fiscal. Importe um ano por vez para não misturar as metas anuais.",
    );
  return { rows: out, issues, excludedRows };
}

async function parseWithXlsx(buf: ArrayBuffer): Promise<WorkbookImportResult> {
  const XLSX = await loadXlsx();
  const wb = XLSX.read(buf, { dense: true, sheets: 0 });
  const name = wb.SheetNames[0];
  const sheet = name ? wb.Sheets[name] : undefined;
  if (!sheet) throw new Error("A planilha não contém abas.");
  return matrixToImportResult(
    XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: true }),
  );
}

export async function parseWorkbook(file: File): Promise<SalesRow[]> {
  return (await parseWorkbookDetailed(file)).rows;
}
export async function parseWorkbookDetailed(file: File): Promise<WorkbookImportResult> {
  const buf = await file.arrayBuffer();
  if (typeof Worker === "undefined") return parseWorkbookBufferDetailed(buf, file.name);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./workbook.worker.ts", import.meta.url), { type: "module" });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("A leitura excedeu o tempo disponível. Verifique o tamanho da planilha."));
    }, 120_000);
    const finish = () => {
      clearTimeout(timeout);
      worker.terminate();
    };
    worker.onmessage = (event: MessageEvent<{ result?: WorkbookImportResult; error?: string }>) => {
      finish();
      if (event.data.error || !event.data.result)
        reject(new Error(event.data.error ?? "Resposta inválida do leitor."));
      else resolve(event.data.result);
    };
    worker.onerror = () => {
      finish();
      reject(new Error("Não foi possível iniciar a leitura da planilha. Tente novamente."));
    };
    worker.postMessage({ buffer: buf, fileName: file.name }, [buf]);
  });
}

export async function parseWorkbookBuffer(buf: ArrayBuffer, fileName: string): Promise<SalesRow[]> {
  return (await parseWorkbookBufferDetailed(buf, fileName)).rows;
}
export async function parseWorkbookBufferDetailed(
  buf: ArrayBuffer,
  fileName: string,
): Promise<WorkbookImportResult> {
  const isXlsx = /\.xlsx$/i.test(fileName);

  if (isXlsx) {
    let matrix: (unknown[][] & { sourceRows?: number[] }) | undefined;
    try {
      const { readSheetMatrix } = await (fastPromise ??= import("./xlsx-fast"));
      matrix = readSheetMatrix(new Uint8Array(buf));
    } catch {
      // cai para o leitor completo
    }
    if (matrix?.length) return matrixToImportResult(matrix);
  }

  return parseWithXlsx(buf);
}

export const uniqueValues = (rows: SalesRow[], key: DimensionKey): string[] =>
  Array.from(new Set(rows.map((r) => r[key]))).sort((a, b) => a.localeCompare(b));

export const FILTER_DIMS = ["billTo", "reseller", "shipTo", "endUser", "disti"] as const;
export type FilterKey = (typeof FILTER_DIMS)[number];

export const FILTER_LABELS: Record<FilterKey, string> = {
  billTo: "Revenda HQ",
  reseller: "Revenda",
  shipTo: "Destino Entrega",
  endUser: "Cliente Final",
  disti: "Distribuidor",
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
    const m = byPeriod.get(p);
    if (!m) continue;
    m.set(group, (m.get(group) ?? 0) + v);
  }

  const ranked = [...totalsByGroup.entries()].sort((a, b) => b[1] - a[1]);
  const keys = ranked.slice(0, topN).map(([k]) => k);
  const keySet = new Set(keys);
  const hasOthers = ranked.length > keys.length;

  const data: SeriesPoint[] = [...byPeriod.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, m]) => {
      const point: SeriesPoint = { period };
      let others = 0;
      for (const [group, v] of m) {
        if (keySet.has(group)) point[group] = v;
        else others += v;
      }
      for (const k of keys) if (point[k] === undefined) point[k] = 0;
      if (hasOthers) point["Outros"] = others;
      return point;
    });

  return { data, keys: hasOthers ? [...keys, "Outros"] : keys };
}

export const sum = (rows: SalesRow[], metric: "revenue" | "quantity" = "revenue") =>
  rows.reduce((acc, r) => acc + r[metric], 0);

const usdFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
export const fmtUSD = (v: number) => usdFormatter.format(v);

export const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
