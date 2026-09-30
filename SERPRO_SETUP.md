# Ativação da validação oficial de CPF

A integração foi preparada para a API oficial contratada do SERPRO. Ela permanece bloqueada até que o contrato e as credenciais sejam configurados.

## Contratação

Contrate o produto Consulta CPF do SERPRO adequado ao uso da The Bag Room e solicite o acesso ao ambiente de produção. Confirme com o SERPRO o endpoint e o corpo exigidos pela versão contratada, pois eles não devem ser inferidos nem substituídos por uma API não oficial.

## Secrets da Edge Function

Configure no projeto Supabase:

- `SERPRO_CONSUMER_KEY`
- `SERPRO_CONSUMER_SECRET`
- `SERPRO_TOKEN_URL` — por padrão, `https://gateway.apiserpro.serpro.gov.br/token`
- `SERPRO_CPF_URL` — endpoint exato entregue no contrato/API Center do SERPRO

Depois, implante `supabase/functions/validar-cpf-serpro`.

As credenciais ficam exclusivamente nos secrets do Supabase. O navegador recebe apenas `valid`, `reason` e um status normalizado; nome, CPF, data de nascimento e resposta completa da Receita não são devolvidos nem registrados pela função.

## Segurança operacional

Antes da produção, recomenda-se configurar proteção contra abuso (por exemplo, CAPTCHA e limite de requisições), pois a validação ocorre antes da criação da conta do cliente.
