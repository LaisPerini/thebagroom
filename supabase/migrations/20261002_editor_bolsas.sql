-- Execute in the Supabase SQL Editor. Does not replace existing bag data/images.
begin;
alter table public.bolsas add column if not exists imagem_capa_url text;
alter table public.bolsas add column if not exists galeria_automatica boolean not null default false;

-- Restrict all writes to admins, including when older permissive policies exist.
do $$
declare t text; a text;
begin
  foreach t in array array['bolsas','bolsa_precos','bolsa_imagens'] loop
    execute format('alter table public.%I enable row level security',t);
    foreach a in array array['insert','update','delete'] loop
      execute format('drop policy if exists %I on public.%I','tbr_admin_'||a,t);
      execute format('drop policy if exists %I on public.%I','tbr_admin_gate_'||a,t);
      if a='insert' then
        execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())','tbr_admin_'||a,t);
        execute format('create policy %I on public.%I as restrictive for insert to public with check (auth.uid() is not null and public.is_admin())','tbr_admin_gate_'||a,t);
      elsif a='update' then
        execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())','tbr_admin_'||a,t);
        execute format('create policy %I on public.%I as restrictive for update to public using (auth.uid() is not null and public.is_admin()) with check (auth.uid() is not null and public.is_admin())','tbr_admin_gate_'||a,t);
      else
        execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())','tbr_admin_'||a,t);
        execute format('create policy %I on public.%I as restrictive for delete to public using (auth.uid() is not null and public.is_admin())','tbr_admin_gate_'||a,t);
      end if;
    end loop;
    execute format('grant insert, update, delete on public.%I to authenticated',t);
  end loop;
end $$;

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
    update public.bolsas set nome=p_bolsa->>'nome',marca=p_bolsa->>'marca',categoria=p_bolsa->>'categoria',cor=p_bolsa->>'cor',material=p_bolsa->>'material',dimensoes=p_bolsa->>'dimensoes',estado=p_bolsa->>'estado',descricao=p_bolsa->>'descricao',valor_loja=(p_bolsa->>'valor_loja')::numeric,valor_pago=(p_bolsa->>'valor_pago')::numeric,valor_caucao=coalesce((p_bolsa->>'valor_caucao')::numeric,0),ativa=coalesce((p_bolsa->>'ativa')::boolean,false),destaque=coalesce((p_bolsa->>'destaque')::boolean,false),imagem_capa_url=p_bolsa->>'imagem_capa_url',galeria_automatica=true,updated_at=now() where id=p_id returning id into v_id;
  else
    insert into public.bolsas(slug,nome,marca,categoria,cor,material,dimensoes,estado,descricao,valor_loja,valor_pago,valor_caucao,ativa,destaque,imagem_capa_url,galeria_automatica)
    values(v_slug,p_bolsa->>'nome',p_bolsa->>'marca',p_bolsa->>'categoria',p_bolsa->>'cor',p_bolsa->>'material',p_bolsa->>'dimensoes',p_bolsa->>'estado',p_bolsa->>'descricao',(p_bolsa->>'valor_loja')::numeric,(p_bolsa->>'valor_pago')::numeric,coalesce((p_bolsa->>'valor_caucao')::numeric,0),coalesce((p_bolsa->>'ativa')::boolean,true),coalesce((p_bolsa->>'destaque')::boolean,false),p_bolsa->>'imagem_capa_url',true) returning id into v_id;
  end if;
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
commit;
