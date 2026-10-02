-- Apenas pedidos novos com cupom de 100%; não recalcula pedidos existentes.
begin;
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.criar_pedido_com_cupom(jsonb,text)'::regprocedure);
 if position('valor_caucao_total=0' in definition)=0 then
  if position('return pedido||jsonb_build_object' in definition)=0 then raise exception 'Definição de criar_pedido_com_cupom inesperada'; end if;
  definition:=replace(definition,'return pedido||jsonb_build_object',E'if c.percentual=100 then\n update public.aluguel_pedidos set valor_caucao_total=0 where id=pid;\n update public.aluguel_itens set valor_caucao=0 where pedido_id=pid;\n pedido:=pedido||jsonb_build_object(''valor_caucao'',0);\n end if;\n return pedido||jsonb_build_object');
  execute definition;
 end if;
end $migration$;
commit;
