import { createServerFn } from "@tanstack/react-start";

export const login = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { createHash, timingSafeEqual } = await import("node:crypto");
    const { sessionConfig } = await import("./identity.server");
    const { useSession } = await import("@tanstack/react-start/server");

    const matches = (input: string, expected: string) =>
      timingSafeEqual(
        createHash("sha256").update(input, "utf8").digest(),
        createHash("sha256").update(expected, "utf8").digest(),
      );

    const user = process.env["SITE_USERNAME"];
    const pass = process.env["SITE_PASSWORD"];
    if (!user || !pass) throw new Error("Credenciais de acesso não configuradas.");

    if (!matches(data.username.trim(), user) || !matches(data.password, pass)) {
      return { ok: false as const };
    }

    const session = await useSession<{ unlocked?: boolean }>(sessionConfig());
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { sessionConfig } = await import("./identity.server");
  const { useSession } = await import("@tanstack/react-start/server");
  const session = await useSession<{ unlocked?: boolean }>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const requireAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveIdentity } = await import("./identity.server");
  return resolveIdentity();
});
