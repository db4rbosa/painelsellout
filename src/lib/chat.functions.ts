import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idInput = z.object({ id: z.string().uuid() });

export type AiThread = { id: string; title: string; createdAt: string; updatedAt: string };
export type AiStoredMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string };

export const listAiThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiThread[]> => {
    const { data: profile } = await context.supabase.from("profiles").select("status").eq("id", context.userId).maybeSingle();
    if (profile?.status !== "approved") throw new Error("Esta conta ainda não está aprovada.");
    const { data, error } = await context.supabase
      .from("ai_threads")
      .select("id, title, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Não foi possível carregar as conversas.");
    return (data ?? []).map((row) => ({ id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at }));
  });

export const createAiThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiThread> => {
    const { data: profile } = await context.supabase.from("profiles").select("status").eq("id", context.userId).maybeSingle();
    if (profile?.status !== "approved") throw new Error("Esta conta ainda não está aprovada.");
    const { data, error } = await context.supabase
      .from("ai_threads")
      .insert({ user_id: context.userId, title: "Nova análise" })
      .select("id, title, created_at, updated_at")
      .single();
    if (error || !data) throw new Error("Não foi possível criar a conversa.");
    return { id: data.id, title: data.title, createdAt: data.created_at, updatedAt: data.updated_at };
  });

export const getAiThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase.from("profiles").select("status").eq("id", context.userId).maybeSingle();
    if (profile?.status !== "approved") throw new Error("Esta conta ainda não está aprovada.");
    const [{ data: thread, error: threadError }, { data: messages, error: messageError }] = await Promise.all([
      context.supabase.from("ai_threads").select("id, title, created_at, updated_at").eq("id", data.id).maybeSingle(),
      context.supabase.from("ai_messages").select("id, role, content, created_at").eq("thread_id", data.id).order("created_at"),
    ]);
    if (threadError || messageError || !thread) throw new Error("Conversa não encontrada.");
    return {
      thread: { id: thread.id, title: thread.title, createdAt: thread.created_at, updatedAt: thread.updated_at } satisfies AiThread,
      messages: (messages ?? []).flatMap((message): AiStoredMessage[] =>
        message.role === "user" || message.role === "assistant"
          ? [{ id: message.id, role: message.role, content: message.content, createdAt: message.created_at }]
          : [],
      ),
    };
  });

export const renameAiThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(80) }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ai_threads").update({ title: data.title }).eq("id", data.id);
    if (error) throw new Error("Não foi possível renomear a conversa.");
    return { ok: true as const };
  });

export const deleteAiThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ai_threads").delete().eq("id", data.id);
    if (error) throw new Error("Não foi possível excluir a conversa.");
    return { ok: true as const };
  });