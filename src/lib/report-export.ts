import { FILTER_DIMS, FILTER_LABELS, type Filters } from "./sales-data";
import type { AttainmentResult, QuarterAccounts } from "./targets";

export type ReportContext = {
  fileName: string;
  accounts: string[];
  allAccountOptions: string[];
  filters: Filters;
  selectedQuarters: number[];
  accountsByQuarter: QuarterAccounts;
  attainment: AttainmentResult;
};

type ReportLine = {
  period: string;
  category: "Vendas" | "Serviços";
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
  quarterLines: ReportLine[];
  monthlyLines: ReportLine[];
  totals: ReportLine[];
};

const ratio = (actual: number, target: number) => (target > 0 ? actual / target : null);
const displayAccounts = (accounts: string[], fallback: string[]) =>
  accounts.length ? accounts : fallback;

export function buildSalesReport(context: ReportContext): SalesReport {
  const selected = [...context.selectedQuarters].sort((a, b) => a - b);
  const quarterAccounts = selected.map((quarter) => ({
    quarter,
    accounts: displayAccounts(context.accountsByQuarter[quarter] ?? [], context.allAccountOptions),
  }));
  const accountTextFor = (quarter: number) =>
    quarterAccounts.find((item) => item.quarter === quarter)?.accounts.join(", ") ?? "—";

  const quarterLines: ReportLine[] = [];
  for (const quarter of selected) {
    const sales = context.attainment.quarters[quarter - 1];
    const services = context.attainment.servicesQuarters[quarter - 1];
    if (sales) {
      quarterLines.push({
        period: `Q${quarter}`,
        category: "Vendas",
        accounts: accountTextFor(quarter),
        actual: sales.actual,
        target: sales.target,
        attainment: sales.attainment,
        cumulativeActual: sales.actual,
        cumulativeTarget: sales.target,
        cumulativeAttainment: sales.attainment,
      });
    }
    if (services) {
      quarterLines.push({
        period: `Q${quarter}`,
        category: "Serviços",
        accounts: accountTextFor(quarter),
        actual: services.actual,
        target: services.target,
        attainment: services.attainment,
        cumulativeActual: services.actual,
        cumulativeTarget: services.target,
        cumulativeAttainment: services.attainment,
      });
    }
  }

  let salesActual = 0;
  let salesTarget = 0;
  let servicesActual = 0;
  let servicesTarget = 0;
  const monthlyLines: ReportLine[] = [];
  context.attainment.months.forEach((sales, monthIndex) => {
    const quarter = Math.ceil((monthIndex + 1) / 3);
    if (!selected.includes(quarter)) return;
    const services = context.attainment.servicesMonths[monthIndex];
    if (!services) return;
    salesActual += sales.actual;
    salesTarget += sales.target;
    servicesActual += services.actual;
    servicesTarget += services.target;
    monthlyLines.push({
      period: sales.label,
      category: "Vendas",
      accounts: accountTextFor(quarter),
      actual: sales.actual,
      target: sales.target,
      attainment: sales.attainment,
      cumulativeActual: salesActual,
      cumulativeTarget: salesTarget,
      cumulativeAttainment: ratio(salesActual, salesTarget),
    });
    monthlyLines.push({
      period: services.label,
      category: "Serviços",
      accounts: accountTextFor(quarter),
      actual: services.actual,
      target: services.target,
      attainment: services.attainment,
      cumulativeActual: servicesActual,
      cumulativeTarget: servicesTarget,
      cumulativeAttainment: ratio(servicesActual, servicesTarget),
    });
  });

  const totalAccounts = quarterAccounts.flatMap((item) => item.accounts);
  const uniqueTotalAccounts = [...new Set(totalAccounts)].join(", ");
  const totals: ReportLine[] = [
    {
      period: "Total",
      category: "Vendas",
      accounts: uniqueTotalAccounts || "—",
      ...context.attainment.total,
      cumulativeActual: context.attainment.total.actual,
      cumulativeTarget: context.attainment.total.target,
      cumulativeAttainment: context.attainment.total.attainment,
    },
    {
      period: "Total",
      category: "Serviços",
      accounts: uniqueTotalAccounts || "—",
      ...context.attainment.servicesTotal,
      cumulativeActual: context.attainment.servicesTotal.actual,
      cumulativeTarget: context.attainment.servicesTotal.target,
      cumulativeAttainment: context.attainment.servicesTotal.attainment,
    },
  ];

  return {
    generatedAt: new Date(),
    fileName: context.fileName,
    generalAccounts: displayAccounts(context.accounts, context.allAccountOptions),
    filters: FILTER_DIMS.map((key) => ({ label: FILTER_LABELS[key], values: context.filters[key] }))
      .filter((item) => item.values.length),
    selectedQuarters: selected,
    quarterAccounts,
    quarterLines,
    monthlyLines,
    totals,
  };
}

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
const csvNumber = (value: number) => value.toFixed(2).replace(".", ",");
const csvPercent = (value: number | null) => (value === null ? "" : `${(value * 100).toFixed(1).replace(".", ",")}%`);

export function reportToCsv(report: SalesReport): string {
  const lines: string[][] = [];
  const add = (...cells: (string | number)[]) => lines.push(cells.map(String));
  add("RELATÓRIO DE METAS E ATINGIMENTO");
  add("Planilha", report.fileName);
  add("Gerado em", report.generatedAt.toLocaleString("pt-BR"));
  add("Quarters", report.selectedQuarters.map((q) => `Q${q}`).join(", "));
  add("Accounts gerais", report.generalAccounts.join(", "));
  report.filters.forEach((filter) => add(`Filtro: ${filter.label}`, filter.values.join(", ")));
  add("");
  add("ACCOUNTS POR QUARTER");
  add("Quarter", "Accounts");
  report.quarterAccounts.forEach((item) => add(`Q${item.quarter}`, item.accounts.join(", ")));
  add("");
  add("RESUMO POR QUARTER");
  add("Período", "Categoria", "Realizado (USD)", "Meta (USD)", "Atingimento", "Accounts");
  report.quarterLines.forEach((line) =>
    add(line.period, line.category, csvNumber(line.actual), csvNumber(line.target), csvPercent(line.attainment), line.accounts),
  );
  add("");
  add("ATINGIMENTO MENSAL E ACUMULADO");
  add("Mês", "Categoria", "Realizado mensal (USD)", "Meta mensal (USD)", "Atingimento mensal", "Realizado acumulado (USD)", "Meta acumulada (USD)", "Atingimento acumulado", "Accounts");
  report.monthlyLines.forEach((line) =>
    add(line.period, line.category, csvNumber(line.actual), csvNumber(line.target), csvPercent(line.attainment), csvNumber(line.cumulativeActual), csvNumber(line.cumulativeTarget), csvPercent(line.cumulativeAttainment), line.accounts),
  );
  add("");
  add("TOTAIS");
  add("Categoria", "Realizado (USD)", "Meta (USD)", "Atingimento");
  report.totals.forEach((line) => add(line.category, csvNumber(line.actual), csvNumber(line.target), csvPercent(line.attainment)));
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(";")).join("\r\n")}`;
}

const safeDate = (date: Date) => date.toISOString().slice(0, 10);
const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function downloadReportCsv(report: SalesReport) {
  downloadBlob(new Blob([reportToCsv(report)], { type: "text/csv;charset=utf-8" }), `relatorio-sell-out-${safeDate(report.generatedAt)}.csv`);
}

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const percent = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(1)}%`);
const shortList = (values: string[]) => values.join(", ") || "Todos";

export async function downloadReportPdf(report: SalesReport) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const addHeader = () => {
    doc.setFillColor(19, 45, 49);
    doc.rect(0, 0, pageWidth, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório de Metas e Atingimento", margin, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Gerado em ${report.generatedAt.toLocaleString("pt-BR")}`, margin, 18);
  };
  addHeader();
  doc.setTextColor(30, 41, 46);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Contexto do relatório", margin, 32);
  doc.setFont("helvetica", "normal");
  const contextRows = [
    ["Planilha", report.fileName],
    ["Quarters", report.selectedQuarters.map((q) => `Q${q}`).join(", ")],
    ["Accounts gerais", shortList(report.generalAccounts)],
    ...report.filters.map((item) => [`Filtro · ${item.label}`, shortList(item.values)]),
    ...report.quarterAccounts.map((item) => [`Accounts Q${item.quarter}`, shortList(item.accounts)]),
  ];
  autoTable(doc, {
    startY: 36,
    margin: { left: margin, right: margin },
    theme: "grid",
    body: contextRows,
    columnStyles: { 0: { cellWidth: 36, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2, overflow: "linebreak" },
    alternateRowStyles: { fillColor: [244, 247, 247] },
  });
  let cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Resumo por quarter", margin, cursor);
  autoTable(doc, {
    startY: cursor + 3,
    margin: { left: margin, right: margin },
    head: [["Quarter", "Categoria", "Realizado (USD)", "Meta (USD)", "Atingimento", "Accounts"]],
    body: report.quarterLines.map((line) => [line.period, line.category, money(line.actual), money(line.target), percent(line.attainment), line.accounts]),
    theme: "striped",
    headStyles: { fillColor: [25, 101, 97], textColor: 255, fontStyle: "bold" },
    styles: { font: "helvetica", fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 22 }, 2: { halign: "right", cellWidth: 30 }, 3: { halign: "right", cellWidth: 30 }, 4: { halign: "right", cellWidth: 24 } },
  });
  cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Atingimento mensal e acumulado", margin, cursor);
  autoTable(doc, {
    startY: cursor + 3,
    margin: { left: margin, right: margin, top: 30 },
    showHead: "everyPage",
    head: [["Mês", "Categoria", "Real mensal", "Meta mensal", "% mensal", "Real acumulado", "Meta acumulada", "% acumulado"]],
    body: report.monthlyLines.map((line) => [line.period, line.category, money(line.actual), money(line.target), percent(line.attainment), money(line.cumulativeActual), money(line.cumulativeTarget), percent(line.cumulativeAttainment)]),
    theme: "striped",
    headStyles: { fillColor: [25, 101, 97], textColor: 255, fontStyle: "bold" },
    styles: { font: "helvetica", fontSize: 7, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 22 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) addHeader();
    },
  });
  cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (cursor > 150) {
    doc.addPage();
    addHeader();
    cursor = 34;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Totais dos quarters selecionados", margin, cursor);
  autoTable(doc, {
    startY: cursor + 3,
    margin: { left: margin, right: margin },
    head: [["Categoria", "Realizado (USD)", "Meta (USD)", "Atingimento"]],
    body: report.totals.map((line) => [line.category, money(line.actual), money(line.target), percent(line.attainment)]),
    theme: "grid",
    headStyles: { fillColor: [19, 45, 49], textColor: 255 },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setTextColor(90, 100, 105);
    doc.setFontSize(7);
    doc.text(`Painel de Sell-Out · Página ${page} de ${pages}`, pageWidth - margin, 202, { align: "right" });
  }
  doc.save(`relatorio-sell-out-${safeDate(report.generatedAt)}.pdf`);
}
