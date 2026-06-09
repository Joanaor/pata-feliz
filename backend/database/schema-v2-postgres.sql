-- PataFeliz - schema v2 para PostgreSQL
-- Objetivo: suportar portal de administradores, veterinarios e tutores,
-- agenda com bloqueio real de horario, prontuarios, vacinas, precos e alertas.
--
-- Requisitos recomendados: PostgreSQL 14+
-- Execute dentro do banco desejado, por exemplo: pata_feliz_v2.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$ BEGIN
  CREATE TYPE tipo_usuario AS ENUM ('admin', 'veterinario', 'cliente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE especie_animal AS ENUM ('cao', 'gato', 'ave', 'roedor', 'reptil', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sexo_animal AS ENUM ('macho', 'femea', 'indefinido');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_procedimento AS ENUM ('consulta', 'vacina', 'cirurgia', 'exame', 'retorno', 'medicacao', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_atendimento AS ENUM (
    'aguardando_confirmacao',
    'confirmado',
    'cancelado',
    'realizado',
    'finalizado',
    'nao_compareceu'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE origem_atendimento AS ENUM ('admin', 'veterinario', 'cliente', 'automatico');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE especie_esquema AS ENUM ('cao', 'gato', 'ambos');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_remarcacao AS ENUM ('pendente', 'aprovada', 'recusada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_pre_agendamento AS ENUM ('sugerido', 'aceito', 'agendado', 'recusado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_lembrete AS ENUM (
    'consulta_proxima',
    'vacina_vencendo',
    'vacina_vencida',
    'animal_sem_atendimento',
    'retorno_pendente',
    'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE prioridade_lembrete AS ENUM ('baixa', 'media', 'alta');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_lembrete AS ENUM ('pendente', 'em_contato', 'resolvido', 'ignorado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE canal_contato AS ENUM ('telefone', 'email', 'whatsapp_manual', 'presencial', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE resultado_contato AS ENUM ('sem_resposta', 'contatado', 'remarcado', 'cancelado', 'resolvido', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================
-- Identidade e permissoes
-- =========================

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(180),
  cpf VARCHAR(14),
  senha_hash VARCHAR(255) NOT NULL,
  tipo_usuario tipo_usuario NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_login_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_usuarios_email_ou_cpf CHECK (email IS NOT NULL OR cpf IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_email
  ON usuarios (LOWER(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_cpf
  ON usuarios (cpf)
  WHERE cpf IS NOT NULL;

CREATE TABLE IF NOT EXISTS clientes (
  id_cliente BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario BIGINT NOT NULL UNIQUE REFERENCES usuarios(id_usuario),
  telefone VARCHAR(30),
  telefone_secundario VARCHAR(30),
  rua VARCHAR(150),
  numero VARCHAR(20),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  estado CHAR(2),
  cep VARCHAR(12),
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS veterinarios (
  id_veterinario BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario BIGINT NOT NULL UNIQUE REFERENCES usuarios(id_usuario),
  crmv VARCHAR(30) NOT NULL UNIQUE,
  especialidade VARCHAR(120),
  telefone VARCHAR(30),
  carga_horaria_semanal INT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- Animais
-- =========================

CREATE TABLE IF NOT EXISTS animais (
  id_animal BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente BIGINT NOT NULL REFERENCES clientes(id_cliente),
  nome VARCHAR(120) NOT NULL,
  especie especie_animal NOT NULL,
  raca VARCHAR(120),
  cor VARCHAR(80),
  sexo sexo_animal,
  data_nascimento DATE,
  peso_kg NUMERIC(6,2),
  castrado BOOLEAN,
  alergias TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_animais_cliente ON animais (id_cliente);
CREATE INDEX IF NOT EXISTS idx_animais_especie ON animais (especie);

CREATE TABLE IF NOT EXISTS historico_pesos (
  id_peso BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_animal BIGINT NOT NULL REFERENCES animais(id_animal),
  id_veterinario BIGINT REFERENCES veterinarios(id_veterinario),
  peso_kg NUMERIC(6,2) NOT NULL,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historico_pesos_animal_data
  ON historico_pesos (id_animal, registrado_em);

-- =========================
-- Procedimentos e precos
-- =========================

CREATE TABLE IF NOT EXISTS procedimentos (
  id_procedimento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  tipo tipo_procedimento NOT NULL,
  descricao TEXT,
  duracao_padrao_minutos INT NOT NULL CHECK (duracao_padrao_minutos > 0),
  preco_base NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (preco_base >= 0),
  exige_confirmacao BOOLEAN NOT NULL DEFAULT TRUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_procedimentos_tipo ON procedimentos (tipo);
CREATE INDEX IF NOT EXISTS idx_procedimentos_ativo ON procedimentos (ativo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_procedimentos_nome
  ON procedimentos (LOWER(nome));

CREATE TABLE IF NOT EXISTS historico_precos_procedimentos (
  id_historico_preco BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_procedimento BIGINT NOT NULL REFERENCES procedimentos(id_procedimento),
  preco_anterior NUMERIC(10,2),
  preco_novo NUMERIC(10,2) NOT NULL CHECK (preco_novo >= 0),
  alterado_por BIGINT NOT NULL REFERENCES usuarios(id_usuario),
  alterado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  motivo VARCHAR(255)
);

-- =========================
-- Agenda
-- =========================

CREATE TABLE IF NOT EXISTS disponibilidade_veterinarios (
  id_disponibilidade BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_veterinario BIGINT NOT NULL REFERENCES veterinarios(id_veterinario),
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT ck_disponibilidade_horario CHECK (hora_fim > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_disponibilidade_vet_dia
  ON disponibilidade_veterinarios (id_veterinario, dia_semana);

CREATE TABLE IF NOT EXISTS bloqueios_agenda (
  id_bloqueio BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_veterinario BIGINT REFERENCES veterinarios(id_veterinario),
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  motivo VARCHAR(255) NOT NULL,
  criado_por BIGINT NOT NULL REFERENCES usuarios(id_usuario),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  periodo TSTZRANGE GENERATED ALWAYS AS (tstzrange(inicio, fim, '[)')) STORED,
  CONSTRAINT ck_bloqueios_periodo CHECK (fim > inicio)
);

CREATE INDEX IF NOT EXISTS idx_bloqueios_vet_periodo
  ON bloqueios_agenda USING GIST (id_veterinario, periodo);

CREATE TABLE IF NOT EXISTS atendimentos (
  id_atendimento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_animal BIGINT NOT NULL REFERENCES animais(id_animal),
  id_cliente BIGINT NOT NULL REFERENCES clientes(id_cliente),
  id_veterinario BIGINT NOT NULL REFERENCES veterinarios(id_veterinario),
  id_procedimento BIGINT NOT NULL REFERENCES procedimentos(id_procedimento),
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  duracao_real_minutos INT,
  status status_atendimento NOT NULL DEFAULT 'aguardando_confirmacao',
  origem origem_atendimento NOT NULL DEFAULT 'admin',
  motivo_cancelamento TEXT,
  motivo_remarcacao TEXT,
  observacoes TEXT,
  valor_base NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (valor_base >= 0),
  valor_adicional NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (valor_adicional >= 0),
  valor_total NUMERIC(10,2) GENERATED ALWAYS AS (valor_base + valor_adicional) STORED,
  criado_por BIGINT REFERENCES usuarios(id_usuario),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  periodo TSTZRANGE GENERATED ALWAYS AS (tstzrange(inicio, fim, '[)')) STORED,
  CONSTRAINT ck_atendimentos_periodo CHECK (fim > inicio)
);

CREATE INDEX IF NOT EXISTS idx_atendimentos_cliente_status
  ON atendimentos (id_cliente, status);

CREATE INDEX IF NOT EXISTS idx_atendimentos_animal_data
  ON atendimentos (id_animal, inicio);

CREATE INDEX IF NOT EXISTS idx_atendimentos_status_inicio
  ON atendimentos (status, inicio);

CREATE INDEX IF NOT EXISTS idx_atendimentos_vet_periodo
  ON atendimentos USING GIST (id_veterinario, periodo);

ALTER TABLE atendimentos
  DROP CONSTRAINT IF EXISTS ex_atendimentos_sem_choque_veterinario;

ALTER TABLE atendimentos
  ADD CONSTRAINT ex_atendimentos_sem_choque_veterinario
  EXCLUDE USING GIST (
    id_veterinario WITH =,
    periodo WITH &&
  )
  WHERE (status IN ('aguardando_confirmacao', 'confirmado', 'realizado'));

ALTER TABLE bloqueios_agenda
  DROP CONSTRAINT IF EXISTS ex_bloqueios_sem_choque_veterinario;

ALTER TABLE bloqueios_agenda
  ADD CONSTRAINT ex_bloqueios_sem_choque_veterinario
  EXCLUDE USING GIST (
    id_veterinario WITH =,
    periodo WITH &&
  );

CREATE TABLE IF NOT EXISTS solicitacoes_remarcacao (
  id_solicitacao BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_atendimento BIGINT NOT NULL REFERENCES atendimentos(id_atendimento),
  solicitado_por BIGINT NOT NULL REFERENCES usuarios(id_usuario),
  novo_inicio TIMESTAMPTZ,
  novo_fim TIMESTAMPTZ,
  motivo TEXT NOT NULL,
  status status_remarcacao NOT NULL DEFAULT 'pendente',
  respondido_por BIGINT REFERENCES usuarios(id_usuario),
  resposta TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  respondido_em TIMESTAMPTZ,
  CONSTRAINT ck_remarcacao_periodo CHECK (
    novo_inicio IS NULL OR novo_fim IS NULL OR novo_fim > novo_inicio
  )
);

CREATE INDEX IF NOT EXISTS idx_remarcacao_status
  ON solicitacoes_remarcacao (status);

-- =========================
-- Prontuarios
-- =========================

CREATE TABLE IF NOT EXISTS prontuarios (
  id_prontuario BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_atendimento BIGINT NOT NULL UNIQUE REFERENCES atendimentos(id_atendimento),
  id_animal BIGINT NOT NULL REFERENCES animais(id_animal),
  id_veterinario BIGINT NOT NULL REFERENCES veterinarios(id_veterinario),
  diagnostico TEXT,
  tratamento TEXT,
  prescricao TEXT,
  medicacao TEXT,
  observacoes_clinicas TEXT,
  observacoes_internas TEXT,
  visivel_para_cliente BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prontuarios_animal
  ON prontuarios (id_animal, criado_em);

-- =========================
-- Vacinas e retornos automaticos
-- =========================

CREATE TABLE IF NOT EXISTS esquemas_vacinais (
  id_esquema BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  especie especie_esquema NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_esquemas_nome_especie UNIQUE (nome, especie)
);

CREATE TABLE IF NOT EXISTS etapas_esquema_vacinal (
  id_etapa BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_esquema BIGINT NOT NULL REFERENCES esquemas_vacinais(id_esquema),
  id_procedimento BIGINT NOT NULL REFERENCES procedimentos(id_procedimento),
  ordem INT NOT NULL,
  nome_etapa VARCHAR(120) NOT NULL,
  intervalo_dias_apos_anterior INT CHECK (intervalo_dias_apos_anterior IS NULL OR intervalo_dias_apos_anterior > 0),
  repetir_a_cada_dias INT CHECK (repetir_a_cada_dias IS NULL OR repetir_a_cada_dias > 0),
  obrigatoria BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_etapas_ordem UNIQUE (id_esquema, ordem)
);

CREATE TABLE IF NOT EXISTS vacinas_aplicadas (
  id_vacina_aplicada BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_animal BIGINT NOT NULL REFERENCES animais(id_animal),
  id_atendimento BIGINT REFERENCES atendimentos(id_atendimento),
  id_procedimento BIGINT NOT NULL REFERENCES procedimentos(id_procedimento),
  id_esquema BIGINT REFERENCES esquemas_vacinais(id_esquema),
  id_etapa BIGINT REFERENCES etapas_esquema_vacinal(id_etapa),
  data_aplicacao DATE NOT NULL,
  proxima_dose_em DATE,
  lote VARCHAR(80),
  fabricante VARCHAR(120),
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vacinas_animal_data
  ON vacinas_aplicadas (id_animal, data_aplicacao);

CREATE INDEX IF NOT EXISTS idx_vacinas_proxima_dose
  ON vacinas_aplicadas (proxima_dose_em);

CREATE TABLE IF NOT EXISTS pre_agendamentos_automaticos (
  id_pre_agendamento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_atendimento_origem BIGINT NOT NULL REFERENCES atendimentos(id_atendimento),
  id_atendimento_gerado BIGINT REFERENCES atendimentos(id_atendimento),
  id_animal BIGINT NOT NULL REFERENCES animais(id_animal),
  id_cliente BIGINT NOT NULL REFERENCES clientes(id_cliente),
  id_procedimento BIGINT NOT NULL REFERENCES procedimentos(id_procedimento),
  data_sugerida DATE NOT NULL,
  aceito_pelo_cliente BOOLEAN NOT NULL DEFAULT FALSE,
  status status_pre_agendamento NOT NULL DEFAULT 'sugerido',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pre_agendamentos_status_data
  ON pre_agendamentos_automaticos (status, data_sugerida);

-- =========================
-- Lembretes e painel de risco
-- =========================

CREATE TABLE IF NOT EXISTS lembretes (
  id_lembrete BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_animal BIGINT REFERENCES animais(id_animal),
  id_cliente BIGINT REFERENCES clientes(id_cliente),
  id_atendimento BIGINT REFERENCES atendimentos(id_atendimento),
  tipo tipo_lembrete NOT NULL,
  titulo VARCHAR(180) NOT NULL,
  descricao TEXT,
  data_prevista DATE NOT NULL,
  prioridade prioridade_lembrete NOT NULL DEFAULT 'media',
  status status_lembrete NOT NULL DEFAULT 'pendente',
  responsavel_usuario_id BIGINT REFERENCES usuarios(id_usuario),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lembretes_status_data
  ON lembretes (status, data_prevista);

CREATE INDEX IF NOT EXISTS idx_lembretes_tipo_data
  ON lembretes (tipo, data_prevista);

CREATE TABLE IF NOT EXISTS contatos_lembrete (
  id_contato BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_lembrete BIGINT NOT NULL REFERENCES lembretes(id_lembrete),
  realizado_por BIGINT NOT NULL REFERENCES usuarios(id_usuario),
  canal canal_contato NOT NULL,
  resultado resultado_contato NOT NULL,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- Automacao de atualizado_em
-- =========================

CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_atualizado_em ON usuarios;
CREATE TRIGGER trg_usuarios_atualizado_em
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_clientes_atualizado_em ON clientes;
CREATE TRIGGER trg_clientes_atualizado_em
BEFORE UPDATE ON clientes
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_veterinarios_atualizado_em ON veterinarios;
CREATE TRIGGER trg_veterinarios_atualizado_em
BEFORE UPDATE ON veterinarios
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_animais_atualizado_em ON animais;
CREATE TRIGGER trg_animais_atualizado_em
BEFORE UPDATE ON animais
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_procedimentos_atualizado_em ON procedimentos;
CREATE TRIGGER trg_procedimentos_atualizado_em
BEFORE UPDATE ON procedimentos
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_atendimentos_atualizado_em ON atendimentos;
CREATE TRIGGER trg_atendimentos_atualizado_em
BEFORE UPDATE ON atendimentos
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_prontuarios_atualizado_em ON prontuarios;
CREATE TRIGGER trg_prontuarios_atualizado_em
BEFORE UPDATE ON prontuarios
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_esquemas_atualizado_em ON esquemas_vacinais;
CREATE TRIGGER trg_esquemas_atualizado_em
BEFORE UPDATE ON esquemas_vacinais
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

DROP TRIGGER IF EXISTS trg_lembretes_atualizado_em ON lembretes;
CREATE TRIGGER trg_lembretes_atualizado_em
BEFORE UPDATE ON lembretes
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- =========================
-- Funcoes armazenadas do sistema
-- =========================

CREATE OR REPLACE FUNCTION gerar_lembretes_automaticos()
RETURNS INTEGER AS $$
DECLARE
  v_admin_id BIGINT;
  v_total INTEGER := 0;
  v_count INTEGER := 0;
BEGIN
  SELECT id_usuario
  INTO v_admin_id
  FROM usuarios
  WHERE tipo_usuario = 'admin'
  ORDER BY id_usuario
  LIMIT 1;

  INSERT INTO lembretes (
    id_animal,
    id_cliente,
    id_atendimento,
    tipo,
    titulo,
    descricao,
    data_prevista,
    prioridade,
    status,
    responsavel_usuario_id
  )
  SELECT
    at.id_animal,
    at.id_cliente,
    at.id_atendimento,
    'consulta_proxima'::tipo_lembrete,
    'Confirmar consulta de ' || an.nome,
    'Entrar em contato com o tutor para lembrar do atendimento em ' || to_char(at.inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '.',
    (at.inicio AT TIME ZONE 'America/Sao_Paulo')::date - 1,
    CASE
      WHEN p.tipo = 'cirurgia' THEN 'alta'::prioridade_lembrete
      ELSE 'media'::prioridade_lembrete
    END,
    'pendente'::status_lembrete,
    v_admin_id
  FROM atendimentos at
  JOIN animais an ON an.id_animal = at.id_animal
  JOIN procedimentos p ON p.id_procedimento = at.id_procedimento
  WHERE at.status IN ('aguardando_confirmacao', 'confirmado')
    AND at.inicio >= NOW()
    AND at.inicio <= NOW() + INTERVAL '14 days'
    AND NOT EXISTS (
      SELECT 1
      FROM lembretes l
      WHERE l.tipo = 'consulta_proxima'
        AND l.id_atendimento = at.id_atendimento
        AND l.titulo LIKE 'Confirmar%'
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  INSERT INTO lembretes (
    id_animal,
    id_cliente,
    id_atendimento,
    tipo,
    titulo,
    descricao,
    data_prevista,
    prioridade,
    status,
    responsavel_usuario_id
  )
  SELECT
    at.id_animal,
    at.id_cliente,
    at.id_atendimento,
    'consulta_proxima'::tipo_lembrete,
    'Consulta: ' || p.nome,
    'Atendimento de ' || an.nome || ' em ' || to_char(at.inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '.',
    (at.inicio AT TIME ZONE 'America/Sao_Paulo')::date - 1,
    'media'::prioridade_lembrete,
    'pendente'::status_lembrete,
    NULL
  FROM atendimentos at
  JOIN animais an ON an.id_animal = at.id_animal
  JOIN procedimentos p ON p.id_procedimento = at.id_procedimento
  WHERE at.status IN ('aguardando_confirmacao', 'confirmado')
    AND at.inicio >= NOW()
    AND at.inicio <= NOW() + INTERVAL '14 days'
    AND NOT EXISTS (
      SELECT 1
      FROM lembretes l
      WHERE l.tipo = 'consulta_proxima'
        AND l.id_atendimento = at.id_atendimento
        AND l.titulo NOT LIKE 'Confirmar%'
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  INSERT INTO lembretes (
    id_animal,
    id_cliente,
    tipo,
    titulo,
    descricao,
    data_prevista,
    prioridade,
    status,
    responsavel_usuario_id
  )
  SELECT
    va.id_animal,
    an.id_cliente,
    CASE
      WHEN va.proxima_dose_em < CURRENT_DATE THEN 'vacina_vencida'::tipo_lembrete
      ELSE 'vacina_vencendo'::tipo_lembrete
    END,
    CASE
      WHEN va.proxima_dose_em < CURRENT_DATE THEN 'Vacina vencida de ' || an.nome
      ELSE 'Vacina vencendo de ' || an.nome
    END,
    'Proxima dose prevista para ' || to_char(va.proxima_dose_em, 'DD/MM/YYYY') || '.',
    va.proxima_dose_em,
    CASE
      WHEN va.proxima_dose_em < CURRENT_DATE THEN 'alta'::prioridade_lembrete
      ELSE 'media'::prioridade_lembrete
    END,
    'pendente'::status_lembrete,
    v_admin_id
  FROM vacinas_aplicadas va
  JOIN animais an ON an.id_animal = va.id_animal
  WHERE va.proxima_dose_em IS NOT NULL
    AND va.proxima_dose_em <= CURRENT_DATE + INTERVAL '30 days'
    AND NOT EXISTS (
      SELECT 1
      FROM lembretes l
      WHERE l.id_animal = va.id_animal
        AND l.data_prevista = va.proxima_dose_em
        AND l.tipo IN ('vacina_vencendo', 'vacina_vencida')
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  INSERT INTO lembretes (
    id_animal,
    id_cliente,
    tipo,
    titulo,
    descricao,
    data_prevista,
    prioridade,
    status,
    responsavel_usuario_id
  )
  SELECT
    an.id_animal,
    an.id_cliente,
    'animal_sem_atendimento'::tipo_lembrete,
    an.nome || ' esta sem atendimento recente',
    'Animal sem atendimento finalizado nos ultimos 12 meses. Avaliar contato com o tutor.',
    CURRENT_DATE,
    CASE
      WHEN an.data_nascimento IS NOT NULL AND an.data_nascimento <= CURRENT_DATE - INTERVAL '8 years' THEN 'alta'::prioridade_lembrete
      ELSE 'media'::prioridade_lembrete
    END,
    'pendente'::status_lembrete,
    v_admin_id
  FROM animais an
  LEFT JOIN atendimentos at
    ON at.id_animal = an.id_animal
    AND at.status IN ('realizado', 'finalizado')
  WHERE an.ativo = TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM atendimentos futuro
      WHERE futuro.id_animal = an.id_animal
        AND futuro.status IN ('aguardando_confirmacao', 'confirmado', 'realizado')
        AND futuro.inicio >= NOW()
    )
  GROUP BY an.id_animal, an.id_cliente, an.nome, an.data_nascimento
  HAVING COALESCE(MAX(at.inicio), TIMESTAMPTZ '1900-01-01') < NOW() - INTERVAL '12 months'
    AND NOT EXISTS (
      SELECT 1
      FROM lembretes l
      WHERE l.id_animal = an.id_animal
        AND l.tipo = 'animal_sem_atendimento'
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE lembretes
  SET tipo = 'vacina_vencida',
      prioridade = 'alta',
      titulo = REPLACE(titulo, 'Vacina vencendo', 'Vacina vencida')
  WHERE tipo = 'vacina_vencendo'
    AND data_prevista < CURRENT_DATE
    AND status = 'pendente';

  RETURN v_total;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION buscar_historico_animal(p_id_animal BIGINT)
RETURNS TABLE (
  id_atendimento BIGINT,
  animal TEXT,
  tutor TEXT,
  veterinario TEXT,
  procedimento TEXT,
  status status_atendimento,
  inicio TIMESTAMPTZ,
  fim TIMESTAMPTZ,
  valor_base NUMERIC(10,2),
  valor_adicional NUMERIC(10,2),
  valor_total NUMERIC(10,2),
  diagnostico TEXT,
  tratamento TEXT,
  prescricao TEXT,
  medicacao TEXT,
  observacoes_clinicas TEXT,
  visivel_para_cliente BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    at.id_atendimento,
    an.nome::TEXT AS animal,
    uc.nome::TEXT AS tutor,
    uv.nome::TEXT AS veterinario,
    pr.nome::TEXT AS procedimento,
    at.status,
    at.inicio,
    at.fim,
    at.valor_base,
    at.valor_adicional,
    at.valor_total,
    po.diagnostico,
    po.tratamento,
    po.prescricao,
    po.medicacao,
    po.observacoes_clinicas,
    COALESCE(po.visivel_para_cliente, TRUE) AS visivel_para_cliente
  FROM atendimentos at
  JOIN animais an ON an.id_animal = at.id_animal
  JOIN clientes c ON c.id_cliente = at.id_cliente
  JOIN usuarios uc ON uc.id_usuario = c.id_usuario
  JOIN veterinarios v ON v.id_veterinario = at.id_veterinario
  JOIN usuarios uv ON uv.id_usuario = v.id_usuario
  JOIN procedimentos pr ON pr.id_procedimento = at.id_procedimento
  LEFT JOIN prontuarios po ON po.id_atendimento = at.id_atendimento
  WHERE at.id_animal = p_id_animal
  ORDER BY at.inicio DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION disparar_geracao_lembretes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM gerar_lembretes_automaticos();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atendimentos_gerar_lembretes ON atendimentos;
CREATE TRIGGER trg_atendimentos_gerar_lembretes
AFTER INSERT OR UPDATE OF inicio, fim, status, id_animal, id_cliente, id_procedimento
ON atendimentos
FOR EACH STATEMENT EXECUTE FUNCTION disparar_geracao_lembretes();

DROP TRIGGER IF EXISTS trg_vacinas_gerar_lembretes ON vacinas_aplicadas;
CREATE TRIGGER trg_vacinas_gerar_lembretes
AFTER INSERT OR UPDATE OF proxima_dose_em, id_animal
ON vacinas_aplicadas
FOR EACH STATEMENT EXECUTE FUNCTION disparar_geracao_lembretes();

-- =========================
-- Views uteis para o backend
-- =========================

CREATE OR REPLACE VIEW vw_agenda_atendimentos AS
SELECT
  at.id_atendimento,
  at.inicio,
  at.fim,
  at.status,
  at.origem,
  at.valor_base,
  at.valor_adicional,
  at.valor_total,
  an.id_animal,
  an.nome AS animal,
  an.especie,
  c.id_cliente,
  uc.nome AS tutor,
  uc.email AS email_tutor,
  c.telefone AS telefone_tutor,
  v.id_veterinario,
  uv.nome AS veterinario,
  p.id_procedimento,
  p.nome AS procedimento,
  p.tipo AS tipo_procedimento,
  p.duracao_padrao_minutos
FROM atendimentos at
JOIN animais an ON an.id_animal = at.id_animal
JOIN clientes c ON c.id_cliente = at.id_cliente
JOIN usuarios uc ON uc.id_usuario = c.id_usuario
JOIN veterinarios v ON v.id_veterinario = at.id_veterinario
JOIN usuarios uv ON uv.id_usuario = v.id_usuario
JOIN procedimentos p ON p.id_procedimento = at.id_procedimento;

CREATE OR REPLACE VIEW vw_animais_alerta AS
SELECT
  an.id_animal,
  an.nome AS animal,
  an.especie,
  an.data_nascimento,
  c.id_cliente,
  uc.nome AS tutor,
  c.telefone,
  MAX(at.inicio) AS ultimo_atendimento,
  MAX(va.proxima_dose_em) AS proxima_vacina
FROM animais an
JOIN clientes c ON c.id_cliente = an.id_cliente
JOIN usuarios uc ON uc.id_usuario = c.id_usuario
LEFT JOIN atendimentos at
  ON at.id_animal = an.id_animal
  AND at.status IN ('realizado', 'finalizado')
LEFT JOIN vacinas_aplicadas va
  ON va.id_animal = an.id_animal
WHERE an.ativo = TRUE
GROUP BY an.id_animal, an.nome, an.especie, an.data_nascimento, c.id_cliente, uc.nome, c.telefone;

-- =========================
-- Seeds iniciais opcionais
-- =========================

INSERT INTO procedimentos (nome, tipo, descricao, duracao_padrao_minutos, preco_base)
VALUES
  ('Consulta simples', 'consulta', 'Consulta clinica geral.', 60, 120.00),
  ('Vacina antirrabica', 'vacina', 'Vacina contra raiva.', 60, 90.00),
  ('Vacina multipla canina', 'vacina', 'V8/V10 ou equivalente, conforme protocolo da clinica.', 60, 120.00),
  ('Vacina multipla felina', 'vacina', 'V4/V5 ou equivalente, conforme protocolo da clinica.', 60, 130.00),
  ('Cirurgia simples', 'cirurgia', 'Procedimento cirurgico de baixa complexidade.', 240, 600.00),
  ('Cirurgia complexa', 'cirurgia', 'Procedimento cirurgico de maior complexidade.', 300, 1200.00)
ON CONFLICT DO NOTHING;

INSERT INTO esquemas_vacinais (nome, especie, descricao)
VALUES
  ('Raiva anual', 'ambos', 'Sugere reforco anual conforme protocolo/localidade.'),
  ('Multipla canina inicial', 'cao', 'Serie inicial com doses em intervalo configuravel e reforco posterior.'),
  ('Multipla felina inicial', 'gato', 'Serie inicial com doses em intervalo configuravel e reforco posterior.'),
  ('FeLV inicial', 'gato', 'Duas doses iniciais com intervalo de 3 a 4 semanas e reforco conforme risco.')
ON CONFLICT DO NOTHING;
