# Aviso de novo cadastro

Implante a Edge Function `notificar-novo-cliente` e configure estes secrets no Supabase:

- `RESEND_API_KEY`: chave da conta Resend.
- `ADMIN_NOTIFICATION_EMAIL`: e-mail que receberá os avisos (padrão: `thebagroom.br@gmail.com`).
- `RESEND_FROM_EMAIL`: remetente verificado, por exemplo `The Bag Room <notificacoes@thebagroom.com.br>`.

Enquanto o domínio não estiver verificado no Resend, use `The Bag Room <onboarding@resend.dev>` e envie somente para o endereço proprietário da conta Resend.

A função valida a identidade da cliente e busca o cadastro diretamente no Supabase. Nenhum documento ou CPF é enviado por e-mail.
