# Disponibilidade automática das análises com IA

## Objetivo
Desativar o botão “Análises com IA” enquanto o AI Gateway estiver sem créditos e reativá-lo automaticamente quando o serviço voltar a aceitar solicitações.

## Experiência
- Exibir o botão desativado com o texto “IA sem créditos” quando o saldo estiver indisponível.
- Mostrar uma explicação curta ao lado do botão, sem permitir que o usuário entre na área de análises durante o bloqueio.
- Manter o botão ativo normalmente quando houver créditos.

## Funcionamento
- Registrar no sistema a indisponibilidade assim que o AI Gateway responder com falta de créditos.
- Consultar esse estado ao abrir o painel e antes de entrar em “Análises com IA”.
- Fazer uma verificação controlada, no máximo uma vez por período, para detectar renovação ou inclusão de créditos sem gerar tentativas repetidas.
- Reativar automaticamente o recurso após uma verificação bem-sucedida do serviço.
- Preservar os tratamentos atuais para limite temporário, configuração e demais erros; apenas falta de créditos bloqueará o botão.

## Segurança e consistência
- Fazer todas as verificações no servidor, sem expor chaves ou informações de cobrança no navegador.
- Compartilhar o mesmo estado entre usuários e dispositivos.
- Impedir acesso direto à página de análises enquanto o bloqueio por créditos estiver ativo.

## Validação
- Confirmar o botão desativado com o saldo atual de 0 crédito.
- Validar que uma resposta 402 mantém o bloqueio e uma verificação bem-sucedida o remove.
- Verificar o painel em celular e computador, além da compilação e dos testes relevantes.
