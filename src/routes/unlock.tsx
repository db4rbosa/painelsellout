import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/gate.functions";
import { getAccessInfo } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/unlock")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const next = search["next"];
    return typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? { next }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Acesso restrito | Sales Out Analytics" },
      {
        name: "description",
        content: "Área restrita: informe usuário e senha para acessar o painel de sell-out e metas.",
      },
      { property: "og:title", content: "Acesso restrito | Sales Out Analytics" },
      {
        property: "og:description",
        content: "Informe usuário e senha para acessar o painel de sell-out e metas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UnlockPage,
});

function UnlockPage() {
  const router = useRouter();
  const { next } = Route.useSearch();
  const doLogin = useServerFn(login);
  const readAccess = useServerFn(getAccessInfo);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const username = String(form.get("username") ?? "").trim();
      const password = String(form.get("password") ?? "");
      if (username.includes("@")) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: username.toLowerCase(),
          password,
        });
        if (authError) {
          setError("E-mail ou senha incorretos");
          return;
        }
        const identity = await readAccess();
        if (identity.kind === "none") {
          await supabase.auth.signOut();
          setError(
            identity.reason === "pending"
              ? "Seu cadastro ainda aguarda aprovação do administrador."
              : identity.reason === "blocked"
                ? "Seu acesso está bloqueado. Fale com o administrador."
                : "Sua conta ainda não está liberada para acesso.",
          );
          return;
        }
      } else {
        const { ok } = await doLogin({ data: { username, password } });
        if (!ok) {
          setError("Usuário ou senha incorretos");
          return;
        }
      }
      await router.invalidate();
      if (next) {
        window.location.assign(next);
      } else {
        await router.navigate({ to: "/", replace: true });
      }
    } catch {
      setError("Não foi possível validar o acesso. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Sales Out · Fiscal Analytics
          </p>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Lock className="size-4 text-primary" /> Acesso restrito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">Usuário master ou e-mail</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                placeholder="seu@email.com"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy || !ready}>
              {busy ? "Verificando..." : ready ? "Entrar" : "Carregando..."}
            </Button>
            <div className="flex items-center justify-between gap-3 text-sm">
              <Button variant="link" className="h-auto px-0" asChild>
                <Link to="/nova-senha">Esqueci minha senha</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/cadastro">
                  <UserPlus className="size-4" /> Criar conta
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
