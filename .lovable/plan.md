# Seleção múltipla de accounts e filtros por cliente

## O que muda na tela

1. **Vários accounts ao mesmo tempo**
   - O campo "Meu nome" passa a ser um seletor de múltipla escolha (ex.: Fabio + Manso).
   - Tudo na tela — receita, quantidade, linhas, gráficos, ranking e metas — passa a somar os accounts escolhidos, recalculando na hora a cada mudança.
   - Chips com os nomes escolhidos, com opção de remover um a um e "limpar tudo".

2. **Novos filtros de recorte**
   - Filtros de múltipla escolha para: Bill To HQ - Name, Reseller, Ship to Name, End User, Disti Std Name.
   - Cada filtro mostra apenas os valores existentes nos dados já filtrados, com busca por texto (as listas são grandes).
   - Vazio = "todos". Um resumo mostra quantos filtros estão ativos e um botão limpa todos.
   - Os filtros valem para os indicadores, gráficos, ranking e também para metas/atingimento.

3. **Metas por grupo de accounts**
   - Na aba "Metas e atingimento", a meta é atrelada ao grupo de accounts selecionado (um ou vários).
   - A meta é salva por grupo (ordem alfabética dos nomes), então "Fabio + Manso" tem sua própria meta, independente das metas individuais.
   - O título mostra os accounts do grupo e o atingimento usa a soma real desse grupo.

4. **Campo de meta com formatação numérica**
   - Digitar `3000000` exibe `3,000,000` enquanto digita; aceita colar `3,000,000` ou `3.000.000`.
   - Mesmo comportamento na meta anual e nas quatro metas de quarter.

## Detalhes técnicos

- `src/lib/sales-data.ts`: `uniqueValues` recebe rows já filtradas; adicionar helper `applyFilters(rows, { accounts, billTo, reseller, shipTo, endUser, disti })` usando `Set` para performance com ~21k linhas.
- `src/components/MultiSelectFilter.tsx` (novo): popover + command (componentes shadcn já presentes) com busca, checkboxes, contador e limpar.
- `src/components/SalesDashboard.tsx`: trocar `person: string` por `accounts: string[]`; estado único de filtros; `useMemo` derivando `filteredRows` uma vez e reaproveitando em KPIs, série, ranking e atingimento.
- `src/lib/targets.ts`: chave de storage passa a ser o grupo (`accounts.slice().sort().join(" | ")`), mantendo o mesmo formato `Targets`; migração simples: se não houver meta do grupo e o grupo tiver 1 account, ler a chave antiga.
- `src/components/TargetPanel.tsx`: `Input` numérico formatado (máscara com separador de milhar, valor interno numérico) e cabeçalho com a lista de accounts.
- Sem backend: tudo continua no navegador, metas no armazenamento local.
