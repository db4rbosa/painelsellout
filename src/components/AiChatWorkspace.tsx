import { useChat } from "@ai-sdk/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowLeft, Menu, MessageSquareText, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { SalesAnalystMark } from "@/components/SalesAnalystMark";
import { Button } from "@/components/ui/button";
import {
  createAiThread,
  deleteAiThread,
  getAiThread,
  listAiThreads,
  renameAiThread,
  type AiStoredMessage,
  type AiThread,
} from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";

const toUiMessage = (message: AiStoredMessage): UIMessage => ({
  id: message.id,
  role: message.role,
  parts: [{ type: "text", text: message.content }],
});

function ThreadChat({ threadId, initialMessages, onFinished }: { threadId: string; initialMessages: UIMessage[]; onFinished: () => void }) {
  const [input, setInput] = useState("");
  const [errorText, setErrorText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({
      api: "/api/chat",
      headers: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
      },
    }),
    [],
  );
  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (error) => setErrorText(error.message),
    onFinish: () => {
      onFinished();
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    },
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => { textareaRef.current?.focus(); }, [threadId]);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-background">
      <Conversation className="min-h-0">
        <ConversationContent className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8">
          {!messages.length ? (
            <ConversationEmptyState
              icon={<SalesAnalystMark className="size-12" />}
              title="Comece uma análise"
              description="Pergunte sobre metas, atingimento, Serviços, accounts, quarters ou tendências da planilha atual."
            />
          ) : null}
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.parts.map((part, index) => {
                  if (part.type === "text") return <MessageResponse key={`${message.id}-text-${index}`}>{part.text}</MessageResponse>;
                  if (part.type === "reasoning") return (
                    <Reasoning defaultOpen={false} isStreaming={busy && message === messages.at(-1)} key={`${message.id}-reasoning-${index}`}>
                      <ReasoningTrigger getThinkingMessage={(streaming) => streaming ? <Shimmer>Analisando...</Shimmer> : "Análise concluída"} />
                      <ReasoningContent>{part.text}</ReasoningContent>
                    </Reasoning>
                  );
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" ? <div className="flex items-center gap-3 text-sm text-muted-foreground"><SalesAnalystMark className="size-8" /><Shimmer>Analisando...</Shimmer></div> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t bg-background px-4 py-4 md:px-8">
        <div className="mx-auto max-w-4xl">
          {errorText ? <p className="mb-2 text-sm text-destructive">{errorText}</p> : null}
          <PromptInput
            onSubmit={async ({ text }) => {
              const question = text.trim();
              if (!question || busy) return;
              setInput("");
              setErrorText("");
              await sendMessage({ text: question });
            }}
          >
            <PromptInputTextarea ref={textareaRef} value={input} onChange={(event) => setInput(event.currentTarget.value)} placeholder="Pergunte sobre suas metas e resultados..." />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} onStop={stop} disabled={!input.trim() && !busy} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </section>
  );
}

export function AiChatWorkspace({ activeThreadId }: { activeThreadId?: string }) {
  const navigate = useNavigate();
  const fetchThreads = useServerFn(listAiThreads);
  const makeThread = useServerFn(createAiThread);
  const fetchThread = useServerFn(getAiThread);
  const changeTitle = useServerFn(renameAiThread);
  const removeThread = useServerFn(deleteAiThread);
  const [threads, setThreads] = useState<AiThread[]>([]);
  const [active, setActive] = useState<{ thread: AiThread; messages: UIMessage[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const refreshThreads = useCallback(async () => setThreads(await fetchThreads()), [fetchThreads]);
  useEffect(() => {
    void refreshThreads().catch(() => setError("Não foi possível carregar as conversas."));
  }, [refreshThreads]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    if (!activeThreadId) {
      setActive(null);
      setLoading(false);
      return undefined;
    }
    void fetchThread({ data: { id: activeThreadId } })
      .then((data) => { if (!cancelled) setActive({ thread: data.thread, messages: data.messages.map(toUiMessage) }); })
      .catch(() => { if (!cancelled) setError("Conversa não encontrada."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeThreadId, fetchThread]);

  const create = async () => {
    const thread = await makeThread();
    await refreshThreads();
    await navigate({ to: "/analises/$threadId", params: { threadId: thread.id } });
    setSidebarOpen(false);
  };

  return (
    <main className="flex h-dvh overflow-hidden bg-background">
      {sidebarOpen ? <div className="fixed inset-0 z-30 bg-foreground/20 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" /> : null}
      <aside className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r bg-card transition-transform md:static md:translate-x-0`}>
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3"><SalesAnalystMark /><div><p className="font-semibold">Análises com IA</p><p className="text-xs text-muted-foreground">Sales Out</p></div></div>
          <Button size="icon-sm" variant="ghost" className="md:hidden" onClick={() => setSidebarOpen(false)}><X className="size-4" /><span className="sr-only">Fechar</span></Button>
        </div>
        <div className="p-3"><Button className="w-full" onClick={create}><Plus className="size-4" /> Nova análise</Button></div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3" aria-label="Conversas">
          {threads.map((thread) => (
            <div className={`group flex items-center rounded-md ${activeThreadId === thread.id ? "bg-secondary" : "hover:bg-muted"}`} key={thread.id}>
              <Link className="min-w-0 flex-1 truncate px-3 py-2.5 text-sm" to="/analises/$threadId" params={{ threadId: thread.id }} onClick={() => setSidebarOpen(false)}>{thread.title}</Link>
              <Button size="icon-sm" variant="ghost" title="Renomear" onClick={async () => { const title = window.prompt("Novo nome", thread.title)?.trim(); if (title) { await changeTitle({ data: { id: thread.id, title } }); await refreshThreads(); } }}><Pencil className="size-3.5" /><span className="sr-only">Renomear</span></Button>
              <Button size="icon-sm" variant="ghost" title="Excluir" onClick={async () => { if (!window.confirm("Excluir esta conversa?")) return; await removeThread({ data: { id: thread.id } }); await refreshThreads(); if (activeThreadId === thread.id) await navigate({ to: "/analises" }); }}><Trash2 className="size-3.5" /><span className="sr-only">Excluir</span></Button>
            </div>
          ))}
        </nav>
        <div className="border-t p-3"><Button variant="outline" className="w-full" asChild><Link to="/"><ArrowLeft className="size-4" /> Voltar ao painel</Link></Button></div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b px-4 md:px-6">
          <Button size="icon-sm" variant="outline" className="md:hidden" onClick={() => setSidebarOpen(true)}><Menu className="size-4" /><span className="sr-only">Abrir conversas</span></Button>
          <div className="min-w-0"><h1 className="truncate font-semibold">{active?.thread.title ?? "Análises com IA"}</h1><p className="text-xs text-muted-foreground">Dados e configurações atuais do painel</p></div>
        </header>
        {error ? <div className="m-5 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div> : null}
        {loading ? <div className="flex flex-1 items-center justify-center"><Shimmer>Carregando análise...</Shimmer></div> : active ? (
          <ThreadChat key={active.thread.id} threadId={active.thread.id} initialMessages={active.messages} onFinished={() => void refreshThreads()} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"><SalesAnalystMark className="size-14" /><div><h2 className="text-xl font-semibold">Escolha ou crie uma análise</h2><p className="mt-1 text-sm text-muted-foreground">Cada conversa mantém seu próprio histórico.</p></div><Button onClick={create}><MessageSquareText className="size-4" /> Criar primeira análise</Button></div>
        )}
      </div>
    </main>
  );
}