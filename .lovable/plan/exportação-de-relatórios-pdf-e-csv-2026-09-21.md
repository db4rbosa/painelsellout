# Exportação de relatórios PDF e CSV

## Objetivo
Adicionar ao painel uma opção de baixar o recorte atual de metas e atingimento, mantendo Vendas e Serviços separados e respeitando os accounts, quarters e demais filtros selecionados.

## Implementação
- Criar uma estrutura única de relatório a partir dos cálculos já exibidos no painel, evitando divergências entre tela, PDF e CSV.
- Incluir no relatório:
  - identificação da planilha e data/hora da geração;
  - accounts gerais e accounts específicos de cada quarter;
  - quarters avaliados e filtros ativos;
  - resumo dos quarters selecionados;
  - atingimento mensal e acumulado;
  - seções e totais distintos para Vendas e Serviços.
- Adicionar botões “Exportar PDF” e “Exportar CSV” no painel, habilitados quando houver uma planilha carregada.
- Gerar os arquivos no navegador, sem enviar os dados da planilha para outro serviço.
- Usar nomes de arquivo claros e datados.

## Detalhes técnicos
- CSV em UTF-8 com BOM e separador `;`, adequado ao Excel em português.
- PDF em formato paisagem, com cabeçalho, contexto dos filtros, tabelas de resumo trimestral e evolução mensal/acumulada.
- Carregar a biblioteca de PDF apenas no clique, preservando o tempo de abertura do painel e da importação.
- Tratar listas longas de accounts e filtros com quebra de linha/paginação no PDF.

## Validação
- Conferir que valores mensais, acumulados e totais coincidem com a tela.
- Conferir separação sem dupla contagem entre Vendas e Serviços.
- Validar os dois downloads e inspecionar visualmente todas as páginas do PDF.
- Confirmar compilação e funcionamento em tela ampla e celular.
