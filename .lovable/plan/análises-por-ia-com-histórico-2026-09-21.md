# Análises por IA com histórico

## Objetivo
Adicionar ao painel uma área onde usuários aprovados possam abrir várias conversas e perguntar, em português, sobre metas, atingimento e dados da planilha atual. As respostas serão geradas pelo Lovable AI e vinculadas aos dados e filtros salvos do próprio usuário.

## Experiência
- Adicionar o acesso “Análises com IA” ao painel.
- Criar uma lista de conversas com ação para iniciar, renomear e excluir conversas.
- Cada conversa terá uma página própria e continuará disponível após sair ou trocar de dispositivo.
- Exibir perguntas imediatamente, indicador “Analisando...” e respostas progressivas.
- Manter a caixa de pergunta focada e permitir interromper uma resposta em andamento.
- Mostrar erros claros do serviço sem substituir a resposta por texto genérico.

## Dados usados nas respostas
- Usar a configuração salva do usuário: accounts gerais, accounts por quarter, quarters, filtros e metas gerais/de Serviços.
- Ler a última planilha salva e calcular no servidor somente os agregados necessários para responder: vendas e Serviços por mês/quarter, metas, atingimento e agrupamentos relevantes.
- Nunca enviar a planilha completa ao navegador ou ao modelo; enviar apenas um resumo estruturado e limitado, preservando o isolamento entre usuários.
- Recalcular o contexto quando a planilha ou configuração mudar.

## Segurança e histórico
- Criar tabelas de conversas e mensagens com acesso restrito ao dono autenticado e aprovado.
- O login master continuará acessando o painel, mas a área de IA será exclusiva para contas individuais aprovadas.
- Validar no servidor que toda conversa pertence ao usuário antes de carregar, responder, renomear ou excluir.
- Salvar a pergunta e a resposta concluída na mesma conversa.

## Integração com IA
- Usar o AI Gateway no servidor com `openai/gpt-6-astra`, respostas em streaming e raciocínio em nível médio.
- Reenviar o histórico textual da conversa a cada pergunta, sem depender de memória do provedor.
- Propagar o identificador seguro da execução e tratar limites, créditos, configuração e indisponibilidade conforme o status real retornado.

## Implementação técnica
- Instalar AI SDK e os componentes oficiais AI Elements para conversa, mensagem, entrada e estado de análise.
- Criar uma rota de lista e uma rota dedicada por conversa, além de uma rota de streaming protegida.
- Adicionar migração com tabelas, permissões, RLS, índices e gatilhos de atualização.
- Montar um resumo analítico determinístico a partir da planilha e das preferências atuais antes de chamar o modelo.

## Validação
- Validar que duas conversas mantêm históricos independentes após recarregar.
- Confirmar que usuário pendente/bloqueado e login master não acessam a área de IA.
- Fazer uma chamada real ao AI Gateway e conferir resposta, streaming, persistência e erros.
- Verificar a apresentação em desktop e celular, além da compilação e dos testes relevantes.
