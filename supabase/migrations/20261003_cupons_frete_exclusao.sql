begin;
alter table public.cupons add column if not exists frete_gratis boolean not null default false;
alter table public.cupons add column if not exists excluido_em timestamptz;
alter table public.aluguel_pedidos add column if not exists valor_desconto_frete numeric(12,2) not null default 0 check(valor_desconto_frete>=0);

-- Preserve the existing reservation, address, availability and coupon checks.
-- Abort atomically if the deployed definition differs from the inspected version.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.consultar_cupom_aluguel(text,integer,text)'::regprocedure);
 if position('''frete_gratis''' in definition)=0 then
  if position('''aluguel_liquido'',preco-desconto' in definition)=0 then raise exception 'consultar_cupom_aluguel: definição inesperada'; end if;
  definition:=replace(definition,'''aluguel_liquido'',preco-desconto','''aluguel_liquido'',preco-desconto,''frete_gratis'',coalesce(c.frete_gratis,false)');
  execute definition;
 end if;
 definition:=pg_get_functiondef('public.criar_pedido_com_cupom(jsonb,text)'::regprocedure);
 if position('valor_desconto_frete=' in definition)=0 then
  if position('total:=(pedido->>''valor_aluguel'')::numeric+frete-desconto;' in definition)=0 or position('return pedido||jsonb_build_object' in definition)=0 then raise exception 'criar_pedido_com_cupom: definição inesperada'; end if;
  definition:=replace(definition,'total:=(pedido->>''valor_aluguel'')::numeric+frete-desconto;',E'total:=(pedido->>''valor_aluguel'')::numeric+frete-desconto;\n if coalesce(c.frete_gratis,false) then\n total:=total-frete;\n update public.aluguel_pedidos set valor_desconto_frete=frete where id=pid;\n end if;');
  definition:=replace(definition,'return pedido||jsonb_build_object',E'pedido:=pedido||jsonb_build_object(''frete_gratis'',coalesce(c.frete_gratis,false),''valor_desconto_frete'',case when coalesce(c.frete_gratis,false) then frete else 0 end);\n return pedido||jsonb_build_object');
  execute definition;
 end if;
end $migration$;

create or replace function public.admin_excluir_cupom(p_cupom_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.cupons;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'admin_obrigatorio'; end if;
 select * into c from public.cupons where id=p_cupom_id for update;
 if c.id is null then raise exception 'cupom_inexistente'; end if;
 if c.tipo<>'manual' then raise exception 'cupom_automatico_protegido'; end if;
 if exists(select 1 from public.cupons_usos where cupom_id=c.id) then
  update public.cupons set ativo=false,excluido_em=now() where id=c.id;
  return jsonb_build_object('arquivado',true);
 end if;
 delete from public.cupons where id=c.id;
 return jsonb_build_object('apagado',true);
end $$;
revoke all on function public.admin_excluir_cupom(uuid) from public,anon;
grant execute on function public.admin_excluir_cupom(uuid) to authenticated;
commit;
