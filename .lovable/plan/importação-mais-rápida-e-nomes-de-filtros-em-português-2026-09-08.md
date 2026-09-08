# Importação mais rápida e nomes de filtros em português

## O que muda para você

1. **Abrir e ler a planilha muito mais rápido**
   - A biblioteca de leitura da planilha passa a ser carregada antecipadamente (quando a página fica ociosa e também ao passar o mouse/tocar no botão), então ao escolher o arquivo a leitura já começa na hora, sem a espera atual de baixar o leitor.
   - A leitura em si fica mais leve: o arquivo é lido em uma passada única, sem etapas intermediárias que criavam milhares de objetos a mais. Isso reduz bastante o tempo em planilhas com ~21 mil linhas.
   - Durante a leitura aparece um indicador imediato ("Lendo planilha...") em vez de a tela parecer travada.

2. **Nomes dos filtros em português**
   - Bill To HQ - Name → **Revenda HQ**
   - Reseller → **Revenda**
   - Ship to Name → **Destino Entrega**
   - End User → **Cliente Final**
   - Disti Std Name → **Distribuidor**
   - Os mesmos nomes passam a valer também na lista de agrupamento e nos títulos de gráfico/ranking, para não haver dois nomes para a mesma coisa.

## Detalhes técnicos

- `src/lib/sales-data.ts`
  - `parseWorkbook`: substituir `XLSX.utils.sheet_to_json` + `normalizeRows` por leitura direta da matriz (`sheet_to_json(..., { header: 1 })` no modo `dense`), montando um mapa de índice de coluna a partir da linha de cabeçalho (normalizando chaves como hoje) e construindo `SalesRow` em um único laço. Elimina a criação de 21k objetos intermediários e as ~21k chamadas de `normalizeKeys`/`pick`.
  - Manter `normalizeRows` exportado apenas se ainda houver consumidor; caso contrário remover.
  - Exportar `preloadWorkbookParser()` que dispara `import("xlsx")` e memoriza a promise; `parseWorkbook` reaproveita a mesma promise.
  - Atualizar `FILTER_LABELS` e os `label` correspondentes em `DIMENSIONS` para os novos nomes.
- `src/components/SalesDashboard.tsx`
  - Chamar `preloadWorkbookParser()` em um `useEffect` com `requestIdleCallback` (fallback `setTimeout`) e nos handlers `onPointerEnter`/`onFocus` dos dois botões de importar.
  - Em `handleFile`, garantir que o estado `loading` pinte antes do trabalho pesado (ceder um frame antes de chamar `parseWorkbook`).
- Sem backend; tudo continua no navegador.
