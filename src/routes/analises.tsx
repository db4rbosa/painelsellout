import { createFileRoute, redirect } from "@tanstack/react-router";
import { AiChatWorkspace } from "@/components/AiChatWorkspace";
import { getAccessInfo } from "@/lib/account.functions";

export const Route = createFileRoute("/analises")({
  ssr: false,
  loader: async () => {
    const identity = await getAccessInfo();
    if (identity.kind === "none") throw redirect({ to: "/unlock", search: { next: "/analises" } });
    if (identity.kind !== "user") throw redirect({ to: "/" });
  },
  head: () => ({ meta: [
    { title: "Análises com IA | Sales Out Analytics" },
    { name: "description", content: "Converse sobre metas, atingimento e dados da planilha de Sales Out." },
    { property: "og:title", content: "Análises com IA | Sales Out Analytics" },
    { property: "og:description", content: "Análises personalizadas de metas e Sales Out." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => <AiChatWorkspace />,
});