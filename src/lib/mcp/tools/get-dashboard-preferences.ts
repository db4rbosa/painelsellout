import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { normalizePrefs } from "@/lib/prefs";
import { requireApprovedUser } from "../access";

export default defineTool({
  name: "get_dashboard_preferences",
  title: "Consultar configurações e metas",
  description:
    "Consulta os accounts, filtros, quarters, agrupamento, visualização e metas salvos pelo usuário conectado.",
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const { supabase, userId } = await requireApprovedUser(ctx);
    const { data, error } = await supabase
      .from("user_preferences")
      .select("prefs, updated_at")
      .eq("user_key", userId)
      .maybeSingle();

    if (error) throw new ToolError("Não foi possível consultar as configurações do painel.");
    const prefs = normalizePrefs(data?.prefs ?? null);
    const result = {
      accounts: prefs.accounts,
      filters: Object.fromEntries(
        Object.entries(prefs.filters).map(([key, values]) => [key, [...values]]),
      ),
      groupBy: prefs.groupBy,
      granularity: prefs.granularity,
      metric: prefs.metric,
      chartType: prefs.chartType,
      stacked: prefs.stacked,
      topN: prefs.topN,
      selectedQuarters: [...prefs.selectedQuarters],
      accountsByQuarter: Object.fromEntries(
        Object.entries(prefs.accountsByQuarter).map(([quarter, accounts]) => [
          quarter,
          [...accounts],
        ]),
      ),
      targetsByGroup: Object.fromEntries(
        Object.entries(prefs.targetsByGroup).map(([group, targets]) => [
          group,
          {
            annual: targets.annual,
            quarters: [...targets.quarters],
            servicesQuarters: [...targets.servicesQuarters],
          },
        ]),
      ),
      updatedAt: data?.updated_at ?? null,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});