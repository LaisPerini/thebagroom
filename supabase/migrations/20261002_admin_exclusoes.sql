-- Instala a opção de exclusão. Não exclui registros ao executar esta migração.
begin;
create or replace function public.admin_excluir_registro(p_tipo text,p_id text,p_confirmacao text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid; affected integer;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'admin_obrigatorio'; end if;
 if p_confirmacao<>'APAGAR' or p_confirmacao is null then raise exception 'confirmacao_obrigatoria'; end if;
 if p_tipo='pedido' then
  perform 1 from public.aluguel_pedidos where id::text=p_id for update;
  if not found then raise exception 'registro_nao_encontrado'; end if;
  if exists(select 1 from public.pagamentos_aluguel where pedido_id::text=p_id) or exists(select 1 from public.caucoes where pedido_id::text=p_id) then raise exception 'pedido_com_pagamento_ou_caucao'; end if;
  if exists(select 1 from public.cupons_usos where pedido_id::text=p_id and consumido) then raise exception 'cupom_consumido'; end if;
  delete from public.cupons_usos where pedido_id::text=p_id and not consumido;
  delete from public.aluguel_pedidos where id::text=p_id;
 elsif p_tipo='bolsa' then
  perform 1 from public.bolsas where id::text=p_id for update;
  if not found then raise exception 'registro_nao_encontrado'; end if;
  if exists(select 1 from public.aluguel_itens where bolsa_id::text=p_id) or exists(select 1 from public.bolsa_reservas where bolsa_id::text=p_id) then raise exception 'bolsa_com_historico_ou_reserva'; end if;
  delete from public.bolsas where id::text=p_id;
 elsif p_tipo='cliente' then
  select usuario_auth_id into uid from public.validacao_clientes where id::text=p_id for update;
  if not found then raise exception 'registro_nao_encontrado'; end if;
  if exists(select 1 from public.aluguel_pedidos where cliente_auth_id=uid) then raise exception 'cliente_com_historico'; end if;
  delete from public.validacao_clientes where id::text=p_id;
 else raise exception 'tipo_invalido';
 end if;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'registro_nao_encontrado'; end if;
 return jsonb_build_object('deleted',true,'tipo',p_tipo,'id',p_id);
end $$;
revoke all on function public.admin_excluir_registro(text,text,text) from public,anon;
grant execute on function public.admin_excluir_registro(text,text,text) to authenticated;
commit;
