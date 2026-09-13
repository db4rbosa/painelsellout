import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ShieldBan, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteAccount, getAccessInfo, listAccounts, setAccountStatus, type AccountRow } from "@/lib/account.functions";

export const Route = createFileRoute("/usuarios")({
  ssr: false,
  loader: async () => {
    const identity = await getAccessInfo();
    if (identity.kind === "none") throw redirect({ to: "/unlock" });
    if (!identity.isAdmin) throw redirect({ to: "/" });
    return { name: identity.name };
  },
  head: () => ({
    meta: [
      { title: "Gerenciar usuários | Sales Out Analytics" },
      { name: "description", content: "Aprove, bloqueie ou remova contas do painel de Sales Out." },
      { property: "og:title", content: "Gerenciar usuários | Sales Out Analytics" },
      { property: "og:description", content: "Administração das contas de acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const router = useRouter();
  const fetchAccounts = useServerFn(listAccounts);
  const changeStatus = useServerFn(setAccountStatus);
  const removeAccount = useServerFn(deleteAccount);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    try { setAccounts(await fetchAccounts()); }
    catch { setError("Não foi possível carregar os usuários."); }
  };
  useEffect(() => { void refresh(); }, []);

  const update = async (id: string, status: "approved" | "blocked") => {
    setBusyId(id); setError("");
    try { await changeStatus({ data: { id, status } }); await refresh(); }
    catch { setError("Não foi possível atualizar esse usuário."); }
    finally { setBusyId(""); }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Remover permanentemente a conta de ${name}?`)) return;
    setBusyId(id); setError("");
    try { await removeAccount({ data: { id } }); await refresh(); }
    catch { setError("Não foi possível remover esse usuário."); }
    finally { setBusyId(""); }
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Administração</p><h1 className="mt-2 flex items-center gap-2 text-3xl font-bold"><Users className="size-7" /> Usuários</h1><p className="mt-2 text-sm text-muted-foreground">Aprove novos cadastros e controle quem pode acessar o painel.</p></div>
        <Button variant="outline" asChild><Link to="/"><ArrowLeft className="size-4" /> Voltar ao painel</Link></Button>
      </header>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardHeader><CardTitle className="text-base">Contas cadastradas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Situação</TableHead><TableHead>Cadastro</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.name}</TableCell>
                  <TableCell>{account.email}</TableCell>
                  <TableCell><Badge variant={account.status === "approved" ? "default" : account.status === "blocked" ? "destructive" : "secondary"}>{account.status === "approved" ? "Aprovado" : account.status === "blocked" ? "Bloqueado" : "Pendente"}</Badge></TableCell>
                  <TableCell>{new Intl.DateTimeFormat("pt-BR").format(new Date(account.createdAt))}</TableCell>
                  <TableCell><div className="flex justify-end gap-2">
                    {account.status !== "approved" ? <Button size="sm" onClick={() => update(account.id, "approved")} disabled={busyId === account.id} title="Aprovar"><Check className="size-4" /> Aprovar</Button> : null}
                    {account.status !== "blocked" ? <Button size="sm" variant="outline" onClick={() => update(account.id, "blocked")} disabled={busyId === account.id} title="Bloquear"><ShieldBan className="size-4" /> Bloquear</Button> : null}
                    <Button size="icon" variant="destructive" onClick={() => remove(account.id, account.name)} disabled={busyId === account.id} title="Remover"><Trash2 className="size-4" /><span className="sr-only">Remover</span></Button>
                  </div></TableCell>
                </TableRow>
              ))}
              {!accounts.length ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Nenhum usuário cadastrado.</TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}