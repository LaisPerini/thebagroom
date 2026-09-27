# Dashboard administrativo

O Dashboard usa as tabelas existentes do Supabase e mantém a autorização atual por `is_admin`.

## Google Analytics 4

1. Crie uma conta de serviço no Google Cloud e habilite a Google Analytics Data API.
2. Adicione o e-mail da conta de serviço como leitor da propriedade GA4 `538615957`.
3. Configure os secrets da função:

   - `GA4_PROPERTY_ID=538615957`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`

4. Implante a Edge Function `ga4-dashboard`.

As credenciais nunca são enviadas ao navegador. A função exige uma sessão Supabase válida e confirma o acesso administrativo por `is_admin`.

## Eventos recomendados

O funil consulta `view_item`, `begin_checkout`, `sign_up`, `add_payment_info`, `purchase` e `rental_confirmed`. Eventos ausentes aparecem com zero e devem ser configurados no site/GTM antes de usar o funil para decisões.

## Banco

Esta implementação não cria nem altera tabelas. Métricas indisponíveis por falta de campos são omitidas em vez de inferidas.
