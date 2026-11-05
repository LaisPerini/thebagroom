-- =====================================================================
-- Valor pago privado (somente admin)
--
-- Problema: a coluna bolsas.valor_pago podia ser lida por qualquer
-- visitante com a chave pública do site.
-- Solução: o valor pago passa para a tabela bolsas_custos, que só
-- administradoras conseguem ler e alterar. A coluna pública é removida.
--
-- Como aplicar: Supabase > SQL Editor > colar tudo > Run.
-- É uma transação única: se qualquer passo falhar, nada é alterado.
-- Os valores atuais são copiados antes da remoção da coluna.
-- =====================================================================
begin;

-- 1) Tabela privada de custos
create table if not exists public.bolsas_custos (
  bolsa_id uuid primary key references public.bolsas(id) on delete cascade,
  valor_pago numeric(12, 2),
  updated_at timestamptz not null default now(),
  constraint bolsas_custos_valor_pago_nao_negativo check (valor_pago is null or valor_pago >= 0)
);
comment on table public.bolsas_custos is 'Custos de aquisição das bolsas. Leitura e escrita somente por administradoras.';

alter table public.bolsas_custos enable row level security;
alter table public.bolsas_custos force row level security;

revoke all on public.bolsas_custos from public, anon;
grant select, insert, update, delete on public.bolsas_custos to authenticated;

drop policy if exists tbr_custos_admin_select on public.bolsas_custos;
drop policy if exists tbr_custos_admin_insert on public.bolsas_custos;
drop policy if exists tbr_custos_admin_update on public.bolsas_custos;
drop policy if exists tbr_custos_admin_delete on public.bolsas_custos;
create policy tbr_custos_admin_select on public.bolsas_custos for select to authenticated using (public.is_admin());
create policy tbr_custos_admin_insert on public.bolsas_custos for insert to authenticated with check (public.is_admin());
create policy tbr_custos_admin_update on public.bolsas_custos for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy tbr_custos_admin_delete on public.bolsas_custos for delete to authenticated using (public.is_admin());

-- 2) Copia os valores existentes (pode ser executado de novo sem duplicar)
do $$
declare v_faltando integer;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bolsas' and column_name = 'valor_pago'
  ) then
    insert into public.bolsas_custos (bolsa_id, valor_pago)
    select id, valor_pago from public.bolsas where valor_pago is not null
    on conflict (bolsa_id) do update set valor_pago = excluded.valor_pago, updated_at = now();

    -- Trava de segurança: cancela tudo se algum valor não foi copiado igual
    execute $q$
      select count(*) from public.bolsas b
      left join public.bolsas_custos c on c.bolsa_id = b.id
      where b.valor_pago is not null and c.valor_pago is distinct from b.valor_pago
    $q$ into v_faltando;
    if v_faltando > 0 then
      raise exception 'Cópia incompleta (% bolsa(s)). Nada foi alterado.', v_faltando;
    end if;
  end if;
end $$;

-- 3) Salvamento do painel passa a gravar o valor pago na tabela privada
create or replace function public.admin_salvar_bolsa(p_bolsa jsonb, p_precos jsonb, p_imagens jsonb, p_id uuid default null)
returns uuid language plpgsql security invoker set search_path = public
as $$
declare v_id uuid; v_slug text; item jsonb; d integer; n numeric; v_price_id uuid;
begin
  if auth.uid() is null or not coalesce(public.is_admin(),false) then raise exception 'Acesso restrito a administradores'; end if;
  v_slug := trim(p_bolsa->>'slug');
  if coalesce(trim(p_bolsa->>'nome'),'')='' or coalesce(trim(p_bolsa->>'marca'),'')='' or coalesce(v_slug,'')='' then raise exception 'Informe nome, marca e slug'; end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Slug inválido'; end if;
  if coalesce(p_bolsa->>'imagem_capa_url','') !~ '^https?://[^[:space:]]+$' then raise exception 'URL de capa inválida'; end if;
  if jsonb_typeof(p_precos) is distinct from 'array' or jsonb_typeof(p_imagens) is distinct from 'array' then raise exception 'Listas de preços e imagens inválidas'; end if;
  if jsonb_array_length(p_imagens)=0 then raise exception 'Inclua pelo menos uma foto na galeria'; end if;
  if jsonb_array_length(p_precos)>30 or jsonb_array_length(p_imagens)>30 then raise exception 'Máximo de 30 períodos/fotos'; end if;
  if (select count(*) from jsonb_array_elements(p_precos)) <> (select count(distinct (x->>'dias')::integer) from jsonb_array_elements(p_precos) x) then raise exception 'Há períodos repetidos'; end if;
  foreach v_slug in array array['valor_loja','valor_pago','valor_caucao'] loop
    if (p_bolsa->>v_slug)::numeric < 0 then raise exception 'Valores não podem ser negativos'; end if;
  end loop;
  v_slug := trim(p_bolsa->>'slug');
  if p_id is not null then
    -- Lock the parent to serialize simultaneous edits of the same bag.
    perform 1 from public.bolsas where id=p_id for update;
    if not found then raise exception 'Bolsa não encontrada'; end if;
    if not exists(select 1 from public.bolsas where id=p_id and slug=v_slug) then raise exception 'O slug não pode mudar, para preservar o endereço da página'; end if;
    update public.bolsas set nome=p_bolsa->>'nome',marca=p_bolsa->>'marca',categoria=p_bolsa->>'categoria',cor=p_bolsa->>'cor',material=p_bolsa->>'material',dimensoes=p_bolsa->>'dimensoes',estado=p_bolsa->>'estado',descricao=p_bolsa->>'descricao',valor_loja=(p_bolsa->>'valor_loja')::numeric,valor_caucao=coalesce((p_bolsa->>'valor_caucao')::numeric,0),ativa=coalesce((p_bolsa->>'ativa')::boolean,false),destaque=coalesce((p_bolsa->>'destaque')::boolean,false),imagem_capa_url=p_bolsa->>'imagem_capa_url',galeria_automatica=true,updated_at=now() where id=p_id returning id into v_id;
  else
    insert into public.bolsas(slug,nome,marca,categoria,cor,material,dimensoes,estado,descricao,valor_loja,valor_caucao,ativa,destaque,imagem_capa_url,galeria_automatica)
    values(v_slug,p_bolsa->>'nome',p_bolsa->>'marca',p_bolsa->>'categoria',p_bolsa->>'cor',p_bolsa->>'material',p_bolsa->>'dimensoes',p_bolsa->>'estado',p_bolsa->>'descricao',(p_bolsa->>'valor_loja')::numeric,coalesce((p_bolsa->>'valor_caucao')::numeric,0),coalesce((p_bolsa->>'ativa')::boolean,true),coalesce((p_bolsa->>'destaque')::boolean,false),p_bolsa->>'imagem_capa_url',true) returning id into v_id;
  end if;
  -- Valor pago: somente na tabela privada
  insert into public.bolsas_custos(bolsa_id, valor_pago, updated_at)
  values (v_id, (p_bolsa->>'valor_pago')::numeric, now())
  on conflict (bolsa_id) do update set valor_pago = excluded.valor_pago, updated_at = now();
  update public.bolsa_precos set ativo=false where bolsa_id=v_id;
  for item in select * from jsonb_array_elements(p_precos) loop
    d:=(item->>'dias')::integer; n:=(item->>'valor')::numeric;
    if d is null or d<=0 or n is null or n<=0 then raise exception 'Período/preço inválido'; end if;
    select id into v_price_id from public.bolsa_precos where bolsa_id=v_id and dias=d order by created_at,id limit 1;
    if v_price_id is null then insert into public.bolsa_precos(bolsa_id,dias,valor,ativo) values(v_id,d,n,true);
    else update public.bolsa_precos set valor=n,ativo=true where id=v_price_id; end if;
  end loop;
  delete from public.bolsa_imagens where bolsa_id=v_id;
  d:=0;
  for item in select * from jsonb_array_elements(p_imagens) loop
    if coalesce(item->>'url','') !~ '^https?://[^[:space:]]+$' then raise exception 'URL de foto inválida'; end if;
    insert into public.bolsa_imagens(bolsa_id,url,alt,ordem,principal) values(v_id,item->>'url',p_bolsa->>'nome',d,d=0);
    d:=d+1;
  end loop;
  return v_id;
end $$;
revoke all on function public.admin_salvar_bolsa(jsonb,jsonb,jsonb,uuid) from public, anon;
grant execute on function public.admin_salvar_bolsa(jsonb,jsonb,jsonb,uuid) to authenticated;

-- 4) Remove a coluna pública (os valores já estão em bolsas_custos)
alter table public.bolsas drop constraint if exists bolsas_valor_pago_nao_negativo;
alter table public.bolsas drop column if exists valor_pago;

-- 5) Resumo
do $$
declare v_total integer;
begin
  select count(*) into v_total from public.bolsas_custos;
  raise notice 'Valores pagos guardados na tabela privada: %', v_total;
end $$;

commit;

-- Depois de rodar, confira no SQL Editor:
--   select b.nome, c.valor_pago from public.bolsas b
--   left join public.bolsas_custos c on c.bolsa_id = b.id order by b.nome;
