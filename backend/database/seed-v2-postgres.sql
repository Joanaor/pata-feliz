-- PataFeliz - dados ficticios para PostgreSQL
-- Senha padrao de todos os usuarios ficticios: 123456

BEGIN;

-- =========================
-- Usuarios
-- =========================

INSERT INTO usuarios (nome, email, cpf, senha_hash, tipo_usuario)
VALUES
  ('Admin PataFeliz', 'admin@patafeliz.local', '000.000.000-00', '$2b$10$t19mjK3UdgprKkpuXYp0aOHR0fu9n6CNdXUWAoM3X82lVKMyFjzlC', 'admin'),
  ('Dra. Ana Ribeiro', 'ana.ribeiro@patafeliz.local', '111.111.111-11', '$2b$10$t19mjK3UdgprKkpuXYp0aOHR0fu9n6CNdXUWAoM3X82lVKMyFjzlC', 'veterinario'),
  ('Dr. Bruno Nascimento', 'bruno.nascimento@patafeliz.local', '222.222.222-22', '$2b$10$t19mjK3UdgprKkpuXYp0aOHR0fu9n6CNdXUWAoM3X82lVKMyFjzlC', 'veterinario'),
  ('Dra. Carla Menezes', 'carla.menezes@patafeliz.local', '333.333.333-33', '$2b$10$t19mjK3UdgprKkpuXYp0aOHR0fu9n6CNdXUWAoM3X82lVKMyFjzlC', 'veterinario'),
  ('Mariana Costa', 'mariana.costa@email.local', '123.456.789-10', '$2b$10$t19mjK3UdgprKkpuXYp0aOHR0fu9n6CNdXUWAoM3X82lVKMyFjzlC', 'cliente'),
  ('Rafael Almeida', 'rafael.almeida@email.local', '234.567.891-01', '$2b$10$t19mjK3UdgprKkpuXYp0aOHR0fu9n6CNdXUWAoM3X82lVKMyFjzlC', 'cliente'),
  ('Beatriz Souza', 'beatriz.souza@email.local', '345.678.912-02', '$2b$10$t19mjK3UdgprKkpuXYp0aOHR0fu9n6CNdXUWAoM3X82lVKMyFjzlC', 'cliente'),
  ('Carlos Pereira', 'carlos.pereira@email.local', '456.789.123-03', '$2b$10$t19mjK3UdgprKkpuXYp0aOHR0fu9n6CNdXUWAoM3X82lVKMyFjzlC', 'cliente'),
  ('Juliana Martins', 'juliana.martins@email.local', '567.891.234-04', '$2b$10$t19mjK3UdgprKkpuXYp0aOHR0fu9n6CNdXUWAoM3X82lVKMyFjzlC', 'cliente')
ON CONFLICT DO NOTHING;

-- =========================
-- Veterinarios
-- =========================

INSERT INTO veterinarios (id_usuario, crmv, especialidade, telefone, carga_horaria_semanal)
SELECT u.id_usuario, v.crmv, v.especialidade, v.telefone, v.carga_horaria_semanal
FROM (
  VALUES
    ('ana.ribeiro@patafeliz.local', 'CRMV-SP 12001', 'Clinica geral e vacinas', '(11) 90000-1001', 40),
    ('bruno.nascimento@patafeliz.local', 'CRMV-SP 12002', 'Felinos e dermatologia', '(11) 90000-1002', 36),
    ('carla.menezes@patafeliz.local', 'CRMV-SP 12003', 'Cirurgia e ortopedia', '(11) 90000-1003', 32)
) AS v(email, crmv, especialidade, telefone, carga_horaria_semanal)
JOIN usuarios u ON u.email = v.email
ON CONFLICT DO NOTHING;

-- =========================
-- Clientes
-- =========================

INSERT INTO clientes (
  id_usuario,
  telefone,
  telefone_secundario,
  rua,
  numero,
  bairro,
  cidade,
  estado,
  cep,
  observacoes
)
SELECT u.id_usuario, c.telefone, c.telefone_secundario, c.rua, c.numero, c.bairro, c.cidade, c.estado, c.cep, c.observacoes
FROM (
  VALUES
    ('mariana.costa@email.local', '(11) 98888-1001', NULL, 'Rua das Acacias', '120', 'Centro', 'Sao Paulo', 'SP', '01010-000', 'Prefere contato pela manha.'),
    ('rafael.almeida@email.local', '(11) 98888-1002', '(11) 97777-1002', 'Av. Brasil', '450', 'Jardins', 'Sao Paulo', 'SP', '01430-000', 'Tutor trabalha em horario comercial.'),
    ('beatriz.souza@email.local', '(11) 98888-1003', NULL, 'Rua Aurora', '88', 'Vila Mariana', 'Sao Paulo', 'SP', '04100-000', 'Tem disponibilidade aos sabados.'),
    ('carlos.pereira@email.local', '(11) 98888-1004', NULL, 'Rua Ipe', '35', 'Mooca', 'Sao Paulo', 'SP', '03110-000', 'Animal idoso em acompanhamento.'),
    ('juliana.martins@email.local', '(11) 98888-1005', '(11) 97777-1005', 'Rua Harmonia', '210', 'Pinheiros', 'Sao Paulo', 'SP', '05435-000', 'Cliente cadastrada pelo portal.')
) AS c(email, telefone, telefone_secundario, rua, numero, bairro, cidade, estado, cep, observacoes)
JOIN usuarios u ON u.email = c.email
ON CONFLICT DO NOTHING;

-- =========================
-- Animais
-- =========================

INSERT INTO animais (id_cliente, nome, especie, raca, cor, sexo, data_nascimento, peso_kg, castrado, alergias, observacoes)
SELECT c.id_cliente, a.nome, a.especie::especie_animal, a.raca, a.cor, a.sexo::sexo_animal, a.data_nascimento::date, a.peso_kg, a.castrado, a.alergias, a.observacoes
FROM (
  VALUES
    ('mariana.costa@email.local', 'Luna', 'gato', 'SRD', 'Cinza e branca', 'femea', '2024-02-15', 4.20, TRUE, NULL, 'Gata tranquila, assusta com barulho alto.'),
    ('mariana.costa@email.local', 'Thor', 'cao', 'Golden Retriever', 'Dourado', 'macho', '2021-07-08', 31.50, TRUE, 'Alergia leve a frango.', 'Precisa controlar peso.'),
    ('rafael.almeida@email.local', 'Nina', 'cao', 'Shih-tzu', 'Branca e marrom', 'femea', '2022-11-20', 6.80, FALSE, NULL, 'Historico de otite.'),
    ('beatriz.souza@email.local', 'Mel', 'gato', 'Siamês', 'Creme', 'femea', '2023-04-03', 3.90, FALSE, NULL, 'Vacinas em atualizacao.'),
    ('carlos.pereira@email.local', 'Bob', 'cao', 'Poodle', 'Branco', 'macho', '2013-09-12', 8.40, TRUE, NULL, 'Animal idoso, acompanhar coracao.'),
    ('juliana.martins@email.local', 'Amora', 'gato', 'SRD', 'Preta', 'femea', '2025-01-18', 2.80, FALSE, NULL, 'Primeiro ciclo de vacinas felinas.'),
    ('juliana.martins@email.local', 'Simba', 'gato', 'Maine Coon', 'Marrom rajado', 'macho', '2020-06-30', 7.20, TRUE, NULL, 'Animal grande, docil.')
) AS a(email_tutor, nome, especie, raca, cor, sexo, data_nascimento, peso_kg, castrado, alergias, observacoes)
JOIN usuarios u ON u.email = a.email_tutor
JOIN clientes c ON c.id_usuario = u.id_usuario
WHERE NOT EXISTS (
  SELECT 1
  FROM animais an
  WHERE an.id_cliente = c.id_cliente
    AND an.nome = a.nome
);

-- =========================
-- Disponibilidade semanal
-- =========================

INSERT INTO disponibilidade_veterinarios (id_veterinario, dia_semana, hora_inicio, hora_fim)
SELECT v.id_veterinario, d.dia_semana, d.hora_inicio::time, d.hora_fim::time
FROM (
  VALUES
    ('ana.ribeiro@patafeliz.local', 1, '08:00', '12:00'),
    ('ana.ribeiro@patafeliz.local', 3, '08:00', '12:00'),
    ('ana.ribeiro@patafeliz.local', 5, '13:00', '17:00'),
    ('bruno.nascimento@patafeliz.local', 2, '09:00', '13:00'),
    ('bruno.nascimento@patafeliz.local', 4, '09:00', '13:00'),
    ('bruno.nascimento@patafeliz.local', 6, '09:00', '12:00'),
    ('carla.menezes@patafeliz.local', 1, '13:00', '18:00'),
    ('carla.menezes@patafeliz.local', 3, '13:00', '18:00'),
    ('carla.menezes@patafeliz.local', 5, '08:00', '12:00')
) AS d(email_vet, dia_semana, hora_inicio, hora_fim)
JOIN usuarios u ON u.email = d.email_vet
JOIN veterinarios v ON v.id_usuario = u.id_usuario
WHERE NOT EXISTS (
  SELECT 1
  FROM disponibilidade_veterinarios dv
  WHERE dv.id_veterinario = v.id_veterinario
    AND dv.dia_semana = d.dia_semana
    AND dv.hora_inicio = d.hora_inicio::time
    AND dv.hora_fim = d.hora_fim::time
);

-- =========================
-- Atendimentos
-- =========================

WITH dados AS (
  SELECT *
  FROM (
    VALUES
      ('Thor', 'ana.ribeiro@patafeliz.local', 'Vacina antirrabica', '2026-04-22 09:00:00-03', '2026-04-22 10:00:00-03', 'finalizado', 'admin', 90.00, 0.00, 'Reforco anual realizado.'),
      ('Amora', 'bruno.nascimento@patafeliz.local', 'Vacina multipla felina', '2026-05-15 10:00:00-03', '2026-05-15 11:00:00-03', 'finalizado', 'admin', 130.00, 0.00, 'Primeira dose V5.'),
      ('Simba', 'bruno.nascimento@patafeliz.local', 'Consulta simples', '2026-05-20 11:00:00-03', '2026-05-20 12:00:00-03', 'finalizado', 'admin', 120.00, 35.00, 'Consulta dermatologica com medicacao.'),
      ('Thor', 'ana.ribeiro@patafeliz.local', 'Consulta simples', '2026-06-09 09:00:00-03', '2026-06-09 10:00:00-03', 'confirmado', 'cliente', 120.00, 0.00, 'Avaliacao de peso e alimentacao.'),
      ('Luna', 'bruno.nascimento@patafeliz.local', 'Vacina multipla felina', '2026-06-09 10:00:00-03', '2026-06-09 11:00:00-03', 'aguardando_confirmacao', 'cliente', 130.00, 0.00, 'Reforco felino solicitado pelo tutor.'),
      ('Nina', 'carla.menezes@patafeliz.local', 'Cirurgia simples', '2026-06-09 14:00:00-03', '2026-06-09 18:00:00-03', 'confirmado', 'admin', 600.00, 0.00, 'Procedimento agendado com jejum.'),
      ('Mel', 'ana.ribeiro@patafeliz.local', 'Vacina antirrabica', '2026-06-10 08:00:00-03', '2026-06-10 09:00:00-03', 'confirmado', 'cliente', 90.00, 0.00, 'Primeira vacina antirrabica na clinica.'),
      ('Bob', 'bruno.nascimento@patafeliz.local', 'Consulta simples', '2026-06-10 11:00:00-03', '2026-06-10 12:00:00-03', 'aguardando_confirmacao', 'cliente', 120.00, 0.00, 'Tutor relatou cansaco em caminhadas.'),
      ('Amora', 'carla.menezes@patafeliz.local', 'Vacina multipla felina', '2026-06-12 09:00:00-03', '2026-06-12 10:00:00-03', 'confirmado', 'automatico', 130.00, 0.00, 'Segunda dose pre-agendada.')
  ) AS x(animal, email_vet, procedimento, inicio, fim, status, origem, valor_base, valor_adicional, observacoes)
)
INSERT INTO atendimentos (
  id_animal,
  id_cliente,
  id_veterinario,
  id_procedimento,
  inicio,
  fim,
  status,
  origem,
  observacoes,
  valor_base,
  valor_adicional,
  criado_por
)
SELECT
  an.id_animal,
  an.id_cliente,
  v.id_veterinario,
  p.id_procedimento,
  d.inicio::timestamptz,
  d.fim::timestamptz,
  d.status::status_atendimento,
  d.origem::origem_atendimento,
  d.observacoes,
  d.valor_base::numeric,
  d.valor_adicional::numeric,
  admin.id_usuario
FROM dados d
JOIN animais an ON an.nome = d.animal
JOIN usuarios uv ON uv.email = d.email_vet
JOIN veterinarios v ON v.id_usuario = uv.id_usuario
JOIN procedimentos p ON p.nome = d.procedimento
JOIN usuarios admin ON admin.email = 'admin@patafeliz.local'
WHERE NOT EXISTS (
  SELECT 1
  FROM atendimentos at
  WHERE at.id_animal = an.id_animal
    AND at.id_veterinario = v.id_veterinario
    AND at.inicio = d.inicio::timestamptz
);

-- =========================
-- Prontuarios dos atendimentos finalizados
-- =========================

INSERT INTO prontuarios (
  id_atendimento,
  id_animal,
  id_veterinario,
  diagnostico,
  tratamento,
  prescricao,
  medicacao,
  observacoes_clinicas,
  observacoes_internas,
  visivel_para_cliente
)
SELECT
  at.id_atendimento,
  at.id_animal,
  at.id_veterinario,
  p.diagnostico,
  p.tratamento,
  p.prescricao,
  p.medicacao,
  p.observacoes_clinicas,
  p.observacoes_internas,
  TRUE
FROM (
  VALUES
    ('Thor', '2026-04-22 09:00:00-03', 'Animal em bom estado geral.', 'Vacina antirrabica aplicada sem intercorrencias.', 'Observar reacoes locais por 24h.', 'Vacina antirrabica', 'Sem febre, mucosas normais.', 'Retornar em 1 ano.'),
    ('Amora', '2026-05-15 10:00:00-03', 'Filhote saudavel para inicio de protocolo vacinal.', 'Primeira dose V5 aplicada.', 'Retorno em 3 a 4 semanas para segunda dose.', 'Vacina multipla felina V5', 'Sem sinais respiratorios.', 'Confirmar teste FeLV/FIV no retorno.'),
    ('Simba', '2026-05-20 11:00:00-03', 'Dermatite leve em regiao cervical.', 'Higienizacao local e medicacao topica.', 'Aplicar pomada 2x ao dia por 7 dias.', 'Pomada dermatologica', 'Coceira moderada, sem feridas profundas.', 'Reavaliar se nao melhorar em 10 dias.')
) AS p(animal, inicio, diagnostico, tratamento, prescricao, medicacao, observacoes_clinicas, observacoes_internas)
JOIN animais an ON an.nome = p.animal
JOIN atendimentos at ON at.id_animal = an.id_animal AND at.inicio = p.inicio::timestamptz
ON CONFLICT DO NOTHING;

-- =========================
-- Vacinas aplicadas e proximas doses
-- =========================

INSERT INTO vacinas_aplicadas (
  id_animal,
  id_atendimento,
  id_procedimento,
  id_esquema,
  data_aplicacao,
  proxima_dose_em,
  lote,
  fabricante,
  observacoes
)
SELECT
  an.id_animal,
  at.id_atendimento,
  pr.id_procedimento,
  ev.id_esquema,
  v.data_aplicacao::date,
  v.proxima_dose_em::date,
  v.lote,
  v.fabricante,
  v.observacoes
FROM (
  VALUES
    ('Thor', '2026-04-22 09:00:00-03', 'Vacina antirrabica', 'Raiva anual', '2026-04-22', '2027-04-22', 'RV-2026-001', 'VetSafe', 'Reforco anual.'),
    ('Amora', '2026-05-15 10:00:00-03', 'Vacina multipla felina', 'Multipla felina inicial', '2026-05-15', '2026-06-12', 'VF-2026-044', 'FeliVax', 'Primeira dose.'),
    ('Mel', '2026-06-10 08:00:00-03', 'Vacina antirrabica', 'Raiva anual', '2026-06-10', '2027-06-10', 'RV-2026-002', 'VetSafe', 'Agendada para aplicacao.')
) AS v(animal, inicio, procedimento, esquema, data_aplicacao, proxima_dose_em, lote, fabricante, observacoes)
JOIN animais an ON an.nome = v.animal
JOIN procedimentos pr ON pr.nome = v.procedimento
JOIN esquemas_vacinais ev ON ev.nome = v.esquema
LEFT JOIN atendimentos at ON at.id_animal = an.id_animal AND at.inicio = v.inicio::timestamptz
WHERE NOT EXISTS (
  SELECT 1
  FROM vacinas_aplicadas va
  WHERE va.id_animal = an.id_animal
    AND va.id_procedimento = pr.id_procedimento
    AND va.data_aplicacao = v.data_aplicacao::date
);

-- =========================
-- Pre-agendamento automatico
-- =========================

INSERT INTO pre_agendamentos_automaticos (
  id_atendimento_origem,
  id_atendimento_gerado,
  id_animal,
  id_cliente,
  id_procedimento,
  data_sugerida,
  aceito_pelo_cliente,
  status
)
SELECT
  origem.id_atendimento,
  gerado.id_atendimento,
  an.id_animal,
  an.id_cliente,
  p.id_procedimento,
  '2026-06-12'::date,
  TRUE,
  'agendado'
FROM animais an
JOIN procedimentos p ON p.nome = 'Vacina multipla felina'
JOIN atendimentos origem ON origem.id_animal = an.id_animal AND origem.inicio = '2026-05-15 10:00:00-03'::timestamptz
JOIN atendimentos gerado ON gerado.id_animal = an.id_animal AND gerado.inicio = '2026-06-12 09:00:00-03'::timestamptz
WHERE an.nome = 'Amora'
  AND NOT EXISTS (
    SELECT 1
    FROM pre_agendamentos_automaticos pa
    WHERE pa.id_atendimento_origem = origem.id_atendimento
      AND pa.data_sugerida = '2026-06-12'::date
  );

-- =========================
-- Lembretes para painel administrativo
-- =========================

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
SELECT an.id_animal, an.id_cliente, at.id_atendimento, l.tipo::tipo_lembrete, l.titulo, l.descricao, l.data_prevista::date, l.prioridade::prioridade_lembrete, 'pendente', admin.id_usuario
FROM (
  VALUES
    ('Thor', '2026-06-09 09:00:00-03', 'consulta_proxima', 'Confirmar consulta do Thor', 'Ligar para Mariana um dia antes da consulta.', '2026-06-08', 'media'),
    ('Nina', '2026-06-09 14:00:00-03', 'consulta_proxima', 'Confirmar cirurgia da Nina', 'Reforcar jejum e horario de chegada.', '2026-06-08', 'alta'),
    ('Bob', '2026-06-10 11:00:00-03', 'animal_sem_atendimento', 'Bob precisa de avaliacao geriatrica', 'Animal idoso com relato de cansaco. Priorizar contato.', '2026-06-08', 'alta'),
    ('Amora', '2026-06-12 09:00:00-03', 'retorno_pendente', 'Segunda dose da Amora', 'Consulta criada a partir do pre-agendamento automatico.', '2026-06-10', 'media')
) AS l(animal, inicio, tipo, titulo, descricao, data_prevista, prioridade)
JOIN animais an ON an.nome = l.animal
LEFT JOIN atendimentos at ON at.id_animal = an.id_animal AND at.inicio = l.inicio::timestamptz
JOIN usuarios admin ON admin.email = 'admin@patafeliz.local'
WHERE NOT EXISTS (
  SELECT 1
  FROM lembretes le
  WHERE le.titulo = l.titulo
    AND le.data_prevista = l.data_prevista::date
);

COMMIT;
