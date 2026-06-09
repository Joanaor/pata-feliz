# Pata Feliz

Sistema de gestão para clínica veterinária com portal para administradores, veterinários e tutores.

## Estrutura do repositório

- `backend/` - API Node.js com Express e suporte a MySQL/PostgreSQL.
- `frontend/` - interface web simples com HTML, CSS e JavaScript.
- `backend/database/` - scripts de criação do banco de dados e dados de exemplo.

## Requisitos

- Node.js 18+ ou superior
- MySQL ou PostgreSQL
- Navegador moderno para abrir `frontend/index.html`

## Instalação

### 1. Preparar o backend

```powershell
cd backend
npm install
```

### 2. Configurar variáveis de ambiente

Copie o arquivo de exemplo e edite os valores conforme seu banco:

```powershell
copy .env.postgres.example .env
```

Abra `.env` e ajuste os valores:

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

Para MySQL, use:

```env
DB_CLIENT=mysql
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=pata_feliz_v2
DB_PORT=3306
PORT=3000
```

### 3. Criar o banco de dados

#### PostgreSQL

```powershell
createdb pata_feliz_v2
psql -d pata_feliz_v2 -f backend/database/schema-v2-postgres.sql
psql -d pata_feliz_v2 -f backend/database/seed-v2-postgres.sql
```

#### MySQL

Crie o banco e execute o script:

```sql
CREATE DATABASE pata_feliz_v2;
```

Em seguida, importe `backend/database/schema-v2.sql` no MySQL.

> Observação: o arquivo de seed com dados fictícios existe atualmente para PostgreSQL em `backend/database/seed-v2-postgres.sql`.

## Dados de exemplo já incluídos

Os dados fictícios do seed PostgreSQL incluem usuários de teste com a senha padrão abaixo.

- Administrador: `admin@patafeliz.local`
- Veterinaria: `ana.ribeiro@patafeliz.local`
- Veterinario: `bruno.nascimento@patafeliz.local`
- Veterinaria: `carla.menezes@patafeliz.local`
- Cliente: `mariana.costa@email.local`
- Cliente: `rafael.almeida@email.local`
- Cliente: `beatriz.souza@email.local`
- Cliente: `carlos.pereira@email.local`
- Cliente: `juliana.martins@email.local`

Senha de todos os usuários de teste: `123456`

## Rodando o sistema

### Backend

```powershell
cd backend
npm start
```

A API ficará disponível em `http://localhost:3000`.

### Frontend

Você pode abrir `frontend/index.html` diretamente no navegador ou usar um servidor estático.

Exemplo com Python:

```powershell
cd frontend
python -m http.server 5500
```

Depois acesse `http://localhost:5500`.

## Observações

- Não faça commit do arquivo `backend/.env`.
- O backend suporta tanto MySQL quanto PostgreSQL.
- O arquivo `backend/database/schema-v2-postgres.sql` contém o schema completo para PostgreSQL, incluindo tipos e views úteis.
- O seed de dados fictícios já contém usuários, clientes, animais, atendimentos, prontuários e lembretes.
