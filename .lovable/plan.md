# Tela de acesso antes do painel

O painel de sell-out só aparece depois que a pessoa digitar usuário e senha corretos.

## Como vai funcionar

- Ao abrir o site, quem não estiver liberado vê uma tela de login com dois campos (usuário e senha) e o botão "Entrar".
- Usuário `dbarbosa` e senha `br4c0rp!` liberam o acesso. Senha errada mostra apenas "Usuário ou senha incorretos", sem dizer qual campo falhou.
- Depois de entrar, o acesso fica lembrado por 7 dias, mesmo recarregando a página ou fechando a aba.
- Um botão "Sair" no topo do painel encerra o acesso e volta para a tela de login.
- A verificação acontece no servidor: a senha nunca é enviada para o navegador nem fica visível no código do site.

## Observação de segurança

Isto é uma senha compartilhada, não contas de usuário: quem tiver a senha entra, e não é possível revogar o acesso de uma pessoa só. Se no futuro você quiser contas individuais, dá para trocar por login real depois.

## Detalhes técnicos

- Segredos do projeto (nunca com prefixo `VITE_`): `SITE_USERNAME=dbarbosa`, `SITE_PASSWORD=br4c0rp!`, e `SESSION_SECRET` gerado aleatoriamente para criptografar o cookie de sessão.
- `src/lib/gate.functions.ts`: `useSession` (`@tanstack/react-start/server`) com cookie httpOnly/secure/sameSite lax, `maxAge` 7 dias; `login` (compara usuário e senha com `timingSafeEqual` sobre digests sha256), `logout`, e `getGateStatus` para saber se está liberado.
- `src/routes/unlock.tsx`: formulário de login; em caso de sucesso navega para `/`.
- `src/routes/index.tsx`: `loader` chama uma server function que exige sessão liberada e lança `redirect({ to: "/unlock" })` quando não está; o `SalesDashboard` só monta depois disso. O `head()` da rota permanece genérico.
- Botão "Sair" no cabeçalho do `SalesDashboard` chamando `logout` via `useServerFn` e navegando para `/unlock`.
- Nenhuma mudança na lógica de importação de planilha, filtros ou metas.
