-- Mantém o servidor de frete (Render, plano gratuito) acordado das 7h à meia-noite (Brasília):
-- um acesso a cada 10 minutos impede que ele "durma" e leve até 1 minuto para responder.
select cron.unschedule('tbr-frete-acordado') where exists (select 1 from cron.job where jobname = 'tbr-frete-acordado');
select cron.schedule('tbr-frete-acordado', '*/10 0-2,10-23 * * *',
  $$select net.http_get(url := 'https://thebagroomtest.onrender.com/', timeout_milliseconds := 60000);$$);
