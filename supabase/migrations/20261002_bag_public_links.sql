-- Optional public presentation fields. Run in Supabase SQL Editor.
-- Existing bag values are not changed.
alter table public.bolsas add column if not exists certificado_url text;
comment on column public.bolsas.certificado_url is 'Public certificate page or document URL';
