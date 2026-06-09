-- PataFeliz - schema v2
-- Objetivo: suportar portal de administradores, veterinarios e tutores,
-- agenda com bloqueio de horario, prontuarios, vacinas, precos e alertas.
--
-- Banco alvo atual: MySQL 8+
-- Observacao: este arquivo cria uma base nova de tabelas v2. Nao execute em
-- producao sem backup e sem planejar migracao dos dados antigos.

CREATE DATABASE IF NOT EXISTS pata_feliz_v2
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pata_feliz_v2;

-- =========================
-- Identidade e permissoes
-- =========================

CREATE TABLE usuarios (
  id_usuario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(180) NULL,
  cpf VARCHAR(14) NULL,
  senha_hash VARCHAR(255) NOT NULL,
  tipo_usuario ENUM('admin', 'veterinario', 'cliente') NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_login_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_usuarios_email UNIQUE (email),
  CONSTRAINT uq_usuarios_cpf UNIQUE (cpf),
  CONSTRAINT ck_usuarios_email_ou_cpf CHECK (email IS NOT NULL OR cpf IS NOT NULL)
);

CREATE TABLE clientes (
  id_cliente BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario BIGINT UNSIGNED NOT NULL,
  telefone VARCHAR(30) NULL,
  telefone_secundario VARCHAR(30) NULL,
  rua VARCHAR(150) NULL,
  numero VARCHAR(20) NULL,
  bairro VARCHAR(100) NULL,
  cidade VARCHAR(100) NULL,
  estado VARCHAR(2) NULL,
  cep VARCHAR(12) NULL,
  observacoes TEXT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_clientes_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  CONSTRAINT uq_clientes_usuario UNIQUE (id_usuario)
);

CREATE TABLE veterinarios (
  id_veterinario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario BIGINT UNSIGNED NOT NULL,
  crmv VARCHAR(30) NOT NULL,
  especialidade VARCHAR(120) NULL,
  telefone VARCHAR(30) NULL,
  carga_horaria_semanal INT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_veterinarios_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  CONSTRAINT uq_veterinarios_usuario UNIQUE (id_usuario),
  CONSTRAINT uq_veterinarios_crmv UNIQUE (crmv)
);

-- =========================
-- Animais
-- =========================

CREATE TABLE animais (
  id_animal BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_cliente BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(120) NOT NULL,
  especie ENUM('cao', 'gato', 'ave', 'roedor', 'reptil', 'outro') NOT NULL,
  raca VARCHAR(120) NULL,
  cor VARCHAR(80) NULL,
  sexo ENUM('macho', 'femea', 'indefinido') NULL,
  data_nascimento DATE NULL,
  peso_kg DECIMAL(6,2) NULL,
  castrado BOOLEAN NULL,
  alergias TEXT NULL,
  observacoes TEXT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_animais_cliente
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
  INDEX idx_animais_cliente (id_cliente),
  INDEX idx_animais_especie (especie)
);

CREATE TABLE historico_pesos (
  id_peso BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_animal BIGINT UNSIGNED NOT NULL,
  id_veterinario BIGINT UNSIGNED NULL,
  peso_kg DECIMAL(6,2) NOT NULL,
  registrado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_historico_pesos_animal
    FOREIGN KEY (id_animal) REFERENCES animais(id_animal),
  CONSTRAINT fk_historico_pesos_veterinario
    FOREIGN KEY (id_veterinario) REFERENCES veterinarios(id_veterinario),
  INDEX idx_historico_pesos_animal_data (id_animal, registrado_em)
);

-- =========================
-- Servicos, procedimentos e precos
-- =========================

CREATE TABLE procedimentos (
  id_procedimento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  tipo ENUM('consulta', 'vacina', 'cirurgia', 'exame', 'retorno', 'medicacao', 'outro') NOT NULL,
  descricao TEXT NULL,
  duracao_padrao_minutos INT NOT NULL,
  preco_base DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  exige_confirmacao BOOLEAN NOT NULL DEFAULT TRUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT ck_procedimentos_duracao CHECK (duracao_padrao_minutos > 0),
  CONSTRAINT ck_procedimentos_preco CHECK (preco_base >= 0),
  INDEX idx_procedimentos_tipo (tipo),
  INDEX idx_procedimentos_ativo (ativo)
);

CREATE TABLE historico_precos_procedimentos (
  id_historico_preco BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_procedimento BIGINT UNSIGNED NOT NULL,
  preco_anterior DECIMAL(10,2) NULL,
  preco_novo DECIMAL(10,2) NOT NULL,
  alterado_por BIGINT UNSIGNED NOT NULL,
  alterado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  motivo VARCHAR(255) NULL,

  CONSTRAINT fk_historico_precos_procedimento
    FOREIGN KEY (id_procedimento) REFERENCES procedimentos(id_procedimento),
  CONSTRAINT fk_historico_precos_usuario
    FOREIGN KEY (alterado_por) REFERENCES usuarios(id_usuario)
);

-- =========================
-- Agenda
-- =========================

CREATE TABLE disponibilidade_veterinarios (
  id_disponibilidade BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_veterinario BIGINT UNSIGNED NOT NULL,
  dia_semana TINYINT NOT NULL, -- 0 domingo, 1 segunda, ... 6 sabado
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT fk_disponibilidade_veterinario
    FOREIGN KEY (id_veterinario) REFERENCES veterinarios(id_veterinario),
  CONSTRAINT ck_disponibilidade_dia CHECK (dia_semana BETWEEN 0 AND 6),
  CONSTRAINT ck_disponibilidade_horario CHECK (hora_fim > hora_inicio),
  INDEX idx_disponibilidade_vet_dia (id_veterinario, dia_semana)
);

CREATE TABLE bloqueios_agenda (
  id_bloqueio BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_veterinario BIGINT UNSIGNED NOT NULL,
  inicio DATETIME NOT NULL,
  fim DATETIME NOT NULL,
  motivo VARCHAR(255) NOT NULL,
  criado_por BIGINT UNSIGNED NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_bloqueios_veterinario
    FOREIGN KEY (id_veterinario) REFERENCES veterinarios(id_veterinario),
  CONSTRAINT fk_bloqueios_usuario
    FOREIGN KEY (criado_por) REFERENCES usuarios(id_usuario),
  CONSTRAINT ck_bloqueios_periodo CHECK (fim > inicio),
  INDEX idx_bloqueios_vet_periodo (id_veterinario, inicio, fim)
);

CREATE TABLE atendimentos (
  id_atendimento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_animal BIGINT UNSIGNED NOT NULL,
  id_cliente BIGINT UNSIGNED NOT NULL,
  id_veterinario BIGINT UNSIGNED NOT NULL,
  id_procedimento BIGINT UNSIGNED NOT NULL,
  inicio DATETIME NOT NULL,
  fim DATETIME NOT NULL,
  duracao_real_minutos INT NULL,
  status ENUM(
    'aguardando_confirmacao',
    'confirmado',
    'cancelado',
    'realizado',
    'finalizado',
    'nao_compareceu'
  ) NOT NULL DEFAULT 'aguardando_confirmacao',
  origem ENUM('admin', 'veterinario', 'cliente', 'automatico') NOT NULL DEFAULT 'admin',
  motivo_cancelamento TEXT NULL,
  motivo_remarcacao TEXT NULL,
  observacoes TEXT NULL,
  valor_base DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  valor_adicional DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  valor_total DECIMAL(10,2) GENERATED ALWAYS AS (valor_base + valor_adicional) STORED,
  criado_por BIGINT UNSIGNED NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_atendimentos_animal
    FOREIGN KEY (id_animal) REFERENCES animais(id_animal),
  CONSTRAINT fk_atendimentos_cliente
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
  CONSTRAINT fk_atendimentos_veterinario
    FOREIGN KEY (id_veterinario) REFERENCES veterinarios(id_veterinario),
  CONSTRAINT fk_atendimentos_procedimento
    FOREIGN KEY (id_procedimento) REFERENCES procedimentos(id_procedimento),
  CONSTRAINT fk_atendimentos_criado_por
    FOREIGN KEY (criado_por) REFERENCES usuarios(id_usuario),
  CONSTRAINT ck_atendimentos_periodo CHECK (fim > inicio),
  CONSTRAINT ck_atendimentos_valores CHECK (valor_base >= 0 AND valor_adicional >= 0),
  INDEX idx_atendimentos_vet_periodo (id_veterinario, inicio, fim),
  INDEX idx_atendimentos_cliente_status (id_cliente, status),
  INDEX idx_atendimentos_animal_data (id_animal, inicio),
  INDEX idx_atendimentos_status_inicio (status, inicio)
);

-- Importante: MySQL nao possui constraint simples para impedir sobreposicao de
-- periodos como o PostgreSQL com EXCLUDE. No backend, use transacao e SELECT
-- FOR UPDATE para bloquear conflitos antes de inserir/alterar atendimentos.

CREATE TABLE solicitacoes_remarcacao (
  id_solicitacao BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_atendimento BIGINT UNSIGNED NOT NULL,
  solicitado_por BIGINT UNSIGNED NOT NULL,
  novo_inicio DATETIME NULL,
  novo_fim DATETIME NULL,
  motivo TEXT NOT NULL,
  status ENUM('pendente', 'aprovada', 'recusada', 'cancelada') NOT NULL DEFAULT 'pendente',
  respondido_por BIGINT UNSIGNED NULL,
  resposta TEXT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  respondido_em DATETIME NULL,

  CONSTRAINT fk_remarcacao_atendimento
    FOREIGN KEY (id_atendimento) REFERENCES atendimentos(id_atendimento),
  CONSTRAINT fk_remarcacao_solicitado_por
    FOREIGN KEY (solicitado_por) REFERENCES usuarios(id_usuario),
  CONSTRAINT fk_remarcacao_respondido_por
    FOREIGN KEY (respondido_por) REFERENCES usuarios(id_usuario),
  INDEX idx_remarcacao_status (status)
);

-- =========================
-- Prontuarios
-- =========================

CREATE TABLE prontuarios (
  id_prontuario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_atendimento BIGINT UNSIGNED NOT NULL,
  id_animal BIGINT UNSIGNED NOT NULL,
  id_veterinario BIGINT UNSIGNED NOT NULL,
  diagnostico TEXT NULL,
  tratamento TEXT NULL,
  prescricao TEXT NULL,
  medicacao TEXT NULL,
  observacoes_clinicas TEXT NULL,
  observacoes_internas TEXT NULL,
  visivel_para_cliente BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_prontuarios_atendimento
    FOREIGN KEY (id_atendimento) REFERENCES atendimentos(id_atendimento),
  CONSTRAINT fk_prontuarios_animal
    FOREIGN KEY (id_animal) REFERENCES animais(id_animal),
  CONSTRAINT fk_prontuarios_veterinario
    FOREIGN KEY (id_veterinario) REFERENCES veterinarios(id_veterinario),
  CONSTRAINT uq_prontuarios_atendimento UNIQUE (id_atendimento),
  INDEX idx_prontuarios_animal (id_animal, criado_em)
);

-- =========================
-- Vacinas e retornos automaticos
-- =========================

CREATE TABLE esquemas_vacinais (
  id_esquema BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  especie ENUM('cao', 'gato', 'ambos') NOT NULL,
  descricao TEXT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_esquemas_nome_especie UNIQUE (nome, especie)
);

CREATE TABLE etapas_esquema_vacinal (
  id_etapa BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_esquema BIGINT UNSIGNED NOT NULL,
  id_procedimento BIGINT UNSIGNED NOT NULL,
  ordem INT NOT NULL,
  nome_etapa VARCHAR(120) NOT NULL,
  intervalo_dias_apos_anterior INT NULL,
  repetir_a_cada_dias INT NULL,
  obrigatoria BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT fk_etapas_esquema
    FOREIGN KEY (id_esquema) REFERENCES esquemas_vacinais(id_esquema),
  CONSTRAINT fk_etapas_procedimento
    FOREIGN KEY (id_procedimento) REFERENCES procedimentos(id_procedimento),
  CONSTRAINT uq_etapas_ordem UNIQUE (id_esquema, ordem),
  CONSTRAINT ck_etapas_intervalos CHECK (
    intervalo_dias_apos_anterior IS NULL OR intervalo_dias_apos_anterior > 0
  ),
  CONSTRAINT ck_etapas_repeticao CHECK (
    repetir_a_cada_dias IS NULL OR repetir_a_cada_dias > 0
  )
);

CREATE TABLE vacinas_aplicadas (
  id_vacina_aplicada BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_animal BIGINT UNSIGNED NOT NULL,
  id_atendimento BIGINT UNSIGNED NULL,
  id_procedimento BIGINT UNSIGNED NOT NULL,
  id_esquema BIGINT UNSIGNED NULL,
  id_etapa BIGINT UNSIGNED NULL,
  data_aplicacao DATE NOT NULL,
  proxima_dose_em DATE NULL,
  lote VARCHAR(80) NULL,
  fabricante VARCHAR(120) NULL,
  observacoes TEXT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_vacinas_animal
    FOREIGN KEY (id_animal) REFERENCES animais(id_animal),
  CONSTRAINT fk_vacinas_atendimento
    FOREIGN KEY (id_atendimento) REFERENCES atendimentos(id_atendimento),
  CONSTRAINT fk_vacinas_procedimento
    FOREIGN KEY (id_procedimento) REFERENCES procedimentos(id_procedimento),
  CONSTRAINT fk_vacinas_esquema
    FOREIGN KEY (id_esquema) REFERENCES esquemas_vacinais(id_esquema),
  CONSTRAINT fk_vacinas_etapa
    FOREIGN KEY (id_etapa) REFERENCES etapas_esquema_vacinal(id_etapa),
  INDEX idx_vacinas_animal_data (id_animal, data_aplicacao),
  INDEX idx_vacinas_proxima_dose (proxima_dose_em)
);

CREATE TABLE pre_agendamentos_automaticos (
  id_pre_agendamento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_atendimento_origem BIGINT UNSIGNED NOT NULL,
  id_atendimento_gerado BIGINT UNSIGNED NULL,
  id_animal BIGINT UNSIGNED NOT NULL,
  id_cliente BIGINT UNSIGNED NOT NULL,
  id_procedimento BIGINT UNSIGNED NOT NULL,
  data_sugerida DATE NOT NULL,
  aceito_pelo_cliente BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('sugerido', 'aceito', 'agendado', 'recusado', 'cancelado') NOT NULL DEFAULT 'sugerido',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_pre_agendamento_origem
    FOREIGN KEY (id_atendimento_origem) REFERENCES atendimentos(id_atendimento),
  CONSTRAINT fk_pre_agendamento_gerado
    FOREIGN KEY (id_atendimento_gerado) REFERENCES atendimentos(id_atendimento),
  CONSTRAINT fk_pre_agendamento_animal
    FOREIGN KEY (id_animal) REFERENCES animais(id_animal),
  CONSTRAINT fk_pre_agendamento_cliente
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
  CONSTRAINT fk_pre_agendamento_procedimento
    FOREIGN KEY (id_procedimento) REFERENCES procedimentos(id_procedimento),
  INDEX idx_pre_agendamentos_status_data (status, data_sugerida)
);

-- =========================
-- Lembretes e painel de risco
-- =========================

CREATE TABLE lembretes (
  id_lembrete BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_animal BIGINT UNSIGNED NULL,
  id_cliente BIGINT UNSIGNED NULL,
  id_atendimento BIGINT UNSIGNED NULL,
  tipo ENUM(
    'consulta_proxima',
    'vacina_vencendo',
    'vacina_vencida',
    'animal_sem_atendimento',
    'retorno_pendente',
    'outro'
  ) NOT NULL,
  titulo VARCHAR(180) NOT NULL,
  descricao TEXT NULL,
  data_prevista DATE NOT NULL,
  prioridade ENUM('baixa', 'media', 'alta') NOT NULL DEFAULT 'media',
  status ENUM('pendente', 'em_contato', 'resolvido', 'ignorado') NOT NULL DEFAULT 'pendente',
  responsavel_usuario_id BIGINT UNSIGNED NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_lembretes_animal
    FOREIGN KEY (id_animal) REFERENCES animais(id_animal),
  CONSTRAINT fk_lembretes_cliente
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
  CONSTRAINT fk_lembretes_atendimento
    FOREIGN KEY (id_atendimento) REFERENCES atendimentos(id_atendimento),
  CONSTRAINT fk_lembretes_responsavel
    FOREIGN KEY (responsavel_usuario_id) REFERENCES usuarios(id_usuario),
  INDEX idx_lembretes_status_data (status, data_prevista),
  INDEX idx_lembretes_tipo_data (tipo, data_prevista)
);

CREATE TABLE contatos_lembrete (
  id_contato BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_lembrete BIGINT UNSIGNED NOT NULL,
  realizado_por BIGINT UNSIGNED NOT NULL,
  canal ENUM('telefone', 'email', 'whatsapp_manual', 'presencial', 'outro') NOT NULL,
  resultado ENUM('sem_resposta', 'contatado', 'remarcado', 'cancelado', 'resolvido', 'outro') NOT NULL,
  observacoes TEXT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_contatos_lembrete
    FOREIGN KEY (id_lembrete) REFERENCES lembretes(id_lembrete),
  CONSTRAINT fk_contatos_usuario
    FOREIGN KEY (realizado_por) REFERENCES usuarios(id_usuario)
);

-- =========================
-- Views uteis para o backend
-- =========================

CREATE VIEW vw_agenda_atendimentos AS
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

CREATE VIEW vw_animais_alerta AS
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
  ('Cirurgia complexa', 'cirurgia', 'Procedimento cirurgico de maior complexidade.', 300, 1200.00);

INSERT INTO esquemas_vacinais (nome, especie, descricao)
VALUES
  ('Raiva anual', 'ambos', 'Sugere reforco anual conforme protocolo/localidade.'),
  ('Multipla canina inicial', 'cao', 'Serie inicial com doses em intervalo configuravel e reforco posterior.'),
  ('Multipla felina inicial', 'gato', 'Serie inicial com doses em intervalo configuravel e reforco posterior.'),
  ('FeLV inicial', 'gato', 'Duas doses iniciais com intervalo de 3 a 4 semanas e reforco conforme risco.');
