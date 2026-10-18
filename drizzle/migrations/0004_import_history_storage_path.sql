ALTER TABLE public.workbook_imports ADD COLUMN IF NOT EXISTS storage_path text;
UPDATE public.workbook_imports i SET storage_path = w.storage_path
FROM public.workbooks w WHERE i.storage_path IS NULL AND i.file_name = w.file_name;