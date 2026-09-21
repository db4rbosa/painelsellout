import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { requireApprovedUser } from "../access";

export default defineTool({
  name: "get_latest_workbook",
  title: "Consultar última planilha",
  description:
    "Consulta o nome, tamanho, responsável e data da última planilha compartilhada, sem expor o arquivo privado.",
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const { supabase } = await requireApprovedUser(ctx);
    const { data, error } = await supabase
      .from("workbooks")
      .select("file_name, file_size, uploaded_by, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new ToolError("Não foi possível consultar a última planilha.");
    const workbook = data
      ? {
          fileName: data.file_name,
          fileSize: Number(data.file_size),
          uploadedBy: data.uploaded_by,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }
      : null;
    return {
      content: [
        {
          type: "text",
          text: workbook ? JSON.stringify(workbook, null, 2) : "Nenhuma planilha foi importada.",
        },
      ],
      structuredContent: { workbook },
    };
  },
});