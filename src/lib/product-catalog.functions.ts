import { createServerFn } from "@tanstack/react-start";

export type CatalogItem = { pn: string; description: string };

/** Shared product catalog (PN → English description), readable by any signed-in user. */
export const getProductCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { requireIdentity } = await import("./identity.server");
  await requireIdentity();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const items: CatalogItem[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabaseAdmin
      .from("product_catalog")
      .select("pn, description")
      .order("pn")
      .range(from, from + page - 1);
    if (error) throw new Error("Não foi possível carregar o catálogo de produtos.");
    items.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return { items };
});

export const saveProductCatalog = createServerFn({ method: "POST" })
  .inputValidator((data: { items: CatalogItem[] }) => {
    if (!Array.isArray(data?.items) || data.items.length > 5000) throw new Error("Lote inválido.");
    return {
      items: data.items
        .filter((i) => typeof i?.pn === "string" && typeof i?.description === "string")
        .map((i) => ({ pn: i.pn.trim().slice(0, 120), description: i.description.trim().slice(0, 500) }))
        .filter((i) => i.pn && i.description),
    };
  })
  .handler(async ({ data }) => {
    const { requireIdentity } = await import("./identity.server");
    await requireIdentity();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("product_catalog")
      .upsert(data.items.map((i) => ({ ...i, updated_at: now })), { onConflict: "pn" });
    if (error) throw new Error("Não foi possível salvar o catálogo de produtos.");
    return { saved: data.items.length };
  });
