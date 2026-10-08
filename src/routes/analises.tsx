import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { getAccessInfo } from "@/lib/account.functions";
import { getAiStatus } from "@/lib/ai-status.functions";

export const Route = createFileRoute("/analises")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Conversas de análise | Sell-Out e Metas" },
    { name: "description", content: "Conversas privadas para analisar resultados de sell-out e metas." },
    { property: "og:title", content: "Conversas de análise | Sell-Out e Metas" },
    { property: "og:description", content: "Conversas privadas para analisar resultados de sell-out e metas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: async () => {
    const identity = await getAccessInfo();
    if (identity.kind === "none") throw redirect({ to: "/unlock", search: { next: "/analises" } });
    if (identity.kind !== "user") throw redirect({ to: "/" });
    const status = await getAiStatus();
    if (!status.available) throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});
