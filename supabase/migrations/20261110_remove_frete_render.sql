-- O frete saiu do Render (agora é a função 'frete' no Supabase): não precisa mais mantê-lo acordado.
select cron.unschedule('tbr-frete-acordado') where exists (select 1 from cron.job where jobname = 'tbr-frete-acordado');
