-- Despesas da loja (aba "Despesas" do admin). Só administradores leem e escrevem.
create table if not exists public.despesas (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 200),
  categoria text not null check (char_length(btrim(categoria)) between 1 and 60),
  valor numeric(12,2) not null check (valor >= 0),
  forma_pagamento text check (forma_pagamento is null or char_length(forma_pagamento) <= 40),
  bolsa_id uuid references public.bolsas(id) on delete set null,
  observacao text check (observacao is null or char_length(observacao) <= 500),
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists despesas_data_idx on public.despesas (data desc);
create index if not exists despesas_bolsa_idx on public.despesas (bolsa_id);

alter table public.despesas enable row level security;

drop policy if exists tbr_despesas_admin_select on public.despesas;
drop policy if exists tbr_despesas_admin_insert on public.despesas;
drop policy if exists tbr_despesas_admin_update on public.despesas;
drop policy if exists tbr_despesas_admin_delete on public.despesas;
create policy tbr_despesas_admin_select on public.despesas for select to authenticated using (public.is_admin());
create policy tbr_despesas_admin_insert on public.despesas for insert to authenticated with check (public.is_admin());
create policy tbr_despesas_admin_update on public.despesas for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy tbr_despesas_admin_delete on public.despesas for delete to authenticated using (public.is_admin());

revoke all on public.despesas from anon;
grant select, insert, update, delete on public.despesas to authenticated;

create or replace function public.tbr_despesas_touch() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists tbr_despesas_touch on public.despesas;
create trigger tbr_despesas_touch before update on public.despesas for each row execute function public.tbr_despesas_touch();
