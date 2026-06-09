# Banco de dados - PataFeliz v2

Este diretorio guarda o redesenho do banco para transformar o sistema em um portal com tres perfis:

- administrador
- veterinario
- cliente/tutor

## Arquivos

- `schema-v2.sql`: cria uma nova base `pata_feliz_v2` com tabelas para usuarios, clientes, veterinarios, animais, agenda, procedimentos, prontuarios, vacinas, lembretes e alertas.
- `schema-v2-postgres.sql`: versao PostgreSQL do mesmo modelo. Esta e a versao recomendada para a proxima fase do sistema.
- `seed-v2-postgres.sql`: dados ficticios para testar o sistema com administrador, veterinarios, tutores, animais, agenda, prontuarios, vacinas e lembretes.

## O que mudou em relacao ao banco atual

O banco atual tem entidades simples como `cliente`, `animal`, `veterinario`, `servico`, `atendimento` e `prontuario`.

O modelo v2 separa melhor responsabilidades:

- `usuarios`: login e perfil de acesso.
- `clientes`: dados do tutor ligados ao usuario.
- `veterinarios`: dados profissionais ligados ao usuario.
- `animais`: pets do tutor.
- `procedimentos`: substitui/expande `servico`, com duracao padrao e preco base.
- `atendimentos`: agenda completa com inicio, fim, status, valores e origem.
- `prontuarios`: historico clinico gerado pelo veterinario.
- `esquemas_vacinais`, `etapas_esquema_vacinal` e `vacinas_aplicadas`: base para sugestoes de proximas doses.
- `lembretes`: painel interno para consultas proximas, vacinas vencidas e animais sem atendimento.

## PostgreSQL

Para usar PostgreSQL no backend, configure o `.env` assim:

```env
DB_CLIENT=postgres
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=sua_senha
DB_NAME=pata_feliz_v2
DB_PORT=5432
DB_SSL=false
PORT=3000
```

Para criar o banco e aplicar o schema:

```powershell
createdb pata_feliz_v2
psql -d pata_feliz_v2 -f database/schema-v2-postgres.sql
```

Para inserir os dados ficticios:

```powershell
psql -d pata_feliz_v2 -f database/seed-v2-postgres.sql
```

Logins ficticios principais:

- Administrador: `admin@patafeliz.local`
- Veterinaria: `ana.ribeiro@patafeliz.local`
- Veterinario: `bruno.nascimento@patafeliz.local`
- Veterinaria: `carla.menezes@patafeliz.local`
- Cliente: `mariana.costa@email.local`
- Cliente: `rafael.almeida@email.local`
- Cliente: `beatriz.souza@email.local`
- Cliente: `carlos.pereira@email.local`
- Cliente: `juliana.martins@email.local`

Senha de todos os usuarios ficticios: `123456`.

Em hospedagens como Render, Railway ou Supabase, normalmente voce recebe uma URL/conjunto de variaveis do PostgreSQL. Nesse caso, ajuste `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` e, se necessario, `DB_SSL=true`.

## Importante

Ainda nao aplique este schema no banco usado pelo sistema atual sem antes fazer backup.

O proximo passo recomendado e criar uma migracao dos dados antigos para as tabelas novas, por exemplo:

- `cliente` -> `usuarios` + `clientes`
- `veterinario` -> `usuarios` + `veterinarios`
- `animal` -> `animais`
- `servico` -> `procedimentos`
- `atendimento` -> `atendimentos`
- `prontuario` -> `prontuarios`

## Regra critica da agenda

No PostgreSQL, `schema-v2-postgres.sql` usa `EXCLUDE USING GIST` para impedir que dois atendimentos ativos do mesmo veterinario tenham horarios sobrepostos.

No MySQL, nao ha uma constraint simples equivalente. Nesse caso, a validacao precisa ser feita no backend, dentro de uma transacao:

1. Buscar atendimentos do veterinario no periodo usando bloqueio.
2. Verificar se existe conflito entre `inicio` e `fim`.
3. Inserir ou atualizar apenas se nao houver conflito.
