-- 1) Segurança: funções que exigem login deixam de aceitar chamadas sem login;
--    a função do gatilho de cadastro deixa de ser chamável pela API.
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('criar_pedido_aluguel', 'cancelar_pedido_aluguel_cliente')
  loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;
revoke execute on function public.notificar_novo_cadastro_validacao() from public, anon, authenticated;

-- 2) Registro de e-mails de aluguel: um por pedido e por tipo
--    (admin, confirmacao_cliente, lembrete_devolucao).
alter table public.tbr_notificacoes_aluguel add column if not exists tipo text not null default 'admin';
alter table public.tbr_notificacoes_aluguel drop constraint if exists tbr_notificacoes_aluguel_pkey;
alter table public.tbr_notificacoes_aluguel add primary key (pedido_id, tipo);

-- 3) Gatilho de aluguel pago passa a mandar o segredo do disparador.
create or replace function public.tbr_avisar_novo_aluguel() returns trigger
language plpgsql security definer set search_path = public as $$
declare segredo text;
begin
  if new.status in ('pagamento_aprovado','reserva_confirmada')
     and (tg_op = 'INSERT' or old.status = 'aguardando_pagamento') then
    select decrypted_secret into segredo from vault.decrypted_secrets where name = 'email_worker_secret';
    perform net.http_post(
      url := 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/functions/v1/notificar-novo-aluguel',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(segredo, '')),
      body := jsonb_build_object('pedido_id', new.id)
    );
  end if;
  return new;
end $$;
revoke execute on function public.tbr_avisar_novo_aluguel() from public, anon, authenticated;

-- 4) Lembrete de devolução: todo dia às 10h (Brasília) avisa quem devolve no dia seguinte.
create or replace function public.tbr_disparar_lembretes_devolucao() returns bigint
language plpgsql security definer set search_path = public as $$
declare segredo text;
begin
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'email_worker_secret';
  if segredo is null then raise exception 'Email worker secret is not configured'; end if;
  return net.http_post(
    url := 'https://zpyjnqkrsmgpwszqlcrs.supabase.co/functions/v1/notificar-novo-aluguel',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{"acao":"lembretes"}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;
revoke execute on function public.tbr_disparar_lembretes_devolucao() from public, anon, authenticated;

select cron.unschedule('tbr-lembrete-devolucao') where exists (select 1 from cron.job where jobname = 'tbr-lembrete-devolucao');
select cron.schedule('tbr-lembrete-devolucao', '0 13 * * *', 'select public.tbr_disparar_lembretes_devolucao();');
