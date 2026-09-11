import { createServerFn } from "@tanstack/react-start";

const BUCKET = "sales-workbooks";

export type WorkbookInfo = {
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
  url: string;
};

export const getDashboardState = createServerFn({ method: "GET" }).handler(async () => {
  const { requireIdentity } = await import("./identity.server");
  const identity = await requireIdentity();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: prefsRow } = await supabaseAdmin
    .from("user_preferences")
    .select("prefs")
    .eq("user_key", identity.key)
    .maybeSingle();

  const { data: workbookRow } = await supabaseAdmin
    .from("workbooks")
    .select("file_name, file_size, storage_path, uploaded_by, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let workbook: WorkbookInfo | null = null;
  if (workbookRow) {
    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(workbookRow.storage_path, 60 * 30);
    if (signed?.signedUrl) {
      workbook = {
        fileName: workbookRow.file_name,
        fileSize: Number(workbookRow.file_size ?? 0),
        uploadedBy: workbookRow.uploaded_by,
        createdAt: workbookRow.created_at,
        url: signed.signedUrl,
      };
    }
  }

  return { prefs: prefsRow?.prefs ?? null, workbook };
});

export const saveDashboardPrefs = createServerFn({ method: "POST" })
  .inputValidator((data: { prefs: unknown }) => data)
  .handler(async ({ data }) => {
    const { requireIdentity } = await import("./identity.server");
    const identity = await requireIdentity();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_preferences")
      .upsert(
        { user_key: identity.key, prefs: data.prefs as never },
        { onConflict: "user_key" },
      );
    if (error) throw new Error("Não foi possível salvar suas configurações.");
    return { ok: true as const };
  });

export const createWorkbookUpload = createServerFn({ method: "POST" })
  .inputValidator((data: { fileName: string }) => data)
  .handler(async ({ data }) => {
    const { requireIdentity } = await import("./identity.server");
    await requireIdentity();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const safeName = data.fileName.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Não foi possível preparar o envio do arquivo.");

    return { path: signed.path, token: signed.token, bucket: BUCKET };
  });

export const registerWorkbook = createServerFn({ method: "POST" })
  .inputValidator((data: { path: string; fileName: string; fileSize: number }) => data)
  .handler(async ({ data }) => {
    const { requireIdentity } = await import("./identity.server");
    const identity = await requireIdentity();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: previous } = await supabaseAdmin
      .from("workbooks")
      .select("id, storage_path");

    const { error } = await supabaseAdmin.from("workbooks").insert({
      file_name: data.fileName,
      file_size: data.fileSize,
      storage_path: data.path,
      uploaded_by: identity.name || identity.email,
    });
    if (error) throw new Error("Não foi possível registrar a planilha.");

    const stale = (previous ?? []).filter((p) => p.storage_path !== data.path);
    if (stale.length) {
      await supabaseAdmin.storage.from(BUCKET).remove(stale.map((p) => p.storage_path));
      await supabaseAdmin
        .from("workbooks")
        .delete()
        .in(
          "id",
          stale.map((p) => p.id),
        );
    }

    return { ok: true as const };
  });
