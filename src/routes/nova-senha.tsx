import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkPassword, passwordRulesText } from "@/lib/password";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/nova-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha | Sales Out Analytics" },
      { name: "description", content: "Solicite o link ou defina uma nova senha de acesso." },
      { property: "og:title", content: "Redefinir senha | Sales Out Analytics" },
      { property: "og:description", content: "Recupere sua senha de acesso ao painel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NovaSenhaPage,
});

function NovaSenhaPage() {
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) =>
      setRecovery(Boolean(data.session) && window.location.hash.includes("type=recovery")),
    );
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const requestReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setBusy(true); setError(""); setMessage("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    });
    setBusy(false);
    if (resetError) setError("Não foi possível enviar o link. Confira o e-mail e tente novamente.");
    else setMessage("Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.");
  };

  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const confirmation = String(form.get("confirmation") ?? "");
    if (!checkPassword(password).ok) return setError(passwordRulesText);
    if (password !== confirmation) return setError("A confirmação da senha não confere.");
    setBusy(true); setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) setError("O link expirou ou não foi possível alterar a senha. Solicite outro link.");
    else setMessage("Senha alterada. Você já pode acessar sua conta.");
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md">
        <CardHeader><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Sales Out · Fiscal Analytics</p><CardTitle className="flex items-center gap-2 text-xl"><KeyRound className="size-5 text-primary" /> {recovery ? "Criar nova senha" : "Recuperar senha"}</CardTitle></CardHeader>
        <CardContent>
          {recovery ? (
            <form className="space-y-4" onSubmit={updatePassword}>
              <div className="space-y-2"><Label htmlFor="password">Nova senha</Label><Input id="password" name="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required /><p className="text-xs text-muted-foreground">{passwordRulesText}</p></div>
              <div className="space-y-2"><Label htmlFor="confirmation">Confirmar nova senha</Label><Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required /></div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Alterando..." : "Salvar nova senha"}</Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={requestReset}>
              <p className="text-sm text-muted-foreground">Enviaremos um link de redefinição para o e-mail cadastrado.</p>
              <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Enviando..." : "Enviar link"}</Button>
            </form>
          )}
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          {message ? <p className="mt-4 text-sm text-primary">{message}</p> : null}
          <Button variant="link" className="mt-3 w-full" asChild><Link to="/unlock"><ArrowLeft className="size-4" /> Voltar para o acesso</Link></Button>
        </CardContent>
      </Card>
    </main>
  );
}