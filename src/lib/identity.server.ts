import { getRequestHeader, getRequestUrl, useSession } from "@tanstack/react-start/server";

export type GateSession = { unlocked?: boolean };

export type Identity =
  | {
      kind: "master" | "user";
      key: string;
      name: string;
      email: string;
      isAdmin: boolean;
      status: "approved";
    }
  | { kind: "none"; reason: "anonymous" | "pending" | "blocked" | "missing-profile" };

export function sessionConfig() {
  let https = false;
  try {
    https = getRequestUrl().protocol === "https:";
  } catch {
    https = false;
  }
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "site-gate",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      // O preview roda dentro de um iframe (contexto cross-site): o cookie
      // só é aceito com SameSite=None + Secure, e isso exige https.
      secure: https,
      sameSite: https ? ("none" as const) : ("lax" as const),
      path: "/",
    },
  };
}

function bearerToken(): string | null {
  const header = getRequestHeader("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

export async function resolveIdentity(): Promise<Identity> {
  const authorization = getRequestHeader("authorization");
  const token = bearerToken();
  // A presented credential must never fall back to a different cookie identity.
  if (authorization && !token) return { kind: "none", reason: "anonymous" };
  const session = await useSession<GateSession>(sessionConfig());
  if (!authorization && session.data.unlocked === true) {
    return {
      kind: "master",
      key: "master",
      name: "Master",
      email: process.env["SITE_USERNAME"] ?? "master",
      isAdmin: true,
      status: "approved",
    };
  }

  if (!token) return { kind: "none", reason: "anonymous" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { kind: "none", reason: "anonymous" };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name, email, status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) return { kind: "none", reason: "missing-profile" };
  if (profile.status === "pending") return { kind: "none", reason: "pending" };
  if (profile.status === "blocked") return { kind: "none", reason: "blocked" };

  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
    _user_id: data.user.id,
    _role: "admin",
  });

  return {
    kind: "user",
    key: data.user.id,
    name: profile.name || profile.email,
    email: profile.email,
    isAdmin: isAdmin === true,
    status: "approved",
  };
}

export async function requireIdentity(): Promise<
  Extract<Identity, { kind: "master" | "user" }>
> {
  const identity = await resolveIdentity();
  if (identity.kind === "none") throw new Error("Acesso não autorizado.");
  return identity;
}

export async function requireAdmin(): Promise<Extract<Identity, { kind: "master" | "user" }>> {
  const identity = await requireIdentity();
  if (!identity.isAdmin) throw new Error("Apenas administradores podem fazer isso.");
  return identity;
}
