import { FILTER_DIMS, FILTER_LABELS, type Filters, type SalesRow } from "./sales-data";
import { bucketsForRow, type AttainmentResult, type BucketDefinition, type QuarterAccounts } from "./targets";

export type ReportContext = {
  fileName: string;
  accounts: string[];
  allAccountOptions: string[];
  filters: Filters;
  selectedQuarters: number[];
  accountsByQuarter: QuarterAccounts;
  buckets: BucketDefinition[];
  attainment: AttainmentResult;
};

type ReportLine = {
  period: string;
  category: string;
  accounts: string;
  actual: number;
  target: number;
  attainment: number | null;
  cumulativeActual: number;
  cumulativeTarget: number;
  cumulativeAttainment: number | null;
};

export type SalesReport = {
  generatedAt: Date;
  fileName: string;
  generalAccounts: string[];
  filters: { label: string; values: string[] }[];
  selectedQuarters: number[];
  quarterAccounts: { quarter: number; accounts: string[] }[];
  buckets: BucketDefinition[];
  quarterLines: ReportLine[];
  monthlyLines: ReportLine[];
  totals: ReportLine[];
};

const ratio = (actual: number, target: number) => target > 0 ? actual / target : null;
const displayAccounts = (accounts: string[], fallback: string[]) => accounts.length ? accounts : fallback;

export function buildSalesReport(context: ReportContext): SalesReport {
  const selected = [...context.selectedQuarters].sort((a, b) => a - b);
  const quarterAccounts = selected.map((quarter) => ({ quarter, accounts: displayAccounts(context.accountsByQuarter[quarter] ?? [], context.allAccountOptions) }));
  const accountTextFor = (quarter: number) => quarterAccounts.find((item) => item.quarter === quarter)?.accounts.join(", ") ?? "—";
  const quarterLines: ReportLine[] = [];
  const monthlyLines: ReportLine[] = [];
  const totals: ReportLine[] = [];

  for (const bucket of context.attainment.buckets) {
    let cumulativeActual = 0;
    let cumulativeTarget = 0;
    for (const quarter of selected) {
      const line = bucket.quarters[quarter - 1];
      if (line) quarterLines.push({ period: `Q${quarter}`, category: bucket.name, accounts: accountTextFor(quarter), ...line, cumulativeActual: line.actual, cumulativeTarget: line.target, cumulativeAttainment: line.attainment });
    }
    bucket.months.forEach((line, monthIndex) => {
      const quarter = Math.ceil((monthIndex + 1) / 3);
      if (!selected.includes(quarter)) return;
      cumulativeActual += line.actual;
      cumulativeTarget += line.target;
      monthlyLines.push({ period: line.label, category: bucket.name, accounts: accountTextFor(quarter), ...line, cumulativeActual, cumulativeTarget, cumulativeAttainment: ratio(cumulativeActual, cumulativeTarget) });
    });
    totals.push({ period: "Total", category: bucket.name, accounts: [...new Set(quarterAccounts.flatMap((item) => item.accounts))].join(", ") || "—", ...bucket.total, cumulativeActual: bucket.total.actual, cumulativeTarget: bucket.total.target, cumulativeAttainment: bucket.total.attainment });
  }

  return {
    generatedAt: new Date(), fileName: context.fileName,
    generalAccounts: displayAccounts(context.accounts, context.allAccountOptions),
    filters: FILTER_DIMS.map((key) => ({ label: FILTER_LABELS[key], values: context.filters[key] })).filter((item) => item.values.length),
    selectedQuarters: selected, quarterAccounts, buckets: context.buckets, quarterLines, monthlyLines, totals,
  };
}

const safeDate = (date: Date) => date.toISOString().slice(0, 10);
const money = (value: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const percent = (value: number | null) => value === null ? "—" : `${(value * 100).toFixed(1)}%`;
const shortList = (values: string[]) => values.join(", ") || "Todos";

const ROW_HEADERS = ["Fiscal Year", "Fiscal Quarter", "Fiscal Month", "Fiscal Week", "Months", "Line of Business", "Disti Std Name", "Reseller", "Bill To HQ - Name", "Ship to Name", "End User", "Validated SKU Code", "CBM", "Account", "VENDEDORES", "Bill To HQ - State", "Bill To HQ - City", "Extended Net Price USD", "Quantity"];
const rowValues = (row: SalesRow) => [row.fiscalYear, row.fiscalQuarter, row.fiscalMonth, row.fiscalWeek, row.monthLabel, row.lob, row.disti, row.reseller, row.billTo, row.shipTo, row.endUser, row.sku, row.cbm, row.account, row.segment, row.state, row.city, row.revenue, row.quantity];

const safeSheetName = (name: string, used: Set<string>) => {
  const base = name.replace(/[\\/?*:[\]]/g, " ").trim().slice(0, 31) || "Bolso";
  let result = base;
  let suffix = 2;
  while (used.has(result.toLocaleLowerCase("pt-BR"))) {
    const tail = ` ${suffix++}`;
    result = `${base.slice(0, 31 - tail.length)}${tail}`;
  }
  used.add(result.toLocaleLowerCase("pt-BR"));
  return result;
};

export async function downloadReportExcel(report: SalesReport, rows: SalesRow[], accountsByQuarter: QuarterAccounts) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const used = new Set<string>();
  const selected = new Set(report.selectedQuarters);
  for (const bucket of report.buckets) {
    const details = rows.filter((row) => {
      if (!selected.has(row.fiscalQuarter)) return false;
      const accounts = accountsByQuarter[row.fiscalQuarter] ?? [];
      return (!accounts.length || accounts.includes(row.account)) && bucketsForRow(row, [bucket]).length > 0;
    });
    const sheet = XLSX.utils.aoa_to_sheet([ROW_HEADERS, ...details.map(rowValues)]);
    sheet["!autofilter"] = { ref: `A1:S${Math.max(1, details.length + 1)}` };
    sheet["!cols"] = ROW_HEADERS.map((header) => ({ wch: Math.min(28, Math.max(12, header.length + 2)) }));
    XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(bucket.name, used));
  }
  XLSX.writeFile(workbook, `linhas-sell-out-${safeDate(report.generatedAt)}.xlsx`, { compression: true });
}

export async function downloadReportPdf(report: SalesReport) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const addHeader = () => {
    doc.setFillColor(19, 45, 49); doc.rect(0, 0, pageWidth, 24, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("Relatório de Metas e Atingimento", margin, 11);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`Gerado em ${report.generatedAt.toLocaleString("pt-BR")}`, margin, 18);
  };
  addHeader(); doc.setTextColor(30, 41, 46); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("Contexto do relatório", margin, 32); doc.setFont("helvetica", "normal");
  autoTable(doc, { startY: 36, margin: { left: margin, right: margin }, theme: "grid", body: [["Planilha", report.fileName], ["Quarters", report.selectedQuarters.map((q) => `Q${q}`).join(", ")], ["Accounts gerais", shortList(report.generalAccounts)], ...report.filters.map((item) => [`Filtro · ${item.label}`, shortList(item.values)]), ...report.quarterAccounts.map((item) => [`Accounts Q${item.quarter}`, shortList(item.accounts)]), ...report.buckets.map((bucket) => [`${bucket.name} · Line of Business`, shortList(bucket.lineOfBusiness)])], columnStyles: { 0: { cellWidth: 48, fontStyle: "bold" }, 1: { cellWidth: "auto" } }, styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2, overflow: "linebreak" }, alternateRowStyles: { fillColor: [244, 247, 247] } });
  let cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Resumo por quarter", margin, cursor);
  autoTable(doc, { startY: cursor + 3, margin: { left: margin, right: margin }, head: [["Quarter", "Bolso", "Realizado (USD)", "Meta (USD)", "Atingimento", "Accounts"]], body: report.quarterLines.map((line) => [line.period, line.category, money(line.actual), money(line.target), percent(line.attainment), line.accounts]), theme: "striped", headStyles: { fillColor: [25, 101, 97], textColor: 255, fontStyle: "bold" }, styles: { font: "helvetica", fontSize: 7, cellPadding: 2, overflow: "linebreak" }, columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 30 }, 2: { halign: "right", cellWidth: 30 }, 3: { halign: "right", cellWidth: 30 }, 4: { halign: "right", cellWidth: 24 } } });
  cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Atingimento mensal e acumulado", margin, cursor);
  autoTable(doc, { startY: cursor + 3, margin: { left: margin, right: margin, top: 30 }, showHead: "everyPage", head: [["Mês", "Bolso", "Real mensal", "Meta mensal", "% mensal", "Real acumulado", "Meta acumulada", "% acumulado"]], body: report.monthlyLines.map((line) => [line.period, line.category, money(line.actual), money(line.target), percent(line.attainment), money(line.cumulativeActual), money(line.cumulativeTarget), percent(line.cumulativeAttainment)]), theme: "striped", headStyles: { fillColor: [25, 101, 97], textColor: 255, fontStyle: "bold" }, styles: { font: "helvetica", fontSize: 7, cellPadding: 2 }, didDrawPage: ({ pageNumber }) => { if (pageNumber > 1) addHeader(); } });
  cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (cursor > 150) { doc.addPage(); addHeader(); cursor = 34; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Totais dos quarters selecionados", margin, cursor);
  autoTable(doc, { startY: cursor + 3, margin: { left: margin, right: margin }, head: [["Bolso", "Realizado (USD)", "Meta (USD)", "Atingimento"]], body: report.totals.map((line) => [line.category, money(line.actual), money(line.target), percent(line.attainment)]), theme: "grid", headStyles: { fillColor: [19, 45, 49], textColor: 255 }, styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5 }, columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } } });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) { doc.setPage(page); doc.setTextColor(90, 100, 105); doc.setFontSize(7); doc.text(`Painel de Sell-Out · Página ${page} de ${pages}`, pageWidth - margin, 202, { align: "right" }); }
  doc.save(`relatorio-sell-out-${safeDate(report.generatedAt)}.pdf`);
}