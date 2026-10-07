const STATUS_KEY = "__system_ai_gateway__";
const PROBE_INTERVAL_MS = 60 * 60 * 1000;

type StoredStatus = { paused?: boolean; checkedAt?: string; message?: string };
export type AiAvailability = { available: boolean; message?: string };

async function readStatus(): Promise<StoredStatus> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_preferences")
    .select("prefs")
    .eq("user_key", STATUS_KEY)
    .maybeSingle();
  return (data?.prefs ?? {}) as StoredStatus;
}

async function writeStatus(status: StoredStatus) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("user_preferences")
    .upsert({ user_key: STATUS_KEY, prefs: status as never }, { onConflict: "user_key" });
}

export async function markAiCreditsExhausted(message?: string) {
  await writeStatus({ paused: true, checkedAt: new Date().toISOString(), message });
}

export async function markAiAvailable() {
  const current = await readStatus();
  if (current.paused) await writeStatus({ paused: false, checkedAt: new Date().toISOString() });
}

/** Faz no máximo uma verificação por hora enquanto o recurso estiver bloqueado. */
async function probeGateway(): Promise<"ok" | "credits" | "unknown"> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return "unknown";
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: "ok" }],
        max_tokens: 1,
      }),
    });
    if (res.ok) return "ok";
    if (res.status === 402 || res.status === 403) return "credits";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function getAiAvailability(): Promise<AiAvailability> {
  const status = await readStatus();
  if (!status.paused) return { available: true };
  const last = status.checkedAt ? Date.parse(status.checkedAt) : 0;
  if (Date.now() - last < PROBE_INTERVAL_MS) {
    return { available: false, message: status.message };
  }
  const result = await probeGateway();
  if (result === "ok") {
    await writeStatus({ paused: false, checkedAt: new Date().toISOString() });
    return { available: true };
  }
  await writeStatus({ ...status, checkedAt: new Date().toISOString() });
  return { available: false, message: status.message };
}
