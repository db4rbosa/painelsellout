# Contas de acesso, cadastro e memória da última configuração

## O que muda para você

1. **Tela de acesso** ganha dois caminhos:
   - **Acesso master**: continua `dbarbosa` / `br4dyc0rp!` (sem e-mail, entra direto e vê tudo).
   - **Acesso por e-mail e senha**: para os usuários cadastrados.
   - Novo botão **"Criar conta"** ao lado de Entrar.

2. **Cadastro de novo usuário** (`/cadastro`): nome, e-mail, senha e confirmação.
   Regras de senha: mínimo 8 caracteres, com letra maiúscula, letra minúscula,
   número e símbolo; indicador de força e mensagens claras de erro.
   Depois de cadastrar, a conta fica **aguardando sua aprovação**.

3. **Aprovação pelo master**: página **Usuários** (visível só para o master) lista
   quem se cadastrou, com botões Aprovar, Bloquear e Remover. Quem não foi
   aprovado vê "Sua conta aguarda aprovação" ao tentar entrar.

4. **Alterar senha** (dentro do painel): pede a senha atual e a nova.
   **Esqueci minha senha** na tela de acesso: envia um link por e-mail para
   definir uma nova senha (página `/nova-senha`).

5. **Planilha compartilhada**: a última planilha importada por qualquer usuário
   fica guardada e é carregada automaticamente para todos no próximo acesso —
   sem precisar importar de novo.

6. **Configuração pessoal salva**: accounts selecionados, filtros, agrupamento,
   período, métrica, tipo de gráfico, top séries, empilhamento e todas as metas
   ficam salvos por usuário. Ao abrir o painel, tudo volta exatamente como você
   deixou. Ao importar uma planilha nova, os cálculos são refeitos usando a sua
   configuração atual, sem precisar reconfigurar nada.

## Detalhes técnicos

- Ativar **Lovable Cloud** (banco, autenticação e armazenamento de arquivos).
- Autenticação por e-mail/senha do Cloud + reset de senha por e-mail. O master
  permanece no gate atual por sessão em cookie (`src/lib/gate.functions.ts`),
  e é tratado como papel `admin`.
- Tabelas:
  - `profiles` (id → auth.users, nome, e-mail, `status`: pending/approved/blocked)
  - `user_roles` + enum `app_role` + função `has_role` (security definer)
  - `user_preferences` (por usuário: JSON com filtros, seleções, opções de gráfico e metas)
  - `workbooks` (registro único do último arquivo: nome, tamanho, caminho no storage, quem enviou, data)
  - Todas com `GRANT` explícitos, RLS ligado: cada usuário lê/escreve só as
    próprias preferências; `workbooks` é legível por qualquer usuário aprovado;
    admin gerencia `profiles`.
- Storage: bucket privado `sales-workbooks`; upload do arquivo importado e
  download via URL assinada gerada em server function.
- Rotas: `/unlock` (login + botão criar conta + esqueci senha), `/cadastro`,
  `/nova-senha`, `/usuarios` (admin), painel em `/`.
- Gate do painel passa a aceitar sessão master **ou** usuário autenticado com
  `status = approved`.
- Persistência das preferências com debounce (~600 ms) para não gravar a cada
  clique; hidratação inicial antes de renderizar os gráficos.
- Parser de planilha continua no navegador (`src/lib/xlsx-fast.ts`); o arquivo
  baixado do storage passa pelo mesmo caminho, então a performance atual se mantém.
- Alterar senha usa reautenticação com a senha atual antes do update.
