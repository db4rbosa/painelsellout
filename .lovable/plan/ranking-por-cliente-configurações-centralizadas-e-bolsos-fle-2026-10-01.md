# Ranking por cliente, configurações centralizadas e bolsos flexíveis

## Objetivo
Reorganizar o painel sem alterar as configurações já salvas, detalhar clientes por Account e permitir que a mesma Line of Business participe de mais de um bolso.

## Implementação

### 1. Ranking por Cliente Final
- Quando o agrupamento for **Cliente Final**, organizar a tabela em blocos por **Account**.
- Manter receita, quantidade, linhas e participação calculadas dentro do escopo atual.
- Transformar o nome do cliente em ação clicável.
- Abrir um modal com os dados daquele cliente e Account: totais, evolução mensal e linhas de venda detalhadas.
- Manter o ranking atual para os demais tipos de agrupamento.

### 2. Configurações do Sistema
- Remover **Escopo e filtros** e **Configuração de bolsos** do fluxo principal.
- Adicionar um botão com engrenagem no cabeçalho.
- Abrir um painel lateral responsivo com transição suave.
- Mover para esse painel todos os seletores de accounts, filtros e bolsos, incluindo limpeza e contagem de linhas no escopo.
- Usar os mesmos estados e a persistência já existente, de modo que qualquer alteração continue recalculando o painel em tempo real.

### 3. Bolsos com LOB repetida
- Remover a exclusividade visual que apaga uma LOB dos outros bolsos.
- Permitir selecionar a mesma LOB em qualquer combinação de 1 a 4 bolsos.
- Alterar o cálculo para que uma linha contribua integralmente para cada bolso compatível, em vez de somente para o primeiro.
- Preservar metas independentes por bolso e quarter.
- Alinhar gráficos, PDF, Excel e contexto da IA ao mesmo cálculo multi-bolso.

## Validação
- Confirmar que filtros e bolsos persistem após fechar/reabrir as configurações e recarregar a página.
- Confirmar que uma LOB duplicada soma corretamente em cada bolso, sem misturar as metas.
- Confirmar agrupamento por Account, abertura e fechamento do detalhe do cliente e dados filtrados corretos.
- Validar tela principal em desktop e viewport estreito, exportações, verificação de tipos e build.

## Detalhes técnicos
- O detalhe será um modal sobre a tela atual, evitando uma nova rota e preservando o contexto do painel.
- A associação de linhas aos bolsos passará de “primeiro bolso correspondente” para “todos os bolsos correspondentes”.
- O Excel continuará com uma aba por bolso; uma linha poderá aparecer em mais de uma aba quando sua LOB estiver configurada em mais de um bolso.
