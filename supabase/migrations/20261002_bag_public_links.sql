-- Optional public presentation fields. Run in Supabase SQL Editor.
-- Existing bag values are not changed.
alter table public.bolsas add column if not exists certificado_url text;
alter table public.bolsas add column if not exists imagem_destaque_url text;
comment on column public.bolsas.certificado_url is 'Public certificate page or document URL';
comment on column public.bolsas.imagem_destaque_url is 'Optional dedicated image for editorial highlights';
