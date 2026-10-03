begin;
create table public.tbr_webhook_pagamentos (
 payment_id text primary key, pedido_id uuid not null references public.aluguel_pedidos(id) on delete cascade,
 provider_updated_at timestamptz not null, provider_status text not null,
 resultado text not null, updated_at timestamptz not null default now()
);
alter table public.tbr_webhook_pagamentos enable row level security;
revoke all on public.tbr_webhook_pagamentos from anon,authenticated;
grant all on public.tbr_webhook_pagamentos to service_role;
create or replace function public.tbr_processar_pagamento_mp(p_payment jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
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
 if not found then return jsonb_build_object('ignored',true,'reason','pedido_inexistente'); end if;
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
end $$;
revoke all on function public.tbr_processar_pagamento_mp(jsonb) from public,anon,authenticated;
grant execute on function public.tbr_processar_pagamento_mp(jsonb) to service_role;
commit;
