# Detalhamento para todos os agrupamentos do gráfico

## O que muda

1. **Todos os rankings terão detalhes clicáveis**
   - Para qualquer opção escolhida em **Agrupar por** — Linha de Negócio, Distribuidor, Revenda, Revenda HQ, Destino Entrega, Cliente Final, SKU, CBM, Account/Vendedor, Segmento, Estado ou Cidade — o nome no ranking abrirá os dados vendidos daquele item.
   - **Sem agrupamento (total)** continuará sem ranking, pois não existe um item individual para abrir.

2. **Janela de detalhes reutilizável**
   - Generalizar a janela atual de Cliente Final para filtrar pela dimensão e pelo valor selecionados.
   - Exibir receita, quantidade, número de linhas, evolução mensal por Linha de Negócio e todas as linhas de venda correspondentes.
   - Manter Cliente Final separado por Account: ao abrir um cliente, mostrar somente as linhas daquele cliente dentro do Account exibido, evitando misturar clientes homônimos.
   - Adaptar título e contexto da janela ao agrupamento selecionado.

3. **Consistência com o painel**
   - Usar exatamente as linhas já limitadas pelos Accounts e filtros ativos.
   - Ao trocar o agrupamento, fechar qualquer detalhe anterior para não exibir dados de outra dimensão.
   - Preservar ranking, gráficos, metas, exportações e preferências atuais.

## Detalhes técnicos

- Criar uma seleção genérica contendo `dimension`, `value` e, opcionalmente, `account` para Cliente Final.
- Generalizar `CustomerDetailsDialog` para um diálogo de detalhes do agrupamento, usando `SalesRow[dimension]` para filtrar as linhas.
- Transformar os nomes do ranking padrão em ações de link e reutilizar o mesmo diálogo no ranking especial de Cliente Final.
- Validar abertura e dados para múltiplas dimensões, Cliente Final por Account, filtros ativos, desktop e celular; conferir testes, tipos e build.
