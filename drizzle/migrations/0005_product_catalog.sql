CREATE TABLE public.product_catalog (
  pn text PRIMARY KEY,
  description text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.product_catalog TO service_role;
ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;