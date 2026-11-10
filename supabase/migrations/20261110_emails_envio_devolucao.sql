-- E-mails "Sua bolsa está a caminho" (ao salvar o código de rastreio do envio no admin)
-- e "Recebemos sua bolsa" (quando o pedido passa para devolvido).
create or replace function public.tbr_avisar_rastreio() returns trigger
language plpgsql security definer set search_path = public as $$
declare segredo text;
begin
  if new.tipo = 'envio' and coalesce(trim(new.codigo_rastreio), '') <> ''
     and (tg_op = 'INSERT' or new.codigo_rastreio is distinct from old.codigo_rastreio) then
    select decrypted_secret into segredo from vault.decrypted_secrets where name = 'email_worker_secret';
    perform net.http_post(
      url := 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/functions/v1/notificar-novo-aluguel',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(segredo, '')),
      body := jsonb_build_object('acao', 'rastreio', 'rastreio_id', new.id));
  end if;
  return new;
end $$;
revoke execute on function public.tbr_avisar_rastreio() from public, anon, authenticated;
drop trigger if exists tbr_avisar_rastreio on public.rastreamentos_aluguel;
create trigger tbr_avisar_rastreio after insert or update of codigo_rastreio on public.rastreamentos_aluguel
  for each row execute function public.tbr_avisar_rastreio();

create or replace function public.tbr_avisar_devolucao() returns trigger
language plpgsql security definer set search_path = public as $$
declare segredo text;
begin
  if new.status = 'devolvido' and old.status is distinct from new.status then
    select decrypted_secret into segredo from vault.decrypted_secrets where name = 'email_worker_secret';
    perform net.http_post(
      url := 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/functions/v1/notificar-novo-aluguel',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(segredo, '')),
      body := jsonb_build_object('acao', 'devolvido', 'pedido_id', new.id));
  end if;
  return new;
end $$;
revoke execute on function public.tbr_avisar_devolucao() from public, anon, authenticated;
drop trigger if exists tbr_avisar_devolucao on public.aluguel_pedidos;
create trigger tbr_avisar_devolucao after update of status on public.aluguel_pedidos
  for each row execute function public.tbr_avisar_devolucao();
