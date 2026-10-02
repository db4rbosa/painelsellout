# Detalhamento de SKUs por cliente nas análises por IA

## Objetivo
Permitir que a análise por IA responda perguntas sobre equipamentos e serviços vendidos a um Cliente Final, com quantidade e receita por SKU, sempre respeitando o escopo atual do painel.

## O que será implementado
- Ler diretamente as linhas detalhadas da última planilha, preservando a relação entre Account, quarter, Cliente Final, SKU, Linha de Negócio, quantidade e receita.
- Aplicar accounts, quarters e todos os filtros ativos antes de localizar o Cliente Final solicitado na pergunta.
- Reconhecer o cliente mencionado sem substituir Cliente Final por revenda, destino de entrega ou outro campo.
- Quando houver mais de um Cliente Final compatível, fornecer as opções para a IA pedir confirmação antes de somar.
- Agrupar todas as linhas encontradas por SKU e Linha de Negócio, preservando valores negativos e registros sem SKU.
- Classificar cada grupo uma única vez como Vendas, Serviços ou outra Linha de Negócio, evitando duplicação.
- Incluir no contexto da IA a seção `detalhamentoSkusPorCliente`, com escopo, itens completos, subtotais e total geral.
- Orientar a resposta para apresentar Vendas e Serviços separadamente, com valores em USD e duas casas decimais.

## Validação
- Criar testes com dados controlados para accounts, quarters, filtros, valores negativos, SKU ausente e mais de 15 SKUs.
- Confirmar que clientes ambíguos não são somados automaticamente.
- Confirmar que a soma dos itens coincide com subtotais e total geral.
- Validar uma pergunta real na área de análises usando a planilha atual, quando houver uma sessão aprovada disponível.

## Detalhes técnicos
- O detalhamento será calculado no servidor a cada pergunta e somente para o usuário aprovado.
- A pergunta atual será usada para localizar candidatos entre os Clientes Finais já filtrados.
- O contexto indicará explicitamente se o resultado é completo, vazio, ambíguo ou se o cliente não foi identificado.
