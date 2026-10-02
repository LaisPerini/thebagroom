# Bolsas conectadas ao Supabase

As páginas em aluguel/ e o catálogo aluguel.html consultam o banco ao abrir/recarregar. Não é necessário editar HTML para atualizar preços ou detalhes.

- bolsas: slug, nome, marca, descrição, estado, categoria, material, cor, dimensões, valor_loja, valor_caucao e ativa.
- bolsa_imagens: bolsa_id, url, alt, ordem e principal. A principal aparece primeiro.
- bolsa_precos: bolsa_id, dias, valor e ativo. Apenas preços ativos e positivos são oferecidos.

Nova bolsa: preencher essas três tabelas. O catálogo cria automaticamente o link para aluguel/bolsa.html?slug=SEU-SLUG. Não é necessário criar outro HTML. O slug deve ser único e corresponder ao cadastro.

Para gerenciar o certificado e a imagem editorial dos destaques pelo banco, execute no SQL Editor o arquivo supabase/migrations/20261002_bag_public_links.sql. Ele adiciona certificado_url e imagem_destaque_url sem alterar valores existentes. Preencha certificado_url com a URL pública da página ou documento correto; se deixar vazio após a migração, o link do certificado não será exibido. Até a migração, os certificados das páginas existentes permanecem.

Os destaques editoriais existentes foram preservados. Sua foto muda somente quando imagem_destaque_url estiver preenchida. O campo destaque não reorganiza esse carrossel editorial nesta versão.

Publique os arquivos do projeto junto com bag-data.js e aluguel/bolsa.html. Não envie chaves privadas ou arquivos .env. Nenhum dado do banco foi alterado durante esta implementação.
