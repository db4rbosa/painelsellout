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
  const { setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "private, no-store");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: prefsRow, error: prefsError } = await supabaseAdmin
    .from("user_preferences")
    .select("prefs")
    .eq("user_key", identity.key)
    .maybeSingle();
  if (prefsError) throw new Error("Não foi possível carregar suas configurações.");

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
    const { normalizePrefs } = await import("./prefs");
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("Cache-Control", "private, no-store");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_preferences")
      .upsert(
        { user_key: identity.key, prefs: normalizePrefs(data.prefs) as never },
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

export type ImportStats = {
  validRows: number;
  excludedRows: number;
  issueCount: number;
  totalRevenue: number;
};

export type ImportHistoryEntry = ImportStats & {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
  downloadable: boolean;
  kind: "sellout" | "products";
  active: boolean;
};

const safeInt = (v: unknown) =>
  Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : 0;

export const listImportHistory = createServerFn({ method: "GET" }).handler(async () => {
  const { requireIdentity } = await import("./identity.server");
  await requireIdentity();
  const { setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "private, no-store");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("workbook_imports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Não foi possível carregar o histórico de importações.");
  const { data: active, error: activeError } = await supabaseAdmin.from("workbooks").select("storage_path");
  if (activeError) throw new Error("Não foi possível identificar a planilha ativa.");
  const activePaths = new Set((active ?? []).map((row) => row.storage_path));
  return (data ?? []).map((r): ImportHistoryEntry => ({
    id: r.id,
    fileName: r.file_name,
    fileSize: Number(r.file_size ?? 0),
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
    validRows: r.valid_rows,
    excludedRows: r.excluded_rows,
    issueCount: r.issue_count,
    totalRevenue: Number(r.total_revenue ?? 0),
    downloadable: Boolean(r.storage_path),
    kind: r.import_kind === "products" ? "products" : "sellout",
    active: Boolean(r.storage_path && activePaths.has(r.storage_path)),
  }));
});

export const registerWorkbook = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { path: string; fileName: string; fileSize: number; stats?: ImportStats }) => data,
  )
  .handler(async ({ data }) => {
    const { requireIdentity } = await import("./identity.server");
    const identity = await requireIdentity();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: previous } = await supabaseAdmin.from("workbooks").select("id, storage_path");

    const uploadedBy = identity.name || identity.email;
    const { error } = await supabaseAdmin.from("workbooks").insert({
      file_name: data.fileName,
      file_size: data.fileSize,
      storage_path: data.path,
      uploaded_by: uploadedBy,
    });
    if (error) throw new Error("Não foi possível registrar a planilha.");

    const revenue = Number(data.stats?.totalRevenue);
    await supabaseAdmin.from("workbook_imports").insert({
      file_name: data.fileName.slice(0, 255),
      file_size: safeInt(data.fileSize),
      uploaded_by: uploadedBy,
      valid_rows: safeInt(data.stats?.validRows),
      excluded_rows: safeInt(data.stats?.excludedRows),
      issue_count: safeInt(data.stats?.issueCount),
      total_revenue: Number.isFinite(revenue) ? revenue : 0,
      storage_path: data.path,
    });

    // Keep stored files so every import in the history stays downloadable.
    const stale = (previous ?? []).filter((p) => p.storage_path !== data.path);
    if (stale.length) {
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

export const getImportDownloadUrl = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data?.id ?? "") }))
  .handler(async ({ data }) => {
    const { requireIdentity } = await import("./identity.server");
    await requireIdentity();
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("Cache-Control", "private, no-store");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("workbook_imports")
      .select("file_name, storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!row?.storage_path) throw new Error("Arquivo não disponível para download.");
    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, 120, { download: row.file_name });
    if (!signed?.signedUrl) throw new Error("Arquivo não disponível para download.");
    return { url: signed.signedUrl };
  });

export const registerProductImport = createServerFn({ method: "POST" })
  .inputValidator((data: { path: string; fileName: string; fileSize: number; validRows: number }) => data)
  .handler(async ({ data }) => {
    const { requireIdentity } = await import("./identity.server");
    const identity = await requireIdentity();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("workbook_imports").insert({
      import_kind: "products",
      file_name: data.fileName.slice(0, 255),
      file_size: safeInt(data.fileSize),
      valid_rows: safeInt(data.validRows),
      storage_path: data.path,
      uploaded_by: identity.name || identity.email,
    });
    if (error) throw new Error("Não foi possível registrar a importação dos produtos.");
    return { ok: true as const };
  });

export const deleteImport = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data?.id ?? "") }))
  .handler(async ({ data }) => {
    const { requireIdentity } = await import("./identity.server");
    await requireIdentity();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("workbook_imports")
      .select("storage_path").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("Importação não encontrada.");
    if (row.storage_path) {
      const { data: active, error: activeError } = await supabaseAdmin.from("workbooks")
        .select("id").eq("storage_path", row.storage_path).limit(1);
      if (activeError) throw new Error("Não foi possível verificar a planilha ativa.");
      if (active?.length) throw new Error("A planilha de vendas ativa não pode ser excluída. Importe outra antes.");
      const { error: storageError } = await supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]);
      if (storageError) throw new Error("Não foi possível excluir o arquivo.");
    }
    const { error: deleteError } = await supabaseAdmin.from("workbook_imports").delete().eq("id", data.id);
    if (deleteError) throw new Error("Não foi possível excluir o registro do histórico.");
    return { ok: true as const };
  });
