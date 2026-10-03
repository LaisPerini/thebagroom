# Cupons: frete grátis e exclusão

1. Executar supabase/migrations/20261003_cupons_frete_exclusao.sql no SQL Editor do Supabase. A transação aborta sem aplicar parcialmente se as funções atuais tiverem formato diferente do esperado. Não altera pedidos existentes nem cria cobranças.
2. Publicar admin.html, admin-coupons.js, checkout-aluguel.html e checkout-coupons.js.

No Admin, frete grátis cobre ida e devolução, independentemente do percentual de desconto no aluguel. Cupons existentes continuam com frete cobrado. A regra é validada na criação do pedido no banco; o preço original do frete continua registrado e valor_desconto_frete identifica a isenção. Valor total cobrado desconta o frete. Cupom de 100% com frete grátis mantém a caução isenta e segue o fluxo existente de cortesia, sem cobrança externa.

Apagar solicita confirmação. Cupom manual sem usos é excluído do banco; cupom ligado a qualquer pedido é desativado/arquivado para preservar os vínculos e não aparece na lista. Boas-vindas automático não recebe botão Apagar. Arquivamento não muda pedidos nem devolve usos consumidos.

Preparado localmente; SQL ainda não aplicado nesta atualização. Não afirmar que frete grátis foi ativado até aplicar e validar a migração. Validar primeiro em ambiente de testes, inclusive limites, concorrência, 100%, frete normal e gratuidade. Nenhum pedido/cobrança criado durante a implementação.
