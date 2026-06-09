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
