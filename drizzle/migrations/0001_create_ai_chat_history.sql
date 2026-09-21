CREATE TABLE public.ai_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova análise',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_threads TO authenticated;
GRANT ALL ON public.ai_threads TO service_role;
ALTER TABLE public.ai_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own AI threads" ON public.ai_threads
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX ai_threads_user_updated_idx ON public.ai_threads (user_id, updated_at DESC);
CREATE TRIGGER update_ai_threads_updated_at BEFORE UPDATE ON public.ai_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.ai_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own AI messages" ON public.ai_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.ai_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()
  ));
CREATE POLICY "Users insert own AI messages" ON public.ai_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.ai_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()
  ));
CREATE POLICY "Users delete own AI messages" ON public.ai_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.ai_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()
  ));
CREATE INDEX ai_messages_thread_created_idx ON public.ai_messages (thread_id, created_at);