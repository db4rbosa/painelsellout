CREATE TABLE public.workbook_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  uploaded_by text NOT NULL DEFAULT '',
  valid_rows integer NOT NULL DEFAULT 0,
  excluded_rows integer NOT NULL DEFAULT 0,
  issue_count integer NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workbook_imports TO authenticated;
GRANT ALL ON public.workbook_imports TO service_role;
ALTER TABLE public.workbook_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users can view import history" ON public.workbook_imports
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));
CREATE INDEX workbook_imports_created_at_idx ON public.workbook_imports (created_at DESC);