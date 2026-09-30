-- Único campo novo necessário para o resumo de investimento.
-- Os percentuais e a meta de locação são calculados no admin e não são duplicados no banco.
alter table public.bolsas
  add column if not exists valor_pago numeric(12, 2);

comment on column public.bolsas.valor_pago is
  'Valor efetivamente pago pela The Bag Room na aquisição da bolsa.';

alter table public.bolsas
  drop constraint if exists bolsas_valor_pago_nao_negativo;

alter table public.bolsas
  add constraint bolsas_valor_pago_nao_negativo
  check (valor_pago is null or valor_pago >= 0);
