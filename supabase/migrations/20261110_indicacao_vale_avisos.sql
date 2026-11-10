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

-- =====================================================================
-- 3) Vale-presente (R$ 300, 500 ou 1.000; válido por 12 meses; saldo usado em um ou mais aluguéis)
-- =====================================================================
create table if not exists public.vales_presente (
  id uuid primary key default gen_random_uuid(),
  comprador_auth_id uuid not null references auth.users(id),
  comprador_nome text check (char_length(comprador_nome) <= 120),
  destinatario_nome text not null check (char_length(destinatario_nome) between 1 and 80),
  destinatario_email text not null check (char_length(destinatario_email) <= 200 and destinatario_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  mensagem text check (char_length(mensagem) <= 400),
  valor numeric(10,2) not null check (valor in (300, 500, 1000)),
  status text not null default 'aguardando_pagamento' check (status in ('aguardando_pagamento', 'pago', 'cancelado')),
  codigo text unique,
  saldo numeric(10,2) not null default 0 check (saldo >= 0),
  validade date,
  provider_payment_id text,
  checkout_url text,
  pago_em timestamptz,
  enviado_em timestamptz,
  created_at timestamptz not null default now()
);
alter table public.vales_presente enable row level security;
drop policy if exists vales_select on public.vales_presente;
create policy vales_select on public.vales_presente for select to authenticated
  using (comprador_auth_id = auth.uid() or public.is_admin());
grant select on public.vales_presente to authenticated;

create table if not exists public.vales_usos (
  id uuid primary key default gen_random_uuid(),
  vale_id uuid not null references public.vales_presente(id),
  pedido_id uuid not null unique references public.aluguel_pedidos(id) on delete cascade,
  valor numeric(10,2) not null check (valor > 0),
  estornado boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.vales_usos enable row level security;
drop policy if exists vales_usos_admin on public.vales_usos;
create policy vales_usos_admin on public.vales_usos for select to authenticated using (public.is_admin());
grant select on public.vales_usos to authenticated;

-- Pagamento do vale aprovado pelo Mercado Pago
create or replace function public.tbr_processar_vale_mp(p_payment jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.vales_presente; vid uuid; estado text; valor numeric; cod text;
begin
  vid := coalesce(p_payment->>'external_reference', p_payment#>>'{metadata,pedido_id}')::uuid;
  estado := p_payment->>'status';
  valor := (p_payment->>'transaction_amount')::numeric;
  select * into v from public.vales_presente where id = vid for update;
  if not found then return jsonb_build_object('ignored', true, 'reason', 'referencia_inexistente'); end if;
  if estado <> 'approved' then
    if estado in ('rejected', 'cancelled') and v.status = 'aguardando_pagamento' then
      update public.vales_presente set provider_payment_id = p_payment->>'id' where id = vid;
    end if;
    return jsonb_build_object('result', 'vale_' || estado);
  end if;
  if v.status = 'pago' then return jsonb_build_object('duplicate', true); end if;
  if coalesce(p_payment->>'currency_id', '') <> 'BRL' or valor <> v.valor then
    return jsonb_build_object('result', 'vale_revisao_valor');
  end if;
  loop
    cod := 'VP-' || upper(substr(translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/=01OIl', 'XYZABCDE'), 1, 4)) || '-'
                 || upper(substr(translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/=01OIl', 'XYZABCDE'), 1, 4));
    exit when not exists (select 1 from public.vales_presente where codigo = cod);
  end loop;
  update public.vales_presente
     set status = 'pago', codigo = cod, saldo = v.valor, validade = current_date + 365,
         pago_em = coalesce((p_payment->>'date_approved')::timestamptz, now()), provider_payment_id = p_payment->>'id'
   where id = vid;
  return jsonb_build_object('result', 'vale_pago');
end $$;
revoke execute on function public.tbr_processar_vale_mp(jsonb) from public, anon, authenticated;

-- E-mails do vale quando ele é pago
create or replace function public.tbr_avisar_vale() returns trigger
language plpgsql security definer set search_path = public as $$
declare segredo text;
begin
  if new.status = 'pago' and coalesce(old.status, '') <> 'pago' then
    select decrypted_secret into segredo from vault.decrypted_secrets where name = 'email_worker_secret';
    perform net.http_post(
      url := 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/functions/v1/notificar-novo-aluguel',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(segredo, '')),
      body := jsonb_build_object('acao', 'vale', 'vale_id', new.id));
  end if;
  return new;
end $$;
revoke execute on function public.tbr_avisar_vale() from public, anon, authenticated;
drop trigger if exists tbr_avisar_vale on public.vales_presente;
create trigger tbr_avisar_vale after update of status on public.vales_presente
  for each row execute function public.tbr_avisar_vale();

-- Webhook do Mercado Pago: quando a referência não é um pedido, tenta como vale-presente.
-- (Única mudança na função: a linha do "pedido_inexistente".)
create or replace function public.tbr_processar_pagamento_mp(p_payment jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare p public.aluguel_pedidos; e public.tbr_webhook_pagamentos;
 pid uuid; payid text; estado text; evento_em timestamptz; v_valor numeric; financeiro public.pagamento_status;
 resultado text:='processado'; registro uuid; count_matches integer;
begin
 payid:=p_payment->>'id'; estado:=p_payment->>'status';
 pid:=coalesce(p_payment->>'external_reference',p_payment#>>'{metadata,pedido_id}')::uuid;
 evento_em:=(p_payment->>'date_last_updated')::timestamptz;
 v_valor:=(p_payment->>'transaction_amount')::numeric;
 if payid is null or payid!~'^[0-9]+$' or pid is null or evento_em is null or v_valor is null then raise exception 'payment_invalid'; end if;
 if estado not in ('approved','pending','in_process','authorized','rejected','cancelled','refunded','charged_back') then return jsonb_build_object('ignored',true); end if;
 perform pg_advisory_xact_lock(hashtextextended('mp:'||payid,0));
 select * into p from public.aluguel_pedidos where id=pid for update;
 if not found then return public.tbr_processar_vale_mp(p_payment); end if;
 select * into e from public.tbr_webhook_pagamentos where payment_id=payid;
 if e.payment_id is not null and e.pedido_id<>pid then raise exception 'payment_reference_conflict'; end if;
 if e.payment_id is not null and evento_em<=e.provider_updated_at then return jsonb_build_object('duplicate',true); end if;
 if coalesce(p_payment->>'currency_id','')<>'BRL' or v_valor<=0 or p.valor_total<=0 or v_valor<>p.valor_total then
  resultado:='revisao_valor_moeda';
 else
  financeiro:=case estado when 'approved' then 'aprovado' when 'rejected' then 'recusado' when 'cancelled' then 'cancelado' when 'refunded' then 'estornado' when 'charged_back' then 'estornado' else 'pendente' end;
  select count(*) into count_matches from public.pagamentos_aluguel where provider='mercado_pago' and provider_payment_id=payid;
  if count_matches>1 then resultado:='revisao_registros_duplicados';
  else
   select id into registro from public.pagamentos_aluguel where provider='mercado_pago' and provider_payment_id=payid;
   if registro is not null and exists(select 1 from public.pagamentos_aluguel where id=registro and pedido_id<>pid) then raise exception 'payment_reference_conflict'; end if;
   if registro is null then
    insert into public.pagamentos_aluguel(pedido_id,provider,provider_payment_id,status,valor,moeda,paid_at,raw_response)
    values(pid,'mercado_pago',payid,financeiro,v_valor,'BRL',case when estado='approved' then coalesce((p_payment->>'date_approved')::timestamptz,evento_em) end,p_payment);
   else
    update public.pagamentos_aluguel set status=financeiro,valor=v_valor,raw_response=p_payment,
     paid_at=case when estado='approved' then coalesce((p_payment->>'date_approved')::timestamptz,evento_em) else paid_at end where id=registro;
   end if;
   if estado='approved' then
    if p.status='aguardando_pagamento' and exists(select 1 from public.bolsa_reservas where pedido_id=pid and status='aguardando_pagamento') then
     update public.aluguel_pedidos set status='pagamento_aprovado' where id=pid;
     update public.bolsa_reservas set status='confirmada' where pedido_id=pid and status='aguardando_pagamento';
     insert into public.aluguel_status_historico(pedido_id,status_anterior,status_novo,observacao) values(pid,p.status,'pagamento_aprovado','Pagamento validado pelo webhook Mercado Pago');
    elsif p.status='cancelado' or p.status='aguardando_pagamento' then resultado:='revisao_aprovacao_sem_reserva';
    else resultado:='financeiro_atualizado_sem_regredir_pedido'; end if;
   elsif estado in ('refunded','charged_back') then resultado:='revisao_estorno'; end if;
  end if;
 end if;
 if resultado like 'revisao_%' and (e.payment_id is null or e.resultado<>resultado) then
  insert into public.aluguel_status_historico(pedido_id,status_anterior,status_novo,observacao) values(pid,p.status,p.status,'Revisão financeira necessária: '||resultado||'; pagamento '||payid);
 end if;
 insert into public.tbr_webhook_pagamentos(payment_id,pedido_id,provider_updated_at,provider_status,resultado)
 values(payid,pid,evento_em,estado,resultado) on conflict(payment_id) do update set provider_updated_at=excluded.provider_updated_at,provider_status=excluded.provider_status,resultado=excluded.resultado,updated_at=now();
 return jsonb_build_object('result',resultado);
end $function$;

-- Vale válido para usar (bloqueia a linha para descontar o saldo com segurança)
create or replace function public.tbr_vale_valido(p_codigo text) returns public.vales_presente
language plpgsql security definer set search_path = public as $$
declare v public.vales_presente;
begin
  select * into v from public.vales_presente where codigo = upper(trim(p_codigo)) for update;
  if v.id is null then raise exception 'cupom_invalido'; end if;
  if v.status <> 'pago' or v.validade < current_date then raise exception 'vale_vencido'; end if;
  if v.saldo <= 0 then raise exception 'vale_sem_saldo'; end if;
  return v;
end $$;
revoke execute on function public.tbr_vale_valido(text) from public, anon, authenticated;

-- Consulta no checkout: aceita cupom ou vale-presente (VP-XXXX-XXXX)
create or replace function public.consultar_cupom_aluguel(p_bolsa_slug text, p_dias integer, p_codigo text default null)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare c public.cupons; v public.vales_presente; preco numeric; desconto numeric; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'login_obrigatorio'; end if;
 select bp.valor into preco from public.bolsa_precos bp join public.bolsas b on b.id=bp.bolsa_id where b.slug=p_bolsa_slug and b.ativa and bp.dias=p_dias and bp.ativo;
 if preco is null then raise exception 'periodo_indisponivel'; end if;
 if upper(trim(coalesce(p_codigo,''))) like 'VP-%' then
  v:=public.tbr_vale_valido(p_codigo);
  desconto:=least(v.saldo, preco);
  return jsonb_build_object('codigo',v.codigo,'vale',true,'saldo',v.saldo,'percentual',0,'valor_aluguel',preco,'valor_desconto',desconto,'aluguel_liquido',preco-desconto,'frete_gratis',false);
 end if;
 c:=public.tbr_cupom_elegivel(p_codigo,uid);
 desconto:=case when c.id is null then 0 else round(preco*c.percentual/100,2) end;
 return jsonb_build_object('codigo',c.codigo,'percentual',coalesce(c.percentual,0),'valor_aluguel',preco,'valor_desconto',desconto,'aluguel_liquido',preco-desconto,'frete_gratis',coalesce(c.frete_gratis,false));
end $function$;

-- Criação do pedido: igual à anterior; com vale, desconta do saldo (até o valor do aluguel)
create or replace function public.criar_pedido_com_cupom(p_checkout jsonb, p_codigo text default null)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid:=auth.uid(); c public.cupons; v public.vales_presente; usa_vale boolean; pedido jsonb; pid uuid; desconto numeric; total numeric; frete numeric;
begin
 if uid is null then raise exception 'login_obrigatorio'; end if;
 if not exists(select 1 from public.validacao_clientes where usuario_auth_id=uid and status='aprovado') then raise exception 'cliente_nao_aprovado'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 usa_vale:=upper(trim(coalesce(p_codigo,''))) like 'VP-%';
 if usa_vale then v:=public.tbr_vale_valido(p_codigo); else c:=public.tbr_cupom_elegivel(p_codigo,uid); end if;
 frete:=coalesce((p_checkout->>'p_valor_frete')::numeric,0);
 if frete<0 or coalesce((p_checkout->>'p_entrega_preco')::numeric,0)<0 or coalesce((p_checkout->>'p_devolucao_preco')::numeric,0)<0 then raise exception 'frete_invalido'; end if;
 if coalesce(p_checkout->>'p_entrega_nome','')<>'Retirar' and coalesce((p_checkout->>'p_entrega_preco')::numeric,0)<=0 then raise exception 'frete_invalido'; end if;
 if coalesce(p_checkout->>'p_devolucao_nome','')<>'Retirar' and coalesce((p_checkout->>'p_devolucao_preco')::numeric,0)<=0 then raise exception 'frete_invalido'; end if;
 if abs(frete-(coalesce((p_checkout->>'p_entrega_preco')::numeric,0)+coalesce((p_checkout->>'p_devolucao_preco')::numeric,0)))>0.01 then raise exception 'frete_invalido'; end if;
 pedido:=public.criar_pedido_aluguel(
 p_checkout->>'p_bolsa_slug',(p_checkout->>'p_data_inicio')::date,(p_checkout->>'p_dias')::integer,frete,
 p_checkout->>'p_entrega_nome',coalesce((p_checkout->>'p_entrega_preco')::numeric,0),p_checkout->>'p_devolucao_nome',coalesce((p_checkout->>'p_devolucao_preco')::numeric,0),
 p_checkout->>'p_endereco_nome',p_checkout->>'p_endereco_cep',p_checkout->>'p_endereco_logradouro',p_checkout->>'p_endereco_numero',p_checkout->>'p_endereco_complemento',p_checkout->>'p_endereco_bairro',p_checkout->>'p_endereco_cidade',p_checkout->>'p_endereco_estado',
 (p_checkout->>'p_bloqueio_data_inicio')::date,(p_checkout->>'p_bloqueio_data_fim')::date);
 pid:=(pedido->>'pedido_id')::uuid;
 if usa_vale then
  desconto:=least(v.saldo,(pedido->>'valor_aluguel')::numeric);
  total:=(pedido->>'valor_aluguel')::numeric+frete-desconto;
  update public.aluguel_pedidos set valor_desconto=desconto,valor_total=total where id=pid;
  insert into public.vales_usos(vale_id,pedido_id,valor) values(v.id,pid,desconto);
  update public.vales_presente set saldo=saldo-desconto where id=v.id;
  return pedido||jsonb_build_object('valor_desconto',desconto,'valor_total',total,'cupom_codigo',v.codigo,'vale',true,'frete_gratis',false,'valor_desconto_frete',0);
 end if;
 desconto:=case when c.id is null then 0 else round((pedido->>'valor_aluguel')::numeric*c.percentual/100,2) end;
 total:=(pedido->>'valor_aluguel')::numeric+frete-desconto;
 if coalesce(c.frete_gratis,false) then
  total:=total-frete;
  update public.aluguel_pedidos set valor_desconto_frete=frete where id=pid;
 end if;
 update public.aluguel_pedidos set valor_desconto=desconto,valor_total=total where id=pid;
 if c.id is not null then insert into public.cupons_usos(cupom_id,pedido_id,cliente_auth_id,percentual,desconto) values(c.id,pid,uid,c.percentual,desconto); end if;
 if c.percentual=100 then
  update public.aluguel_pedidos set valor_caucao_total=0 where id=pid;
  update public.aluguel_itens set valor_caucao=0 where pedido_id=pid;
  pedido:=pedido||jsonb_build_object('valor_caucao',0);
 end if;
 pedido:=pedido||jsonb_build_object('frete_gratis',coalesce(c.frete_gratis,false),'valor_desconto_frete',case when coalesce(c.frete_gratis,false) then frete else 0 end);
 return pedido||jsonb_build_object('valor_desconto',desconto,'valor_total',total,'cupom_codigo',c.codigo);
end $function$;

-- Pedido cancelado: o valor usado do vale volta para o saldo
create or replace function public.tbr_estornar_vale() returns trigger
language plpgsql security definer set search_path = public as $$
declare u public.vales_usos;
begin
  if new.status = 'cancelado' and old.status <> 'cancelado' then
    for u in select * from public.vales_usos where pedido_id = new.id and not estornado for update loop
      update public.vales_presente set saldo = saldo + u.valor where id = u.vale_id;
      update public.vales_usos set estornado = true where id = u.id;
    end loop;
  end if;
  return new;
end $$;
revoke execute on function public.tbr_estornar_vale() from public, anon, authenticated;
drop trigger if exists tbr_estornar_vale on public.aluguel_pedidos;
create trigger tbr_estornar_vale after update of status on public.aluguel_pedidos
  for each row execute function public.tbr_estornar_vale();

-- Total zerado pelo vale (aluguel coberto e retirada no showroom): confirma sem cobrança, como a cortesia
create or replace function public.confirmar_pedido_cortesia(p_pedido_id uuid, p_cliente_auth_id uuid)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare p public.aluguel_pedidos;
begin
 select * into p from public.aluguel_pedidos where id=p_pedido_id for update;
 if p.id is null or p.cliente_auth_id<>p_cliente_auth_id then raise exception 'pedido_invalido'; end if;
 if p.status='cancelado' then raise exception 'pedido_cancelado'; end if;
 if p.valor_total<>0 or p.subtotal_aluguel<=0 or p.valor_desconto<>p.subtotal_aluguel
    or not (exists(select 1 from public.cupons_usos where pedido_id=p.id and percentual=100)
            or exists(select 1 from public.vales_usos where pedido_id=p.id and not estornado)) then raise exception 'cortesia_invalida'; end if;
 if not exists(select 1 from public.aceites_contratos_aluguel where pedido_id=p.id and cliente_auth_id=p_cliente_auth_id) then raise exception 'aceite_obrigatorio'; end if;
 if not exists(select 1 from public.validacao_clientes where usuario_auth_id=p_cliente_auth_id and status='aprovado') then raise exception 'cliente_nao_aprovado'; end if;
 if not exists(select 1 from public.bolsa_reservas where pedido_id=p.id and status in ('aguardando_pagamento','confirmada')) then raise exception 'reserva_invalida'; end if;
 if p.status<>'aguardando_pagamento' then
  if exists(select 1 from public.pagamentos_aluguel where pedido_id=p.id and provider='cortesia' and status='aprovado') then return; end if;
  raise exception 'status_invalido';
 end if;
 insert into public.pagamentos_aluguel(pedido_id,provider,provider_payment_id,status,valor,moeda,paid_at,raw_response) values(p.id,'cortesia','CORTESIA-'||p.id::text,'aprovado',0,'BRL',now(),jsonb_build_object('motivo',case when exists(select 1 from public.vales_usos where pedido_id=p.id) then 'Coberto por vale-presente' else 'Cupom de 100% sem frete' end));
 update public.aluguel_pedidos set status='pagamento_aprovado' where id=p.id;
 update public.bolsa_reservas set status='confirmada' where pedido_id=p.id;
 insert into public.aluguel_status_historico(pedido_id,status_anterior,status_novo,alterado_por,observacao) values(p.id,p.status,'pagamento_aprovado',p_cliente_auth_id,'Aluguel sem cobrança externa (cupom de 100% ou vale-presente)');
end $function$;

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
