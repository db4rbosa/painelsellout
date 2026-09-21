import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

export async function requireApprovedUser(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) throw new ToolError("É necessário entrar com uma conta aprovada.");

  const userId = ctx.getUserId();
  if (!userId) throw new ToolError("Não foi possível identificar o usuário.");

  const supabase = supabaseForUser(ctx);
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("name, email, status")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new ToolError("Não foi possível validar a conta.");
  if (!profile || profile.status !== "approved") {
    throw new ToolError("Esta conta ainda não está aprovada para acessar o painel.");
  }

  return { supabase, userId, profile };
}