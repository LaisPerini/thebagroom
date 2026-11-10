-- 1) Avaliações das clientes depois da devolução
create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references public.aluguel_pedidos(id) on delete cascade,
  cliente_auth_id uuid not null default auth.uid(),
  bolsa_id uuid references public.bolsas(id) on delete set null,
  nota smallint not null check (nota between 1 and 5),
  comentario text check (char_length(comentario) <= 1500),
  nome_exibicao text,
  autoriza_publicacao boolean not null default false,
  publicar boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.avaliacoes enable row level security;

-- Preenche bolsa e primeiro nome a partir do pedido; a cliente nunca publica sozinha
create or replace function public.tbr_preparar_avaliacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.cliente_auth_id := auth.uid();
    new.publicar := false;
  end if;
  if tg_op = 'INSERT' then
    select i.bolsa_id into new.bolsa_id from public.aluguel_itens i where i.pedido_id = new.pedido_id order by i.created_at limit 1;
    select split_part(trim(v.nome_completo), ' ', 1) into new.nome_exibicao
      from public.validacao_clientes v where v.usuario_auth_id = new.cliente_auth_id
      order by v.created_date desc limit 1;
    new.comentario := nullif(trim(new.comentario), '');
  end if;
  return new;
end $$;
revoke execute on function public.tbr_preparar_avaliacao() from public, anon, authenticated;
drop trigger if exists tbr_preparar_avaliacao on public.avaliacoes;
create trigger tbr_preparar_avaliacao before insert or update on public.avaliacoes
  for each row execute function public.tbr_preparar_avaliacao();

drop policy if exists avaliacoes_cliente_insert on public.avaliacoes;
create policy avaliacoes_cliente_insert on public.avaliacoes for insert to authenticated
  with check (
    cliente_auth_id = auth.uid() and publicar = false
    and exists (select 1 from public.aluguel_pedidos p where p.id = pedido_id
                and p.cliente_auth_id = auth.uid() and p.status in ('devolvido', 'caucao_liberada'))
  );
drop policy if exists avaliacoes_cliente_select on public.avaliacoes;
create policy avaliacoes_cliente_select on public.avaliacoes for select to authenticated
  using (cliente_auth_id = auth.uid() or public.is_admin());
drop policy if exists avaliacoes_admin_update on public.avaliacoes;
create policy avaliacoes_admin_update on public.avaliacoes for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists avaliacoes_admin_delete on public.avaliacoes;
create policy avaliacoes_admin_delete on public.avaliacoes for delete to authenticated
  using (public.is_admin());
-- Avaliações aprovadas (e autorizadas pela cliente) podem ser lidas pelo site
drop policy if exists avaliacoes_publicas on public.avaliacoes;
create policy avaliacoes_publicas on public.avaliacoes for select to anon, authenticated
  using (publicar and autoriza_publicacao);
grant select on public.avaliacoes to anon;
grant select, insert on public.avaliacoes to authenticated;
grant update (publicar), delete on public.avaliacoes to authenticated;

-- 2) Favoritas salvas na conta da cliente
create table if not exists public.favoritas (
  cliente_auth_id uuid not null default auth.uid(),
  bolsa_slug text not null check (char_length(bolsa_slug) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (cliente_auth_id, bolsa_slug)
);
alter table public.favoritas enable row level security;
drop policy if exists favoritas_propria_select on public.favoritas;
create policy favoritas_propria_select on public.favoritas for select to authenticated
  using (cliente_auth_id = auth.uid() or public.is_admin());
drop policy if exists favoritas_propria_insert on public.favoritas;
create policy favoritas_propria_insert on public.favoritas for insert to authenticated
  with check (cliente_auth_id = auth.uid());
drop policy if exists favoritas_propria_delete on public.favoritas;
create policy favoritas_propria_delete on public.favoritas for delete to authenticated
  using (cliente_auth_id = auth.uid());
grant select, insert, delete on public.favoritas to authenticated;

-- 3) Lembrete de pagamento pendente: de hora em hora
create or replace function public.tbr_disparar_pagamentos_pendentes() returns bigint
language plpgsql security definer set search_path = public as $$
declare segredo text;
begin
  if not exists (select 1 from public.aluguel_pedidos where status = 'aguardando_pagamento'
                 and created_at between now() - interval '72 hours' and now() - interval '2 hours') then
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

select cron.unschedule('tbr-pagamento-pendente') where exists (select 1 from cron.job where jobname = 'tbr-pagamento-pendente');
select cron.schedule('tbr-pagamento-pendente', '17 * * * *', 'select public.tbr_disparar_pagamentos_pendentes();');
