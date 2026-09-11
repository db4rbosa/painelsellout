import { createServerFn } from "@tanstack/react-start";
import { checkPassword } from "./password";

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "approved" | "blocked";
  isAdmin: boolean;
  createdAt: string;
};

export const getAccessInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveIdentity } = await import("./identity.server");
  return resolveIdentity();
});

export const signUpAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();

    if (name.length < 2) return { ok: false as const, error: "Informe seu nome completo." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return { ok: false as const, error: "Informe um e-mail válido." };

    const check = checkPassword(data.password);
    if (!check.ok)
      return { ok: false as const, error: `A senha precisa ter ${check.problems.join(", ")}.` };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (error || !created.user) {
      const message = error?.message ?? "";
      if (/already|exists|registered/i.test(message))
        return { ok: false as const, error: "Já existe uma conta com este e-mail." };
      return { ok: false as const, error: "Não foi possível criar a conta. Tente novamente." };
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({ id: created.user.id, name, email, status: "pending" });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return { ok: false as const, error: "Não foi possível criar a conta. Tente novamente." };
    }

    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "user" });

    return { ok: true as const };
  });

export const listAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./identity.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, name, email, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar os usuários.");

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .eq("role", "admin");
  const admins = new Set((roles ?? []).map((r) => r.user_id));

  return (profiles ?? []).map(
    (p): AccountRow => ({
      id: p.id,
      name: p.name,
      email: p.email,
      status: p.status,
      isAdmin: admins.has(p.id),
      createdAt: p.created_at,
    }),
  );
});

export const setAccountStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: "pending" | "approved" | "blocked" }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./identity.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível atualizar a situação do usuário.");
    return { ok: true as const };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./identity.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_preferences").delete().eq("user_key", data.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error("Não foi possível remover o usuário.");
    return { ok: true as const };
  });
