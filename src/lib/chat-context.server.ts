import { buildSalesReport } from "./report-export";
import { matrixToRows, filterRows, FILTER_DIMS, FILTER_LABELS, type DimensionKey, type SalesRow } from "./sales-data";
import { normalizePrefs, targetsForGroup } from "./prefs";
import { buildAttainment, groupKey } from "./targets";

let workbookCache: { path: string; rows: SalesRow[] } | null = null;

const topGroups = (rows: SalesRow[], key: DimensionKey, limit = 15) => {
  const totals = new Map<string, { revenue: number; quantity: number }>();
  for (const row of rows) {
    const current = totals.get(row[key]) ?? { revenue: 0, quantity: 0 };
    current.revenue += row.revenue;
    current.quantity += row.quantity;
    totals.set(row[key], current);
  }
  return [...totals.entries()]
    .map(([name, values]) => ({ name, ...values }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
};

export async function buildUserSalesContext(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: prefsRow }, { data: workbook }] = await Promise.all([
    supabaseAdmin.from("user_preferences").select("prefs").eq("user_key", userId).maybeSingle(),
    supabaseAdmin
      .from("workbooks")
      .select("file_name, storage_path, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!workbook) return { status: "sem_planilha" as const };

  let rows: SalesRow[];
  if (workbookCache?.path === workbook.storage_path) {
    rows = workbookCache.rows;
  } else {
    const { data, error } = await supabaseAdmin.storage
      .from("sales-workbooks")
      .download(workbook.storage_path);
    if (error || !data) throw new Error("Não foi possível ler a planilha atual.");
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (/\.xlsx$/i.test(workbook.file_name)) {
      const { readSheetMatrix } = await import("./xlsx-fast");
      rows = matrixToRows(readSheetMatrix(bytes));
    } else {
      const XLSX = await import("xlsx");
      const parsed = XLSX.read(bytes, { dense: true });
      const sheetName = parsed.SheetNames[0];
      const sheet = sheetName ? parsed.Sheets[sheetName] : undefined;
      rows = sheet
        ? matrixToRows(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }))
        : [];
    }
    workbookCache = { path: workbook.storage_path, rows };
  }

  const prefs = normalizePrefs(prefsRow?.prefs);
  const scopedRows = filterRows(rows, prefs.accounts, prefs.filters);
  const allAccounts = [...new Set(rows.map((row) => row.account))].sort((a, b) => a.localeCompare(b));
  const targetAccounts = prefs.accounts.length ? prefs.accounts : allAccounts;
  const accountsByQuarter = Object.fromEntries(
    [1, 2, 3, 4].map((quarter) => {
      const configured = prefs.accountsByQuarter[quarter] ?? [];
      return [quarter, configured.length ? configured : targetAccounts];
    }),
  );
  const targets = targetsForGroup(prefs, groupKey(prefs.accounts));
  const attainment = buildAttainment(
    scopedRows,
    targets,
    prefs.buckets,
    prefs.selectedQuarters,
    accountsByQuarter,
  );
  const report = buildSalesReport({
    fileName: workbook.file_name,
    accounts: prefs.accounts,
    allAccountOptions: targetAccounts,
    filters: prefs.filters,
    selectedQuarters: prefs.selectedQuarters,
    accountsByQuarter,
    buckets: prefs.buckets,
    attainment,
  });

  return {
    status: "ok" as const,
    planilha: { nome: workbook.file_name, atualizadaEm: workbook.created_at, linhasNoEscopo: scopedRows.length },
    escopo: {
      accounts: report.generalAccounts,
      quarters: report.selectedQuarters.map((quarter) => `Q${quarter}`),
      accountsPorQuarter: report.quarterAccounts,
      filtros: FILTER_DIMS.map((key) => ({ nome: FILTER_LABELS[key], valores: prefs.filters[key] })).filter((item) => item.valores.length),
    },
    resumoPorQuarter: report.quarterLines,
    evolucaoMensal: report.monthlyLines,
    totais: report.totals,
    rankings: {
      linhasDeNegocio: topGroups(scopedRows, "lob"),
      distribuidores: topGroups(scopedRows, "disti"),
      revendas: topGroups(scopedRows, "reseller"),
      revendasHQ: topGroups(scopedRows, "billTo"),
      destinosEntrega: topGroups(scopedRows, "shipTo"),
      clientesFinais: topGroups(scopedRows, "endUser"),
      accounts: topGroups(scopedRows, "account"),
      segmentos: topGroups(scopedRows, "segment"),
      estados: topGroups(scopedRows, "state"),
      cidades: topGroups(scopedRows, "city"),
      skus: topGroups(scopedRows, "sku"),
    },
  };
}