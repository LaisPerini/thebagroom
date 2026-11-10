-- Sacola da cliente logada (uma bolsa por vez): permite ver em outro aparelho e mandar lembrete.
create table if not exists public.sacolas (
  cliente_auth_id uuid primary key default auth.uid(),
  bolsa_slug text not null check (char_length(bolsa_slug) between 1 and 120),
  data_inicio date,
  dados jsonb not null default '{}'::jsonb check (pg_column_size(dados) < 8000),
  atualizado_em timestamptz not null default now(),
  lembrete_enviado_em timestamptz
);
alter table public.sacolas enable row level security;

-- Ao mudar a bolsa ou as datas, o lembrete pode ser enviado de novo
create or replace function public.tbr_sacola_atualizada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.cliente_auth_id := coalesce(auth.uid(), new.cliente_auth_id);
  if not public.is_admin() and auth.uid() is not null then
    new.atualizado_em := now();
    if tg_op = 'INSERT' or new.bolsa_slug is distinct from old.bolsa_slug or new.data_inicio is distinct from old.data_inicio then
      new.lembrete_enviado_em := null;
    else
      new.lembrete_enviado_em := old.lembrete_enviado_em;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.tbr_sacola_atualizada() from public, anon, authenticated;
drop trigger if exists tbr_sacola_atualizada on public.sacolas;
create trigger tbr_sacola_atualizada before insert or update on public.sacolas
  for each row execute function public.tbr_sacola_atualizada();

drop policy if exists sacolas_propria_select on public.sacolas;
create policy sacolas_propria_select on public.sacolas for select to authenticated using (cliente_auth_id = auth.uid());
drop policy if exists sacolas_propria_insert on public.sacolas;
create policy sacolas_propria_insert on public.sacolas for insert to authenticated with check (cliente_auth_id = auth.uid());
drop policy if exists sacolas_propria_update on public.sacolas;
create policy sacolas_propria_update on public.sacolas for update to authenticated using (cliente_auth_id = auth.uid()) with check (cliente_auth_id = auth.uid());
drop policy if exists sacolas_propria_delete on public.sacolas;
create policy sacolas_propria_delete on public.sacolas for delete to authenticated using (cliente_auth_id = auth.uid());
grant select, insert, update, delete on public.sacolas to authenticated;

-- Quando a cliente cria o pedido, a sacola dela é esvaziada
create or replace function public.tbr_esvaziar_sacola() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cliente_auth_id is not null then
    delete from public.sacolas where cliente_auth_id = new.cliente_auth_id;
  end if;
  return new;
end $$;
revoke execute on function public.tbr_esvaziar_sacola() from public, anon, authenticated;
drop trigger if exists tbr_esvaziar_sacola on public.aluguel_pedidos;
create trigger tbr_esvaziar_sacola after insert on public.aluguel_pedidos
  for each row execute function public.tbr_esvaziar_sacola();

-- O disparador de hora em hora passa a olhar também as sacolas paradas (3h a 48h, sem lembrete)
create or replace function public.tbr_disparar_pagamentos_pendentes() returns bigint
language plpgsql security definer set search_path = public as $$
declare segredo text;
begin
  if not exists (select 1 from public.aluguel_pedidos where status = 'aguardando_pagamento'
                 and created_at between now() - interval '72 hours' and now() - interval '2 hours')
     and not exists (select 1 from public.sacolas where lembrete_enviado_em is null
                 and atualizado_em between now() - interval '48 hours' and now() - interval '3 hours') then
    return null;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'email_worker_secret';
  if segredo is null then raise exception 'Email worker secret is not configured'; end if;
  return net.http_post(
    url := 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/functions/v1/notificar-novo-aluguel',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{"acao":"pagamentos_pendentes"}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;
revoke execute on function public.tbr_disparar_pagamentos_pendentes() from public, anon, authenticated;
