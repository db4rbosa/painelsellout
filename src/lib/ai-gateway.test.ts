import { expect, it } from "vitest";
import { withLovableAiGatewayRunIdHeader } from "./ai-gateway.server";

it("returns a direct provider stream without waiting for a gateway run ID", async () => {
  const response = new Response("data: first delta\n\n", { headers: { "Content-Type": "text/event-stream" } });
  const result = await withLovableAiGatewayRunIdHeader(response, undefined);
  expect(result).toBe(response);
  expect(await result.text()).toBe("data: first delta\n\n");
});

it("preserves gateway run IDs and the complete stream", async () => {
  const result = await withLovableAiGatewayRunIdHeader(new Response("answer"), {
    getRunId: () => "gateway-issued-test-id",
    waitForRunId: async () => "gateway-issued-test-id",
  });
  expect(result.headers.get("X-Lovable-AIG-Run-ID")).toBe("gateway-issued-test-id");
  expect(await result.text()).toBe("answer");
});