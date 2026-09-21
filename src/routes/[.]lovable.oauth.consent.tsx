import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Link2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id:
      typeof search["authorization_id"] === "string" ? search["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Solicitação de autorização inválida.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = `${location.pathname}${location.searchStr}`;
      throw redirect({ to: "/unlock", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id") ?? "";
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(
      authorizationId,
    );
    if (error) throw error;
    if ("redirect_url" in data) throw redirect({ href: data.redirect_url });

    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.status !== "approved") throw new Error("Esta conta ainda não está aprovada.");
    return data;
  },
  head: () => ({
    meta: [
      { title: "Autorizar integração | Painel de Sell Out" },
      {
        name: "description",
        content: "Autorize uma integração de agente a consultar seus dados no Painel de Sell Out.",
      },
      { property: "og:title", content: "Autorizar integração | Painel de Sell Out" },
      {
        property: "og:description",
        content: "Revise e autorize o acesso de leitura aos dados do seu painel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Não foi possível autorizar</CardTitle>
          <CardDescription>{error.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" asChild>
            <a href="/unlock">Voltar para o acesso</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function decide(approve: boolean) {
    setBusy(true);
    setError("");
    const result = approve
      ? await supabase.auth.oauth.approveAuthorization(authorization_id, {
          skipBrowserRedirect: true,
        })
      : await supabase.auth.oauth.denyAuthorization(authorization_id, {
          skipBrowserRedirect: true,
        });
    if (result.error) {
      setBusy(false);
      setError(result.error.message);
      return;
    }
    window.location.assign(result.data.redirect_url);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Link2 className="size-5" />
          </div>
          <CardTitle>Conectar {details.client.name || "um agente"}</CardTitle>
          <CardDescription>
            A integração será vinculada à conta {details.user.email}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border border-border bg-muted/40 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-primary" /> Acesso somente para leitura
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              O agente poderá consultar seu perfil, suas configurações e metas, além dos dados
              descritivos da última planilha. O arquivo não será compartilhado.
            </p>
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
              Negar
            </Button>
            <Button disabled={busy} onClick={() => decide(true)}>
              {busy ? "Aguarde..." : "Autorizar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}