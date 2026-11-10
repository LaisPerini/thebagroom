-- Etiquetas no carrinho do Melhor Envio quando o aluguel é pago + busca automática do código de rastreio.
-- O site só COLOCA no carrinho; pagar e gerar a etiqueta continua sendo feito pela loja no painel do Melhor Envio.
create table if not exists public.melhor_envio_envios (
  pedido_id uuid not null references public.aluguel_pedidos(id) on delete cascade,
  tipo text not null check (tipo in ('envio', 'devolucao')),
  me_order_id text,
  protocolo text,
  status text,
  rastreio text,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pedido_id, tipo)
);
alter table public.melhor_envio_envios enable row level security;
revoke all on public.melhor_envio_envios from anon, authenticated;
drop policy if exists "admin le etiquetas" on public.melhor_envio_envios;
create policy "admin le etiquetas" on public.melhor_envio_envios for select to authenticated using (public.is_admin());

create or replace function public.tbr_melhor_envio_carrinho() returns trigger
language plpgsql security definer set search_path = public as $$
declare segredo text;
begin
  if new.status in ('pagamento_aprovado', 'reserva_confirmada')
     and old.status is distinct from new.status
     and old.status not in ('pagamento_aprovado', 'reserva_confirmada')
     and coalesce(new.observacao_cliente, '') ~* '(entrega|devolucao):\s*sedex' then
    select decrypted_secret into segredo from vault.decrypted_secrets where name = 'email_worker_secret';
    perform net.http_post(
      url := 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/functions/v1/melhor-envio',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(segredo, '')),
      body := jsonb_build_object('acao', 'carrinho', 'pedido_id', new.id),
      timeout_milliseconds := 30000);
  end if;
  return new;
end $$;
revoke execute on function public.tbr_melhor_envio_carrinho() from public, anon, authenticated;
drop trigger if exists tbr_melhor_envio_carrinho on public.aluguel_pedidos;
create trigger tbr_melhor_envio_carrinho after update of status on public.aluguel_pedidos
  for each row execute function public.tbr_melhor_envio_carrinho();

create or replace function public.tbr_disparar_rastreios_melhor_envio() returns void
language plpgsql security definer set search_path = public as $$
declare segredo text;
begin
  if not exists (select 1 from public.melhor_envio_envios where me_order_id is not null and rastreio is null) then return; end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'email_worker_secret';
  perform net.http_post(
    url := 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/functions/v1/melhor-envio',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(segredo, '')),
    body := jsonb_build_object('acao', 'rastreios'),
    timeout_milliseconds := 30000);
end $$;
revoke execute on function public.tbr_disparar_rastreios_melhor_envio() from public, anon, authenticated;

select cron.unschedule('tbr-rastreio-melhor-envio') where exists (select 1 from cron.job where jobname = 'tbr-rastreio-melhor-envio');
select cron.schedule('tbr-rastreio-melhor-envio', '47 * * * *', 'select public.tbr_disparar_rastreios_melhor_envio()');
