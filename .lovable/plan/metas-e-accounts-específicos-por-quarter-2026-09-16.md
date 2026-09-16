# Metas e accounts específicos por quarter

## O que muda na tela

1. **Seleção dos quarters avaliados**
   - Na aba **Metas e atingimento**, incluir seleção múltipla de Q1, Q2, Q3 e Q4.
   - Os resultados consolidados considerarão somente os quarters marcados.
   - Cada quarter marcado terá sua própria área de configuração e resultado.

2. **Accounts diferentes em cada quarter**
   - Cada quarter terá um seletor próprio, permitindo escolher de 1 até todos os accounts disponíveis no filtro geral do painel.
   - A combinação poderá ser diferente entre os quarters, por exemplo: Q1 com Fabio + Manso e Q2 somente com Fabio.
   - Se o filtro geral estiver vazio, todos os accounts da planilha estarão disponíveis; se estiver preenchido, ele limitará as opções de cada quarter.
   - Um quarter marcado só entra no consolidado quando tiver ao menos um account selecionado.

3. **Metas gerais e metas de Serviços**
   - Manter as metas gerais existentes e adicionar, em cada quarter, uma meta exclusiva para **Linha de Negócios = Services**.
   - Exibir para cada quarter: accounts escolhidos, realizado geral, meta geral, atingimento geral, realizado de Serviços, meta de Serviços e atingimento de Serviços.
   - A identificação de Services será sem diferenciação entre maiúsculas e minúsculas e ignorará espaços nas extremidades.

4. **Soma total dos quarters escolhidos**
   - Criar um resumo consolidado com a soma dos realizados e metas dos quarters avaliados.
   - Mostrar separadamente o total geral e o total de Serviços, ambos com percentual de atingimento.
   - O detalhamento mensal continuará disponível, calculado somente com os accounts configurados para o quarter ao qual cada mês pertence.

5. **Persistência e compatibilidade**
   - Salvar por usuário os quarters avaliados, os accounts de cada quarter e as metas gerais e de Serviços.
   - Configurações antigas continuam válidas: metas gerais já cadastradas serão preservadas, metas de Serviços começam em zero e os novos seletores recebem valores seguros quando possível.
   - Ao importar outra planilha, manter as escolhas e recalcular tudo automaticamente com os novos dados.

## Detalhes técnicos

- Estender `Targets` com quatro metas de Serviços, preservando a meta anual geral existente para compatibilidade.
- Adicionar às preferências `selectedQuarters` e `accountsByQuarter`, com normalização defensiva dos dados antigos.
- Calcular o escopo de metas linha a linha: quarter selecionado + account pertencente ao grupo daquele quarter + filtros gerais atuais.
- Produzir atingimentos gerais e de Serviços no mesmo cálculo, incluindo mês, quarter e consolidado dos quarters selecionados.
- Atualizar `TargetPanel` para controlar quarters, accounts e os dois conjuntos de metas sem alterar os filtros e gráficos da aba Evolução.
- Não é necessária alteração no banco: os novos campos continuam dentro das preferências já salvas por usuário.
