import { createFileRoute, redirect } from "@tanstack/react-router";
import { AiChatWorkspace } from "@/components/AiChatWorkspace";
import { getAccessInfo } from "@/lib/account.functions";

export const Route = createFileRoute("/analises/$threadId")({
  ssr: false,
  loader: async () => {
    const identity = await getAccessInfo();
    if (identity.kind === "none") throw redirect({ to: "/unlock" });
    if (identity.kind !== "user") throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Conversa de análise | Sales Out Analytics" },
      { name: "description", content: "Histórico de análise de metas e resultados de Sales Out." },
      { property: "og:title", content: "Conversa de análise | Sales Out Analytics" },
      {
        property: "og:description",
        content: "Conversa privada baseada nos dados atuais do painel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  return <AiChatWorkspace activeThreadId={threadId} />;
}
