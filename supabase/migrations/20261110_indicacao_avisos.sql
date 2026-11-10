-- =====================================================================
-- 1) "Avise-me quando estiver livre"
-- =====================================================================
create table if not exists public.avisos_disponibilidade (
  id uuid primary key default gen_random_uuid(),
  bolsa_slug text not null references public.bolsas(slug) on update cascade on delete cascade,
  email text not null check (char_length(email) <= 200 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  data_desejada date not null,
  dias integer not null default 4 check (dias between 1 and 60),
  cliente_auth_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  avisado_em timestamptz,
  unique (email, bolsa_slug, data_desejada)
);
alter table public.avisos_disponibilidade enable row level security;
drop policy if exists avisos_insert on public.avisos_disponibilidade;
create policy avisos_insert on public.avisos_disponibilidade for insert to anon, authenticated
  with check (avisado_em is null and data_desejada >= current_date and data_desejada <= current_date + 365
              and (cliente_auth_id is null or cliente_auth_id = auth.uid())
              and exists (select 1 from public.bolsas b where b.slug = bolsa_slug and b.ativa));
drop policy if exists avisos_admin on public.avisos_disponibilidade;
create policy avisos_admin on public.avisos_disponibilidade for select to authenticated using (public.is_admin());
grant insert on public.avisos_disponibilidade to anon, authenticated;
grant select on public.avisos_disponibilidade to authenticated;

-- =====================================================================
-- 2) Indique uma amiga: amiga ganha 10% no 1º aluguel; quem indicou ganha 5%
-- =====================================================================
alter table public.cupons drop constraint if exists cupons_tipo_check;
alter table public.cupons add constraint cupons_tipo_check
  check (tipo = any (array['manual','boas_vindas','indicacao','credito_indicacao']));
alter table public.cupons add column if not exists indicado_por uuid references auth.users(id);
create unique index if not exists cupons_indicacao_unica on public.cupons (indicado_por) where tipo = 'indicacao';

-- Código pessoal da cliente (cria na primeira vez)
create or replace function public.meu_codigo_indicacao() returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cod text; tentativa int := 0;
begin
  if uid is null then raise exception 'login_obrigatorio'; end if;
  select codigo into cod from public.cupons where tipo = 'indicacao' and indicado_por = uid;
  if cod is not null then return cod; end if;
  loop
    tentativa := tentativa + 1;
    cod := 'AMIGA' || upper(substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=01OIl', 'XYZABCDE'), 1, 6));
    begin
      insert into public.cupons (codigo, percentual, tipo, ativo, inicio, limite_por_cliente, indicado_por)
      values (cod, 10, 'indicacao', true, now(), 1, uid);
      return cod;
    exception when unique_violation then
      if tentativa > 5 then raise; end if;
      select codigo into cod from public.cupons where tipo = 'indicacao' and indicado_por = uid;
      if cod is not null then return cod; end if;
    end;
  end loop;
end $$;
revoke execute on function public.meu_codigo_indicacao() from public, anon;
grant execute on function public.meu_codigo_indicacao() to authenticated;

-- Regras de elegibilidade (igual à anterior + código de indicação só no 1º aluguel e nunca o próprio)
create or replace function public.tbr_cupom_elegivel(p_codigo text, p_user uuid)
 returns cupons language plpgsql security definer set search_path to 'public' as $function$
declare c public.cupons; usados integer; criacao timestamptz;
begin
 if coalesce(trim(p_codigo),'')='' then
  select * into c from public.cupons where tipo='boas_vindas' and ativo for update;
 else select * into c from public.cupons where codigo=upper(trim(p_codigo)) for update;
 end if;
 if c.id is null then
  if coalesce(trim(p_codigo),'')='' then return null; end if;
  raise exception 'cupom_invalido';
 end if;
 if not c.ativo or now()<c.inicio or (c.fim is not null and now()>=c.fim) or (c.cliente_auth_id is not null and c.cliente_auth_id<>p_user) then
  if coalesce(trim(p_codigo),'')='' then return null; end if;
  raise exception 'cupom_indisponivel';
 end if;
 if c.tipo='boas_vindas' then
  select created_at into criacao from auth.users where id=p_user;
  if criacao is null or criacao<c.inicio or exists(select 1 from public.aluguel_pedidos where cliente_auth_id=p_user and status<>'cancelado') then
   if coalesce(trim(p_codigo),'')='' then return null; end if;
   raise exception 'cupom_apenas_novo_cadastro';
  end if;
 end if;
 if c.tipo='indicacao' then
  if c.indicado_por=p_user then raise exception 'cupom_proprio'; end if;
  if exists(select 1 from public.aluguel_pedidos where cliente_auth_id=p_user and status<>'cancelado') then
   raise exception 'cupom_apenas_primeiro_aluguel';
  end if;
 end if;
 select count(*) into usados from public.cupons_usos u join public.aluguel_pedidos p on p.id=u.pedido_id where u.cupom_id=c.id and u.cliente_auth_id=p_user and (u.consumido or p.status<>'cancelado');
 if usados>=c.limite_por_cliente then
  if coalesce(trim(p_codigo),'')='' then return null; end if;
  raise exception 'cupom_ja_utilizado';
 end if;
 select count(*) into usados from public.cupons_usos u join public.aluguel_pedidos p on p.id=u.pedido_id where u.cupom_id=c.id and (u.consumido or p.status<>'cancelado');
 if c.limite_total is not null and usados>=c.limite_total then
  if coalesce(trim(p_codigo),'')='' then return null; end if;
  raise exception 'cupom_limite_atingido';
 end if;
 return c;
end $function$;

-- Quando o aluguel da amiga é pago, quem indicou ganha um cupom de 5% (válido por 1 ano) e um e-mail
create or replace function public.tbr_credito_indicacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.cupons; cod text; novo uuid; segredo text;
begin
  if not new.consumido or coalesce(old.consumido, false) then return new; end if;
  select * into c from public.cupons where id = new.cupom_id;
  if c.tipo <> 'indicacao' or c.indicado_por is null then return new; end if;
  cod := 'OBRIGADA' || upper(substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=01OIl', 'XYZABCDE'), 1, 6));
  insert into public.cupons (codigo, percentual, tipo, ativo, inicio, fim, limite_total, limite_por_cliente, cliente_auth_id, indicado_por)
  values (cod, 5, 'credito_indicacao', true, now(), now() + interval '1 year', 1, 1, c.indicado_por, null)
  returning id into novo;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'email_worker_secret';
  perform net.http_post(
    url := 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/functions/v1/notificar-novo-aluguel',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(segredo, '')),
    body := jsonb_build_object('acao', 'indicacao', 'cupom_id', novo));
  return new;
end $$;
revoke execute on function public.tbr_credito_indicacao() from public, anon, authenticated;
drop trigger if exists tbr_credito_indicacao on public.cupons_usos;
create trigger tbr_credito_indicacao after update of consumido on public.cupons_usos
  for each row execute function public.tbr_credito_indicacao();

-- O disparador de hora em hora também confere os pedidos de "avise-me"
create or replace function public.tbr_disparar_pagamentos_pendentes() returns bigint
language plpgsql security definer set search_path = public as $$
declare segredo text;
begin
  if not exists (select 1 from public.aluguel_pedidos where status = 'aguardando_pagamento'
                 and created_at between now() - interval '72 hours' and now() - interval '2 hours')
     and not exists (select 1 from public.sacolas where lembrete_enviado_em is null
                 and atualizado_em between now() - interval '48 hours' and now() - interval '3 hours')
     and not exists (select 1 from public.avisos_disponibilidade where avisado_em is null and data_desejada >= current_date + 3) then
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

-- Minha conta: código de indicação, quantas amigas já alugaram e os cupons de agradecimento
create or replace function public.minhas_indicacoes() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cod text; cid uuid; amigas int;
begin
  if uid is null then raise exception 'login_obrigatorio'; end if;
  cod := public.meu_codigo_indicacao();
  select id into cid from public.cupons where codigo = cod;
  select count(*) into amigas from public.cupons_usos where cupom_id = cid and consumido;
  return jsonb_build_object(
    'codigo', cod,
    'amigas', amigas,
    'creditos', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', c.codigo, 'percentual', c.percentual, 'fim', c.fim,
               'usado', exists(select 1 from public.cupons_usos u join public.aluguel_pedidos p on p.id = u.pedido_id
                               where u.cupom_id = c.id and (u.consumido or p.status <> 'cancelado')))
             order by c.created_at desc)
      from public.cupons c where c.tipo = 'credito_indicacao' and c.cliente_auth_id = uid), '[]'::jsonb));
end $$;
revoke execute on function public.minhas_indicacoes() from public, anon;
grant execute on function public.minhas_indicacoes() to authenticated;
