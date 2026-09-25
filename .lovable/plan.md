# Bolsos configuráveis e exportação detalhada em Excel

## Objetivo
Permitir que cada usuário organize as linhas de negócio em 1 a 4 bolsos independentes e use essa configuração em metas, atingimento, gráficos e na exportação das linhas importadas.

## Implementação
- Adicionar uma área **Configuração de bolsos** no painel para escolher de 1 a 4 bolsos.
- Permitir nomear cada bolso e selecionar uma ou mais opções de **Line of Business**.
- Impedir que a mesma opção de Line of Business seja usada em mais de um bolso.
- Manter uma configuração inicial compatível com o painel atual:
  - **REVENUE - M1**: Mobility, Printer/Printers, Scanner/Scanners e Software.
  - **SERVIÇOS - M4**: Service/Services.
- Salvar os bolsos nas preferências do usuário e restaurá-los nos próximos acessos e nas novas planilhas.
- Generalizar as metas para que cada bolso tenha valores próprios em Q1–Q4.
- Exibir realizado, meta e atingimento mensal, por quarter e total para cada bolso.
- Atualizar o gráfico acumulado para apresentar o realizado e a meta de cada bolso, sem dupla contagem.

## Exportação
- Substituir o botão **Exportar CSV** por **Exportar Excel**.
- Gerar um arquivo `.xlsx` com uma aba por bolso configurado.
- Cada aba conterá todas as colunas normalizadas e todas as linhas importadas pertencentes ao bolso, limitadas aos accounts, quarters e demais filtros ativos.
- Preservar o PDF como relatório resumido, adaptando seus blocos aos bolsos configurados.
- Carregar a biblioteca do Excel somente no clique para não prejudicar a abertura do painel.

## Compatibilidade
- Converter automaticamente configurações antigas de Vendas e Serviços para os dois bolsos iniciais.
- Quando uma nova Line of Business surgir na planilha, deixá-la disponível para configuração sem atribuição automática.
- Sanitizar nomes duplicados ou inválidos de abas do Excel sem alterar o nome exibido do bolso no painel.

## Validação
- Confirmar exclusividade das opções de Line of Business entre bolsos.
- Conferir que as somas das abas correspondem às linhas filtradas exibidas no painel.
- Validar metas e atingimento de 1, 2, 3 e 4 bolsos, incluindo troca de planilha.
- Abrir e inspecionar o Excel gerado, verificando abas, cabeçalhos, linhas e ausência de erros.
- Verificar o painel em tela ampla e celular e confirmar a compilação sem erros.