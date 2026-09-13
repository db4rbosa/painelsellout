import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAccount } from "@/lib/account.functions";
import { checkPassword, passwordRulesText } from "@/lib/password";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta | Sales Out Analytics" },
      { name: "description", content: "Cadastre uma conta para solicitar acesso ao painel de Sales Out." },
      { property: "og:title", content: "Criar conta | Sales Out Analytics" },
      { property: "og:description", content: "Solicite acesso ao painel de Sales Out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CadastroPage,
});

function CadastroPage() {
  const createAccount = useServerFn(signUpAccount);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const passwordCheck = checkPassword(password);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const confirmation = String(form.get("confirmation") ?? "");
    if (!passwordCheck.ok) return setError(passwordRulesText);
    if (password !== confirmation) return setError("A confirmação da senha não confere.");
    setBusy(true);
    setError("");
    try {
      const result = await createAccount({
        data: {
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          password,
        },
      });
      if (result.ok) setDone(true);
      else setError(result.error);
    } catch {
      setError("Não foi possível criar sua conta. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Sales Out · Fiscal Analytics</p>
          <CardTitle className="flex items-center gap-2 text-xl"><UserPlus className="size-5 text-primary" /> Criar conta</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4">
              <p className="text-sm">Cadastro enviado. O administrador precisa aprovar sua conta antes do primeiro acesso.</p>
              <Button className="w-full" asChild><Link to="/unlock">Voltar para o acesso</Link></Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2"><Label htmlFor="name">Nome completo</Label><Input id="name" name="name" autoComplete="name" required /></div>
              <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <p className="text-xs text-muted-foreground">{passwordRulesText}</p>
                {password ? <p className={`text-xs ${passwordCheck.ok ? "text-primary" : "text-muted-foreground"}`}>{passwordCheck.ok ? "Senha segura" : `${passwordCheck.problems.length} requisito(s) pendente(s)`}</p> : null}
              </div>
              <div className="space-y-2"><Label htmlFor="confirmation">Confirmar senha</Label><Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required /></div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Criando..." : "Criar conta"}</Button>
              <Button variant="link" className="w-full" asChild><Link to="/unlock"><ArrowLeft className="size-4" /> Voltar</Link></Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}