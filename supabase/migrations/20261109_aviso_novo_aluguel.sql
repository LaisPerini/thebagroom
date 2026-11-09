-- E-mail para a loja quando um aluguel é pago ou confirmado.
create table if not exists public.tbr_notificacoes_aluguel (
  pedido_id uuid primary key references public.aluguel_pedidos(id) on delete cascade,
  enviado_em timestamptz not null default now()
);
alter table public.tbr_notificacoes_aluguel enable row level security;
drop policy if exists tbr_notif_aluguel_admin_select on public.tbr_notificacoes_aluguel;
create policy tbr_notif_aluguel_admin_select on public.tbr_notificacoes_aluguel for select to authenticated using (public.is_admin());
revoke all on public.tbr_notificacoes_aluguel from anon, authenticated;
grant select on public.tbr_notificacoes_aluguel to authenticated;

create or replace function public.tbr_avisar_novo_aluguel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('pagamento_aprovado','reserva_confirmada')
     and (tg_op = 'INSERT' or old.status = 'aguardando_pagamento') then
    perform net.http_post(
      url := 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/functions/v1/notificar-novo-aluguel',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('pedido_id', new.id)
    );
  end if;
  return new;
end $$;
revoke execute on function public.tbr_avisar_novo_aluguel() from public, anon, authenticated;

drop trigger if exists tbr_avisar_novo_aluguel on public.aluguel_pedidos;
create trigger tbr_avisar_novo_aluguel after insert or update of status on public.aluguel_pedidos
for each row execute function public.tbr_avisar_novo_aluguel();
