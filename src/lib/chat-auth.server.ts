import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function userClient(token: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("O acesso aos dados não está configurado.");
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireApprovedChatUser(request: Request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  const token = match?.[1];
  if (!token) throw new Response("Entre com uma conta aprovada.", { status: 401 });
  const supabase = userClient(token);
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) throw new Response("Sua sessão expirou.", { status: 401 });
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("name, email, status")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error || !profile || profile.status !== "approved") {
    throw new Response("Esta conta ainda não está aprovada.", { status: 403 });
  }
  return { supabase, userId: auth.user.id, profile };
}