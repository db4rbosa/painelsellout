import { createServerFn } from "@tanstack/react-start";

export const getAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { requireIdentity } = await import("./identity.server");
  await requireIdentity();
  const { getAiAvailability } = await import("./ai-status.server");
  return getAiAvailability();
});
