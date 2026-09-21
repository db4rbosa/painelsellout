import { defineTool } from "@lovable.dev/mcp-js";
import { requireApprovedUser } from "../access";

export default defineTool({
  name: "get_profile",
  title: "Consultar perfil",
  description: "Consulta o nome, e-mail e situação da conta aprovada conectada ao painel.",
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const { profile } = await requireApprovedUser(ctx);
    const result = {
      name: profile.name,
      email: profile.email,
      status: profile.status,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});