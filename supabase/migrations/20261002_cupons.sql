begin;
create table if not exists public.cupons (
 id uuid primary key default gen_random_uuid(), codigo text not null unique check(codigo ~ '^[A-Z0-9_-]{3,40}$'),
 percentual numeric(5,2) not null check(percentual>0 and percentual<=100),
 tipo text not null default 'manual' check(tipo in ('manual','boas_vindas')),
 ativo boolean not null default true, inicio timestamptz not null default now(), fim timestamptz,
 limite_total integer check(limite_total>0), limite_por_cliente integer not null default 1 check(limite_por_cliente>0),
 cliente_auth_id uuid references auth.users(id), created_at timestamptz not null default now(),
 check(fim is null or fim>inicio),
 check(tipo<>'boas_vindas' or (percentual=5 and limite_por_cliente=1))
);
create unique index if not exists cupons_boas_vindas_unico on public.cupons(tipo) where tipo='boas_vindas';
insert into public.cupons(codigo,percentual,tipo,limite_por_cliente) values('BEMVINDA5',5,'boas_vindas',1) on conflict do nothing;
create table if not exists public.cupons_usos (
 id uuid primary key default gen_random_uuid(), cupom_id uuid not null references public.cupons(id),
 pedido_id uuid not null unique references public.aluguel_pedidos(id) on delete restrict,
 cliente_auth_id uuid not null references auth.users(id), percentual numeric(5,2) not null,
 desconto numeric(12,2) not null check(desconto>=0), consumido boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists cupons_usos_cliente on public.cupons_usos(cupom_id,cliente_auth_id);
alter table public.cupons enable row level security;
alter table public.cupons_usos enable row level security;
drop policy if exists cupons_admin on public.cupons;
create policy cupons_admin on public.cupons for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists cupons_usos_leitura on public.cupons_usos;
create policy cupons_usos_leitura on public.cupons_usos for select to authenticated using(cliente_auth_id=auth.uid() or public.is_admin());
revoke all on public.cupons,public.cupons_usos from anon;
grant select,insert,update,delete on public.cupons to authenticated;
revoke insert,update,delete on public.cupons_usos from authenticated;
grant select on public.cupons_usos to authenticated;

create or replace function public.tbr_cupom_elegivel(p_codigo text,p_user uuid)
returns public.cupons language plpgsql security definer set search_path=public as $$
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
end $$;
revoke all on function public.tbr_cupom_elegivel(text,uuid) from public,anon,authenticated;

create or replace function public.consultar_cupom_aluguel(p_bolsa_slug text,p_dias integer,p_codigo text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.cupons; preco numeric; desconto numeric; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'login_obrigatorio'; end if;
 select bp.valor into preco from public.bolsa_precos bp join public.bolsas b on b.id=bp.bolsa_id where b.slug=p_bolsa_slug and b.ativa and bp.dias=p_dias and bp.ativo;
 if preco is null then raise exception 'periodo_indisponivel'; end if;
 c:=public.tbr_cupom_elegivel(p_codigo,uid);
 desconto:=case when c.id is null then 0 else round(preco*c.percentual/100,2) end;
 return jsonb_build_object('codigo',c.codigo,'percentual',coalesce(c.percentual,0),'valor_aluguel',preco,'valor_desconto',desconto,'aluguel_liquido',preco-desconto);
end $$;
revoke all on function public.consultar_cupom_aluguel(text,integer,text) from public,anon;
grant execute on function public.consultar_cupom_aluguel(text,integer,text) to authenticated;

-- Wrap the existing reservation/address function rather than replacing its logic.
create or replace function public.criar_pedido_com_cupom(p_checkout jsonb,p_codigo text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); c public.cupons; pedido jsonb; pid uuid; desconto numeric; total numeric; frete numeric;
begin
 if uid is null then raise exception 'login_obrigatorio'; end if;
 if not exists(select 1 from public.validacao_clientes where usuario_auth_id=uid and status='aprovado') then raise exception 'cliente_nao_aprovado'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 c:=public.tbr_cupom_elegivel(p_codigo,uid);
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
 desconto:=case when c.id is null then 0 else round((pedido->>'valor_aluguel')::numeric*c.percentual/100,2) end;
 total:=(pedido->>'valor_aluguel')::numeric+frete-desconto;
 update public.aluguel_pedidos set valor_desconto=desconto,valor_total=total where id=pid;
 if c.id is not null then insert into public.cupons_usos(cupom_id,pedido_id,cliente_auth_id,percentual,desconto) values(c.id,pid,uid,c.percentual,desconto); end if;
 return pedido||jsonb_build_object('valor_desconto',desconto,'valor_total',total,'cupom_codigo',c.codigo);
end $$;
revoke all on function public.criar_pedido_com_cupom(jsonb,text) from public,anon;
grant execute on function public.criar_pedido_com_cupom(jsonb,text) to authenticated;

create or replace function public.tbr_consumir_cupom_pagamento()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='aprovado' then update public.cupons_usos set consumido=true where pedido_id=new.pedido_id; end if;
 return new;
end $$;
revoke all on function public.tbr_consumir_cupom_pagamento() from public,anon,authenticated;
drop trigger if exists consumir_cupom_pagamento on public.pagamentos_aluguel;
create trigger consumir_cupom_pagamento after insert or update of status on public.pagamentos_aluguel for each row execute function public.tbr_consumir_cupom_pagamento();

-- Called only by the payment Edge Function, after validating the user and contract.
create or replace function public.confirmar_pedido_cortesia(p_pedido_id uuid,p_cliente_auth_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare p public.aluguel_pedidos;
begin
 select * into p from public.aluguel_pedidos where id=p_pedido_id for update;
 if p.id is null or p.cliente_auth_id<>p_cliente_auth_id then raise exception 'pedido_invalido'; end if;
 if p.status='cancelado' then raise exception 'pedido_cancelado'; end if;
 if p.valor_total<>0 or p.subtotal_aluguel<=0 or p.valor_desconto<>p.subtotal_aluguel or not exists(select 1 from public.cupons_usos where pedido_id=p.id and percentual=100) then raise exception 'cortesia_invalida'; end if;
 if not exists(select 1 from public.aceites_contratos_aluguel where pedido_id=p.id and cliente_auth_id=p_cliente_auth_id) then raise exception 'aceite_obrigatorio'; end if;
 if not exists(select 1 from public.validacao_clientes where usuario_auth_id=p_cliente_auth_id and status='aprovado') then raise exception 'cliente_nao_aprovado'; end if;
 if not exists(select 1 from public.bolsa_reservas where pedido_id=p.id and status in ('aguardando_pagamento','confirmada')) then raise exception 'reserva_invalida'; end if;
 if p.status<>'aguardando_pagamento' then
  if exists(select 1 from public.pagamentos_aluguel where pedido_id=p.id and provider='cortesia' and status='aprovado') then return; end if;
  raise exception 'status_invalido';
 end if;
 insert into public.pagamentos_aluguel(pedido_id,provider,provider_payment_id,status,valor,moeda,paid_at,raw_response) values(p.id,'cortesia','CORTESIA-'||p.id::text,'aprovado',0,'BRL',now(),jsonb_build_object('motivo','Cupom de 100% sem frete'));
 update public.aluguel_pedidos set status='pagamento_aprovado' where id=p.id;
 update public.bolsa_reservas set status='confirmada' where pedido_id=p.id;
 insert into public.aluguel_status_historico(pedido_id,status_anterior,status_novo,alterado_por,observacao) values(p.id,p.status,'pagamento_aprovado',p_cliente_auth_id,'Aluguel de cortesia por cupom de 100%; sem cobrança externa');
end $$;
revoke all on function public.confirmar_pedido_cortesia(uuid,uuid) from public,anon,authenticated;
grant execute on function public.confirmar_pedido_cortesia(uuid,uuid) to service_role;
commit;
