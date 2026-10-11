import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ key: "user-a", upsert: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator() {
      return this;
    },
    handler(fn: (args: { data: unknown }) => unknown) {
      return (args: { data: unknown }) => fn(args);
    },
  }),
}));
vi.mock("./identity.server", () => ({
  requireIdentity: async () => ({ kind: "user", key: mocks.key }),
}));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => ({ upsert: mocks.upsert }) },
}));
import { saveDashboardPrefs } from "./dashboard-state.functions";

describe("preference ownership", () => {
  beforeEach(() => {
    mocks.upsert.mockReset();
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.key = "user-a";
  });
  it("ignores an alternative owner supplied by the caller", async () => {
    const input = { prefs: { accounts: ["Account A"], user_key: "user-b" }, user_key: "user-b" };
    await saveDashboardPrefs({ data: input });
    expect(mocks.upsert.mock.calls[0]?.[0]).toMatchObject({
      user_key: "user-a",
      prefs: { accounts: ["Account A"] },
    });
    expect(mocks.upsert.mock.calls[0]?.[0].prefs).not.toHaveProperty("user_key");
  });
  it("writes different users' settings under their separate verified identities", async () => {
    await saveDashboardPrefs({ data: { prefs: { accounts: ["Account A"] } } });
    mocks.key = "user-b";
    await saveDashboardPrefs({ data: { prefs: { accounts: ["Account B"] } } });
    expect(mocks.upsert.mock.calls.map(([row]) => row.user_key)).toEqual(["user-a", "user-b"]);
  });
});
