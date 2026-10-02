DROP POLICY IF EXISTS "Authenticated users can view workbooks" ON public.workbooks;

CREATE POLICY "Approved users can view workbooks"
ON public.workbooks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.status = 'approved'::public.account_status
  )
);