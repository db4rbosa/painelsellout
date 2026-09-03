import { createFileRoute } from "@tanstack/react-router";
import { SalesDashboard } from "@/components/SalesDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel de Sell-Out e Metas | Sales Out Analytics" },
      {
        name: "description",
        content:
          "Importe sua planilha de sales out, agrupe por qualquer dimensão, veja gráficos de evolução e acompanhe o atingimento das metas anual, trimestral e mensal.",
      },
      { property: "og:title", content: "Painel de Sell-Out e Metas" },
      {
        property: "og:description",
        content:
          "Análise de sell-out com agrupamentos, gráficos de evolução e atingimento de metas por mês, quarter, semestre e ano.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalesDashboard,
});
