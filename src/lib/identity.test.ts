import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  header: undefined as string | undefined,
  master: true,
  getUser: vi.fn(),
  profile: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: () => mocks.header,
  getRequestUrl: () => new URL("http://localhost:8080"),
  useSession: async () => ({ data: { unlocked: mocks.master } }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { getUser: mocks.getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }),
    rpc: mocks.rpc,
  },
}));
import { requireIdentity, resolveIdentity } from "./identity.server";

describe("personal settings identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.header = undefined;
    mocks.master = true;
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
    mocks.profile.mockResolvedValue({
      data: { name: "A", email: "a@example.test", status: "approved" },
    });
    mocks.rpc.mockResolvedValue({ data: false });
  });
  it("uses the validated user's subject instead of a simultaneous master cookie", async () => {
    mocks.header = "Bearer test-token";
    expect(await resolveIdentity()).toMatchObject({ kind: "user", key: "user-a" });
    expect(mocks.getUser).toHaveBeenCalledWith("test-token");
  });
  it("rejects an invalid bearer instead of accessing master settings", async () => {
    mocks.header = "Bearer invalid";
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
    await expect(requireIdentity()).rejects.toThrow("Acesso não autorizado.");
  });
  it("rejects malformed authorization instead of accessing master settings", async () => {
    mocks.header = "Basic invalid";
    await expect(requireIdentity()).rejects.toThrow("Acesso não autorizado.");
  });
  it("allows legacy master settings only without bearer credentials", async () => {
    expect(await resolveIdentity()).toMatchObject({ kind: "master", key: "master" });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("does not allow unauthenticated callers to access any settings", async () => {
    mocks.master = false;
    await expect(requireIdentity()).rejects.toThrow("Acesso não autorizado.");
  });
});
