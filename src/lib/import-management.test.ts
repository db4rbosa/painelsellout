import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ active: false, authorized: true, remove: vi.fn(), deleteRow: vi.fn(), insert: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({
  inputValidator() { return this; },
  handler(fn: (args: { data: unknown }) => unknown) { return (args: { data: unknown }) => fn(args); },
}) }));
vi.mock("./identity.server", () => ({ requireIdentity: async () => {
  if (!mocks.authorized) throw new Error("Acesso não autorizado.");
  return { name: "Verified user", email: "verified", key: "user-a" };
} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: (table: string) => ({
    insert: mocks.insert,
    delete: () => ({ eq: mocks.deleteRow }),
    select: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: { storage_path: "archive.xlsx" }, error: null }),
      limit: async () => ({ data: table === "workbooks" && mocks.active ? [{ id: "active" }] : [], error: null }),
    }) }),
  }),
  storage: { from: () => ({ remove: mocks.remove }) },
} }));
import { deleteImport, registerProductImport } from "./dashboard-state.functions";

describe("import cleanup and product history", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.active = false; mocks.authorized = true;
    mocks.remove.mockResolvedValue({ error: null });
    mocks.deleteRow.mockResolvedValue({ error: null });
    mocks.insert.mockResolvedValue({ error: null });
  });
  it("preserves the active sales workbook", async () => {
    mocks.active = true;
    await expect(deleteImport({ data: { id: "old" } })).rejects.toThrow("ativa não pode ser excluída");
    expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.deleteRow).not.toHaveBeenCalled();
  });
  it("deletes only the selected archive and history entry", async () => {
    await deleteImport({ data: { id: "old" } });
    expect(mocks.remove).toHaveBeenCalledWith(["archive.xlsx"]);
    expect(mocks.deleteRow).toHaveBeenCalledWith("id", "old");
  });
  it("rejects unauthenticated cleanup before mutation", async () => {
    mocks.authorized = false;
    await expect(deleteImport({ data: { id: "old" } })).rejects.toThrow("não autorizado");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("keeps metadata available if file removal fails", async () => {
    mocks.remove.mockResolvedValue({ error: { message: "failed" } });
    await expect(deleteImport({ data: { id: "old" } })).rejects.toThrow("excluir o arquivo");
    expect(mocks.deleteRow).not.toHaveBeenCalled();
  });
  it("records product file type, count and verified uploader", async () => {
    await registerProductImport({ data: { path: "products.xlsx", fileName: "ProductsNEW.xlsx", fileSize: 123, validRows: 18116 } });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      import_kind: "products", valid_rows: 18116, uploaded_by: "Verified user", storage_path: "products.xlsx",
    }));
  });
});