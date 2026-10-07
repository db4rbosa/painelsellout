import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";
import { requireApprovedChatUser } from "@/lib/chat-auth.server";
import { buildUserSalesContext } from "@/lib/chat-context.server";
import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { streamText, type ModelMessage, type UIMessage } from "ai";
import { z } from "zod";

const RequestBody = z.object({
  id: z.string().uuid(),
  messages: z.array(z.custom<UIMessage>()),
});

const textOf = (message: UIMessage) =>
  message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();

const safeStreamError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(message) as { message?: unknown };
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
  } catch {
    // The SDK can also expose an already-safe plain message.
  }
  if (/credit|402/i.test(message)) return "Créditos de IA insuficientes. Adicione créditos nas configurações do workspace.";
  if (/rate|429/i.test(message)) return "Muitas análises foram solicitadas. Aguarde um momento e tente novamente.";
  return message || "Não foi possível concluir esta análise.";
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const identity = await requireApprovedChatUser(request);
          const { getAiAvailability } = await import("@/lib/ai-status.server");
          if (!(await getAiAvailability()).available) {
            return new Response("Análises com IA indisponíveis: créditos de IA esgotados.", { status: 402 });
          }
          const parsed = RequestBody.safeParse(await request.json());
          if (!parsed.success) return new Response("Solicitação inválida.", { status: 400 });

          const { data: thread, error: threadError } = await identity.supabase
            .from("ai_threads")
            .select("id, title")
            .eq("id", parsed.data.id)
            .eq("user_id", identity.userId)
            .maybeSingle();
          if (threadError || !thread) return new Response("Conversa não encontrada.", { status: 404 });

          const latest = [...parsed.data.messages].reverse().find((message) => message.role === "user");
          const question = latest ? textOf(latest) : "";
          if (!question) return new Response("Escreva uma pergunta.", { status: 400 });

          const { data: priorRows, error: historyError } = await identity.supabase
            .from("ai_messages")
            .select("role, content, created_at")
            .eq("thread_id", thread.id)
            .order("created_at", { ascending: true });
          if (historyError) return new Response("Não foi possível carregar o histórico.", { status: 500 });

          const { error: userMessageError } = await identity.supabase.from("ai_messages").insert({
            thread_id: thread.id,
            user_id: identity.userId,
            role: "user",
            content: question,
          });
          if (userMessageError) return new Response("Não foi possível salvar sua pergunta.", { status: 500 });

          const salesContext = await buildUserSalesContext(identity.userId, question);
          const history: ModelMessage[] = (priorRows ?? []).slice(-30).flatMap((row): ModelMessage[] =>
            row.role === "user" || row.role === "assistant"
              ? [{ role: row.role, content: row.content }]
              : [],
          );
          history.push({ role: "user", content: question });

          const key = process.env["LOVABLE_API_KEY"];
          if (!key) return new Response("A análise por IA não está configurada.", { status: 500 });
          const initialRunId = getLovableAiGatewayRunId(request);
          const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
          const lovable = createOpenAI({
            baseURL: "https://ai.gateway.lovable.dev/v1",
            apiKey: key,
            headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
            fetch: runIdFetch.fetch,
          });

          const result = streamText({
            model: lovable.responses("openai/gpt-6-astra"),
            system: [
              "Você é um analista de Sales Out. Responda em português do Brasil, com objetividade e números claros.",
              "Use somente o CONTEXTO DE DADOS fornecido. Não invente valores e diga quando algo não estiver disponível.",
              "Vendas incluem Mobility, Printer, Scanner e Software. Serviços são sempre uma categoria separada.",
              "Respeite rigorosamente os accounts, filtros e quarters do contexto atual do usuário.",
              "Para perguntas sobre equipamentos ou SKUs de um cliente, use exclusivamente detalhamentoSkusPorCliente.",
              "Se o detalhamento estiver ambíguo, peça ao usuário que escolha exatamente um dos clientes listados; não some candidatos.",
              "Se estiver completo, apresente Cliente Final, Account e Quarters; depois liste todos os itens, sem limite, separando Vendas e Serviços em tabelas e finalize com subtotais e total geral.",
              "Mantenha valores negativos, exiba receita em USD com duas casas decimais e não omita SKU não informado.",
              "Para outras análises, apresente valores em USD e percentuais quando forem úteis e limite a resposta a cerca de 700 palavras.",
              `CONTEXTO DE DADOS:\n${JSON.stringify(salesContext)}`,
            ].join("\n\n"),
            messages: history,
            abortSignal: request.signal,
            providerOptions: {
              openai: {
                forceReasoning: true,
                reasoningEffort: "medium",
                reasoningSummary: "auto",
                store: false,
                include: ["reasoning.encrypted_content"],
              },
            },
          });

          const response = result.toUIMessageStreamResponse({
            originalMessages: parsed.data.messages,
            sendReasoning: true,
            onError: (error) => {
              const text = error instanceof Error ? error.message : String(error);
              if (/402|credit|payment required/i.test(text)) {
                void import("@/lib/ai-status.server").then((m) => m.markAiCreditsExhausted());
              }
              return safeStreamError(error);
            },
            onFinish: async ({ responseMessage, isAborted }) => {
              if (isAborted) return;
              const answer = textOf(responseMessage);
              if (!answer) return;
              const { error: assistantError } = await identity.supabase.from("ai_messages").insert({
                thread_id: thread.id,
                user_id: identity.userId,
                role: "assistant",
                content: answer,
              });
              if (assistantError) throw new Error("Não foi possível salvar a resposta.");
              const title = thread.title === "Nova análise" ? question.slice(0, 72) : thread.title;
              const { error: updateError } = await identity.supabase
                .from("ai_threads")
                .update({ title, updated_at: new Date().toISOString() })
                .eq("id", thread.id);
              if (updateError) throw new Error("Não foi possível atualizar a conversa.");
            },
            headers: getLovableAiGatewayResponseHeaders(undefined, {
              ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
            }),
          });
          return withLovableAiGatewayRunIdHeader(response, runIdFetch);
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof DOMException && error.name === "AbortError") {
            return new Response("Análise interrompida.", { status: 499 });
          }
          console.error(error);
          return new Response("Não foi possível iniciar a análise.", { status: 500 });
        }
      },
    },
  },
});