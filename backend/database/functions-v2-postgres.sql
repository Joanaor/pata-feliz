-- PataFeliz - funcoes armazenadas usadas pela aplicacao
-- Execute depois do schema principal quando quiser atualizar apenas as functions.

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

CREATE OR REPLACE FUNCTION listar_clientes()
RETURNS TABLE (
  id_cliente BIGINT,
  id_usuario BIGINT,
  nome VARCHAR(150),
  email VARCHAR(180),
  cpf VARCHAR(14),
  telefone VARCHAR(30),
  rua VARCHAR(150),
  numero VARCHAR(20),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  estado CHAR(2),
  total_animais INTEGER
) AS $$
  SELECT
    c.id_cliente,
    u.id_usuario,
    u.nome,
    u.email,
    u.cpf,
    c.telefone,
    c.rua,
    c.numero,
    c.bairro,
    c.cidade,
    c.estado,
    COUNT(a.id_animal)::int AS total_animais
  FROM clientes c
  JOIN usuarios u ON u.id_usuario = c.id_usuario
  LEFT JOIN animais a ON a.id_cliente = c.id_cliente
  GROUP BY c.id_cliente, u.id_usuario
  ORDER BY u.nome;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION listar_animais(
  p_tipo_usuario tipo_usuario,
  p_id_cliente BIGINT DEFAULT NULL
)
RETURNS TABLE (
  id_animal BIGINT,
  id_cliente BIGINT,
  nome VARCHAR(120),
  especie especie_animal,
  raca VARCHAR(120),
  cor VARCHAR(80),
  sexo sexo_animal,
  data_nascimento DATE,
  peso_kg NUMERIC(6,2),
  castrado BOOLEAN,
  alergias TEXT,
  observacoes TEXT,
  ativo BOOLEAN,
  criado_em TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ,
  tutor VARCHAR(150),
  telefone_tutor VARCHAR(30)
) AS $$
  SELECT
    a.id_animal,
    a.id_cliente,
    a.nome,
    a.especie,
    a.raca,
    a.cor,
    a.sexo,
    a.data_nascimento,
    a.peso_kg,
    a.castrado,
    a.alergias,
    a.observacoes,
    a.ativo,
    a.criado_em,
    a.atualizado_em,
    u.nome AS tutor,
    c.telefone AS telefone_tutor
  FROM animais a
  JOIN clientes c ON c.id_cliente = a.id_cliente
  JOIN usuarios u ON u.id_usuario = c.id_usuario
  WHERE a.ativo = TRUE
    AND (p_tipo_usuario <> 'cliente' OR a.id_cliente = p_id_cliente)
  ORDER BY a.nome;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION listar_atendimentos(
  p_tipo_usuario tipo_usuario,
  p_id_cliente BIGINT DEFAULT NULL,
  p_id_veterinario BIGINT DEFAULT NULL
)
RETURNS TABLE (
  id_atendimento BIGINT,
  inicio TIMESTAMPTZ,
  fim TIMESTAMPTZ,
  status status_atendimento,
  origem origem_atendimento,
  valor_base NUMERIC(10,2),
  valor_adicional NUMERIC(10,2),
  valor_total NUMERIC(10,2),
  id_animal BIGINT,
  animal VARCHAR(120),
  especie especie_animal,
  id_cliente BIGINT,
  tutor VARCHAR(150),
  email_tutor VARCHAR(180),
  telefone_tutor VARCHAR(30),
  id_veterinario BIGINT,
  veterinario VARCHAR(150),
  id_procedimento BIGINT,
  procedimento VARCHAR(150),
  tipo_procedimento tipo_procedimento,
  duracao_padrao_minutos INTEGER
) AS $$
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
  JOIN procedimentos p ON p.id_procedimento = at.id_procedimento
  WHERE (p_tipo_usuario <> 'cliente' OR at.id_cliente = p_id_cliente)
    AND (p_tipo_usuario <> 'veterinario' OR at.id_veterinario = p_id_veterinario)
  ORDER BY at.inicio;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION listar_prontuarios(
  p_tipo_usuario tipo_usuario,
  p_id_cliente BIGINT DEFAULT NULL,
  p_id_veterinario BIGINT DEFAULT NULL
)
RETURNS TABLE (
  id_prontuario BIGINT,
  id_atendimento BIGINT,
  id_animal BIGINT,
  id_veterinario BIGINT,
  diagnostico TEXT,
  tratamento TEXT,
  prescricao TEXT,
  medicacao TEXT,
  observacoes_clinicas TEXT,
  observacoes_internas TEXT,
  visivel_para_cliente BOOLEAN,
  criado_em TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ,
  animal VARCHAR(120),
  tutor VARCHAR(150),
  veterinario VARCHAR(150),
  inicio TIMESTAMPTZ,
  procedimento VARCHAR(150)
) AS $$
  SELECT
    p.id_prontuario,
    p.id_atendimento,
    p.id_animal,
    p.id_veterinario,
    p.diagnostico,
    p.tratamento,
    p.prescricao,
    p.medicacao,
    p.observacoes_clinicas,
    p.observacoes_internas,
    p.visivel_para_cliente,
    p.criado_em,
    p.atualizado_em,
    an.nome AS animal,
    ua.nome AS tutor,
    uv.nome AS veterinario,
    at.inicio,
    pr.nome AS procedimento
  FROM prontuarios p
  JOIN atendimentos at ON at.id_atendimento = p.id_atendimento
  JOIN animais an ON an.id_animal = p.id_animal
  JOIN clientes c ON c.id_cliente = at.id_cliente
  JOIN usuarios ua ON ua.id_usuario = c.id_usuario
  JOIN veterinarios v ON v.id_veterinario = p.id_veterinario
  JOIN usuarios uv ON uv.id_usuario = v.id_usuario
  JOIN procedimentos pr ON pr.id_procedimento = at.id_procedimento
  WHERE (p_tipo_usuario <> 'cliente' OR (at.id_cliente = p_id_cliente AND p.visivel_para_cliente = TRUE))
    AND (p_tipo_usuario <> 'veterinario' OR p.id_veterinario = p_id_veterinario)
  ORDER BY p.criado_em DESC;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION listar_lembretes(
  p_tipo_usuario tipo_usuario,
  p_id_cliente BIGINT DEFAULT NULL,
  p_id_veterinario BIGINT DEFAULT NULL
)
RETURNS TABLE (
  id_lembrete BIGINT,
  id_animal BIGINT,
  id_cliente BIGINT,
  id_atendimento BIGINT,
  tipo tipo_lembrete,
  titulo VARCHAR(180),
  descricao TEXT,
  data_prevista DATE,
  prioridade prioridade_lembrete,
  status status_lembrete,
  responsavel_usuario_id BIGINT,
  criado_em TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ,
  animal VARCHAR(120),
  tutor VARCHAR(150),
  telefone VARCHAR(30)
) AS $$
  SELECT
    l.id_lembrete,
    l.id_animal,
    l.id_cliente,
    l.id_atendimento,
    l.tipo,
    l.titulo,
    l.descricao,
    l.data_prevista,
    l.prioridade,
    l.status,
    l.responsavel_usuario_id,
    l.criado_em,
    l.atualizado_em,
    an.nome AS animal,
    u.nome AS tutor,
    c.telefone
  FROM lembretes l
  LEFT JOIN animais an ON an.id_animal = l.id_animal
  LEFT JOIN clientes c ON c.id_cliente = l.id_cliente
  LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
  WHERE (
      p_tipo_usuario = 'admin'
      OR (
        p_tipo_usuario = 'veterinario'
        AND EXISTS (
          SELECT 1
          FROM atendimentos at
          WHERE at.id_atendimento = l.id_atendimento
            AND at.id_veterinario = p_id_veterinario
        )
      )
      OR (
        p_tipo_usuario = 'cliente'
        AND l.id_cliente = p_id_cliente
        AND NOT (l.tipo = 'consulta_proxima' AND l.titulo LIKE 'Confirmar%')
      )
    )
  ORDER BY l.status, l.data_prevista;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION relatorio_servicos()
RETURNS TABLE (
  servico VARCHAR(150),
  total INTEGER
) AS $$
  SELECT p.nome AS servico, COUNT(*)::int AS total
  FROM atendimentos at
  JOIN procedimentos p ON p.id_procedimento = at.id_procedimento
  GROUP BY p.nome
  ORDER BY total DESC;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION relatorio_veterinarios()
RETURNS TABLE (
  veterinario VARCHAR(150),
  total INTEGER
) AS $$
  SELECT u.nome AS veterinario, COUNT(*)::int AS total
  FROM atendimentos at
  JOIN veterinarios v ON v.id_veterinario = at.id_veterinario
  JOIN usuarios u ON u.id_usuario = v.id_usuario
  GROUP BY u.nome
  ORDER BY total DESC;
$$ LANGUAGE sql STABLE;

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
