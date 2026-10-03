-- Aplicar junto com admin.html/private-documents.js atualizados.
begin;
alter table public.validacao_clientes enable row level security;
revoke all on public.validacao_clientes from anon;
revoke truncate,references,trigger on public.validacao_clientes from authenticated;
grant select,insert,update,delete on public.validacao_clientes to authenticated;
create policy tbr_validacao_leitura on public.validacao_clientes for select to authenticated using(usuario_auth_id=auth.uid() or public.is_admin());
create policy tbr_validacao_cadastro on public.validacao_clientes for insert to authenticated with check(usuario_auth_id=auth.uid() and status='pendente');
create policy tbr_validacao_admin_update on public.validacao_clientes for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy tbr_validacao_admin_delete on public.validacao_clientes for delete to authenticated using(public.is_admin());
update storage.buckets set public=false where id='documentos-clientes';
drop policy "Allow public read 1ipxcp3_0" on storage.objects;
drop policy "Allow uploads 1ipxcp3_0" on storage.objects;
create policy tbr_documentos_leitura on storage.objects for select to authenticated using(bucket_id='documentos-clientes' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
create policy tbr_documentos_upload on storage.objects for insert to authenticated with check(bucket_id='documentos-clientes' and (storage.foldername(name))[1]=auth.uid()::text);
commit;
