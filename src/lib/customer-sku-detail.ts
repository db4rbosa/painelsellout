import type { FilterKey, Filters, SalesRow } from "./sales-data";

type DetailCategory = "Vendas" | "Serviços" | "Outra";

export type CustomerSkuItem = {
  sku: string;
  linhaDeNegocio: string;
  categoria: DetailCategory;
  quantidade: number;
  receitaUSD: number;
};

type AppliedScope = {
  accounts: string[];
  quarters: string[];
  filtros: { nome: string; valores: string[] }[];
};

type CustomerSkuDetail =
  | {
      status: "cliente_nao_identificado";
      resultadoCompleto: false;
      mensagem: string;
      escopoAplicado: AppliedScope;
    }
  | {
      status: "ambiguo";
      resultadoCompleto: false;
      mensagem: string;
      clientesPossiveis: string[];
      escopoAplicado: AppliedScope;
    }
  | {
      status: "sem_resultados";
      resultadoCompleto: true;
      mensagem: string;
      clienteFinal: string;
      accounts: string[];
      itens: CustomerSkuItem[];
      subtotais: Record<DetailCategory | "Total geral", { quantidade: number; receitaUSD: number }>;
      escopoAplicado: AppliedScope;
    }
  | {
      status: "completo";
      resultadoCompleto: true;
      clienteFinal: string;
      accounts: string[];
      itens: CustomerSkuItem[];
      subtotais: Record<DetailCategory | "Total geral", { quantidade: number; receitaUSD: number }>;
      escopoAplicado: AppliedScope;
    };

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const GENERIC_CUSTOMER_WORDS = new Set([
  "brasil",
  "comercio",
  "empresa",
  "grupo",
  "industria",
  "loja",
  "lojas",
  "ltda",
  "sa",
  "servico",
  "servicos",
  "sociedade",
]);

const meaningfulTokens = (value: string) =>
  normalize(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !GENERIC_CUSTOMER_WORDS.has(token));

const customerMatches = (question: string, customer: string) => {
  const normalizedQuestion = normalize(question);
  const normalizedCustomer = normalize(customer);
  if (!normalizedQuestion || !normalizedCustomer || normalizedCustomer === "") return false;
  if (normalizedQuestion.includes(normalizedCustomer)) return true;
  const tokens = meaningfulTokens(customer);
  return tokens.some((token) => normalizedQuestion.split(" ").includes(token));
};

const categoryFor = (lob: string): DetailCategory => {
  const value = normalize(lob);
  if (["service", "services", "servico", "servicos"].includes(value)) return "Serviços";
  if (["mobility", "printer", "printers", "scanner", "scanners", "software"].includes(value)) {
    return "Vendas";
  }
  return "Outra";
};

const emptyTotals = () => ({ quantidade: 0, receitaUSD: 0 });

export function buildCustomerSkuDetail(input: {
  question: string;
  rows: SalesRow[];
  accounts: string[];
  selectedQuarters: number[];
  accountsByQuarter: Record<number, string[]>;
  filters: Filters;
  filterLabels: Record<FilterKey, string>;
}): CustomerSkuDetail {
  const scope: AppliedScope = {
    accounts: input.accounts,
    quarters: input.selectedQuarters.map((quarter) => `Q${quarter}`),
    filtros: (Object.entries(input.filters) as [FilterKey, string[]][])
      .filter(([, values]) => values.length > 0)
      .map(([key, values]) => ({ nome: input.filterLabels[key], valores: values })),
  };
  const selectedQuarters = new Set(input.selectedQuarters);
  const rowsInQuarterScope = input.rows.filter((row) => {
    if (!selectedQuarters.has(row.fiscalQuarter)) return false;
    const quarterAccounts = input.accountsByQuarter[row.fiscalQuarter] ?? [];
    return quarterAccounts.length === 0 || quarterAccounts.includes(row.account);
  });
  const customers = [...new Set(rowsInQuarterScope.map((row) => row.endUser).filter((name) => name !== "—"))];
  const explicitlyFiltered = input.filters.endUser.filter((name) => customers.includes(name));
  const matches = explicitlyFiltered.length === 1
    ? explicitlyFiltered
    : customers.filter((customer) => customerMatches(input.question, customer));

  if (matches.length === 0) {
    return {
      status: "cliente_nao_identificado",
      resultadoCompleto: false,
      mensagem: "Nenhum Cliente Final do escopo atual foi identificado na pergunta.",
      escopoAplicado: scope,
    };
  }
  if (matches.length > 1) {
    return {
      status: "ambiguo",
      resultadoCompleto: false,
      mensagem: "Mais de um Cliente Final corresponde à pergunta. Solicite que o usuário escolha um deles antes de calcular.",
      clientesPossiveis: matches.sort((a, b) => a.localeCompare(b)),
      escopoAplicado: scope,
    };
  }

  const customer = matches[0];
  if (!customer) throw new Error("Cliente Final não identificado.");
  const customerRows = rowsInQuarterScope.filter((row) => row.endUser === customer);
  const grouped = new Map<string, CustomerSkuItem>();
  for (const row of customerRows) {
    const sku = row.sku === "—" || !row.sku.trim() ? "SKU não informado" : row.sku;
    const key = `${sku}\u0000${row.lob}`;
    const item = grouped.get(key) ?? {
      sku,
      linhaDeNegocio: row.lob,
      categoria: categoryFor(row.lob),
      quantidade: 0,
      receitaUSD: 0,
    };
    item.quantidade += row.quantity;
    item.receitaUSD += row.revenue;
    grouped.set(key, item);
  }
  const items = [...grouped.values()].sort((a, b) => b.receitaUSD - a.receitaUSD);
  const subtotais = {
    Vendas: emptyTotals(),
    Serviços: emptyTotals(),
    Outra: emptyTotals(),
    "Total geral": emptyTotals(),
  };
  for (const item of items) {
    subtotais[item.categoria].quantidade += item.quantidade;
    subtotais[item.categoria].receitaUSD += item.receitaUSD;
    subtotais["Total geral"].quantidade += item.quantidade;
    subtotais["Total geral"].receitaUSD += item.receitaUSD;
  }
  const shared = {
    resultadoCompleto: true as const,
    clienteFinal: customer,
    accounts: [...new Set(customerRows.map((row) => row.account))].sort((a, b) => a.localeCompare(b)),
    itens: items,
    subtotais,
    escopoAplicado: scope,
  };
  return items.length
    ? { status: "completo", ...shared }
    : {
        status: "sem_resultados",
        mensagem: "Nenhuma linha foi encontrada para esse Cliente Final no escopo aplicado.",
        ...shared,
      };
}