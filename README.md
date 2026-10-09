# Portal da Ouvidoria — Shell (público por natureza)

Capa de login do portal: **https://ruianycs.github.io/portal-ouvidoria-shell/**

Contém SOMENTE a interface pública (index.html + app.js + build): login Google corporativo
(@arrobabandalarga.com.br validado server-side) e navegação. Todo conteúdo documental vive no
backend privado Supabase e só é entregue mediante sessão válida — nada aqui expõe dados internos.

Pipeline autônomo: push → GitHub Actions → gate anti-secret (`scripts/gate_check.py`, falha o
deploy se encontrar service_role/secret/chave privada/`.env`/token) → deploy oficial do Pages.

Valores públicos por design neste repo: URL do projeto Supabase e chave publishable (anon).
NUNCA comitar: service_role, secrets, documentos internos, dados de clientes/colaboradores.
