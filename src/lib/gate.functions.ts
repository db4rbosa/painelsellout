import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl, useSession } from "@tanstack/react-start/server";

import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean };

function sessionConfig() {
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

function matches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const login = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    const user = process.env["SITE_USERNAME"];
    const pass = process.env["SITE_PASSWORD"];
    if (!user || !pass) throw new Error("Credenciais de acesso não configuradas.");

    if (!matches(data.username.trim(), user) || !matches(data.password, pass)) {
      return { ok: false as const };
    }

    const session = await useSession<GateSession>(sessionConfig());
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<GateSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const requireAccess = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<GateSession>(sessionConfig());
  return { unlocked: session.data.unlocked === true };
});
