import type { SalesRow } from "./sales-data";

const SALES_LOBS = new Set(["mobility", "printer", "printers", "scanner", "scanners", "software"]);
const SERVICE_LOBS = new Set(["service", "services", "servico", "servicos"]);

/** Aggregate once per customer/account/month, independent of overlapping buckets. */
export function buildCustomerMonthlySales(rows: SalesRow[]) {
  const groups = new Map<string, {
    clienteFinal: string; account: string; anoFiscal: number; mesFiscal: number;
    mes: string; vendasUSD: number; servicosUSD: number; receitaTotalUSD: number;
  }>();
  for (const row of rows) {
    if (!row.endUser.trim() || row.endUser === "—") continue;
    const key = JSON.stringify([row.endUser, row.account, row.fiscalYear, row.fiscalMonth]);
    const item = groups.get(key) ?? {
      clienteFinal: row.endUser, account: row.account, anoFiscal: row.fiscalYear,
      mesFiscal: row.fiscalMonth, mes: row.monthLabel,
      vendasUSD: 0, servicosUSD: 0, receitaTotalUSD: 0,
    };
    const lob = row.lob.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    if (SALES_LOBS.has(lob)) item.vendasUSD += row.revenue;
    if (SERVICE_LOBS.has(lob)) item.servicosUSD += row.revenue;
    item.receitaTotalUSD += row.revenue;
    groups.set(key, item);
  }
  const items = [...groups.values()];
  const largest = (field: "vendasUSD" | "servicosUSD" | "receitaTotalUSD") => {
    if (!items.length) return [];
    const maximum = Math.max(...items.map((item) => item[field]));
    return items.filter((item) => item[field] === maximum);
  };
  return {
    criterio: "Soma das linhas por Cliente Final, Account e mês fiscal; Vendas e Serviços separados, sem duplicar bolsos.",
    maiorVendaMensal: largest("vendasUSD"),
    maiorServicoMensal: largest("servicosUSD"),
    maiorReceitaTotalMensal: largest("receitaTotalUSD"),
  };
}