const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "pata-feliz-dev-secret";

function signUser(user) {
  return jwt.sign(
    {
      id_usuario: user.id_usuario,
      nome: user.nome,
      email: user.email,
      tipo_usuario: user.tipo_usuario,
      id_cliente: user.id_cliente || null,
      id_veterinario: user.id_veterinario || null
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: "Login necessario" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: "Sessao invalida ou expirada" });
  }
}

function allow(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.tipo_usuario)) {
      return res.status(403).json({ erro: "Acesso negado" });
    }

    next();
  };
}

async function getUserByEmailOrCpf(login) {
  const [rows] = await db.query(
    `
      SELECT
        u.id_usuario,
        u.nome,
        u.email,
        u.cpf,
        u.senha_hash,
        u.tipo_usuario,
        c.id_cliente,
        v.id_veterinario
      FROM usuarios u
      LEFT JOIN clientes c ON c.id_usuario = u.id_usuario
      LEFT JOIN veterinarios v ON v.id_usuario = u.id_usuario
      WHERE u.ativo = true
        AND (LOWER(u.email) = LOWER(?) OR u.cpf = ?)
      LIMIT 1
    `,
    [login, login]
  );

  return rows[0];
}

function dateOnly(value) {
  return String(value || "").slice(0, 10);
}

function parseLocalDateTime(date, time) {
  return `${date} ${time}:00-03`;
}

async function getProcedure(id) {
  const [rows] = await db.query(
    "SELECT * FROM procedimentos WHERE id_procedimento = ?",
    [id]
  );

  return rows[0];
}

async function getAnimal(id) {
  const [rows] = await db.query(
    "SELECT * FROM animais WHERE id_animal = ?",
    [id]
  );

  return rows[0];
}

async function ensureClientOwnsAnimal(user, idAnimal) {
  if (user.tipo_usuario !== "cliente") return true;

  const [rows] = await db.query(
    "SELECT 1 FROM animais WHERE id_animal = ? AND id_cliente = ?",
    [idAnimal, user.id_cliente]
  );

  return rows.length > 0;
}

async function generateAutomaticReminders() {
  const [adminRows] = await db.query(
    "SELECT id_usuario FROM usuarios WHERE tipo_usuario = 'admin' ORDER BY id_usuario LIMIT 1"
  );
  const adminId = adminRows[0]?.id_usuario || null;

  await db.query(
    `
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
        ?
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
        )
    `,
    [adminId]
  );

  await db.query(
    `
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
        )
    `
  );

  await db.query(
    `
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
        ?
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
        )
    `,
    [adminId]
  );

  await db.query(
    `
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
        ?
      FROM animais an
      LEFT JOIN atendimentos at
        ON at.id_animal = an.id_animal
        AND at.status IN ('realizado', 'finalizado')
      WHERE an.ativo = true
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
        )
    `,
    [adminId]
  );

  await db.query(
    `
      UPDATE lembretes
      SET tipo = 'vacina_vencida',
          prioridade = 'alta',
          titulo = REPLACE(titulo, 'Vacina vencendo', 'Vacina vencida')
      WHERE tipo = 'vacina_vencendo'
        AND data_prevista < CURRENT_DATE
        AND status = 'pendente'
    `
  );
}

router.post("/auth/login", async (req, res) => {
  try {
    const { login, senha } = req.body;

    if (!login || !senha) {
      return res.status(400).json({ erro: "Informe login e senha" });
    }

    const user = await getUserByEmailOrCpf(login);

    if (!user || !bcrypt.compareSync(senha, user.senha_hash)) {
      return res.status(401).json({ erro: "Login ou senha incorretos" });
    }

    await db.query("UPDATE usuarios SET ultimo_login_em = NOW() WHERE id_usuario = ?", [user.id_usuario]);

    delete user.senha_hash;

    res.json({
      token: signUser(user),
      usuario: user
    });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao fazer login", detalhes: error.message });
  }
});

router.get("/me", auth, async (req, res) => {
  res.json(req.user);
});

router.get("/perfil", auth, async (req, res) => {
  try {
    if (req.user.tipo_usuario === "cliente") {
      const [rows] = await db.query(
        `
          SELECT
            u.id_usuario,
            u.nome,
            u.email,
            u.cpf,
            u.tipo_usuario,
            c.id_cliente,
            c.telefone,
            c.telefone_secundario,
            c.rua,
            c.numero,
            c.bairro,
            c.cidade,
            c.estado,
            c.cep,
            c.observacoes
          FROM usuarios u
          JOIN clientes c ON c.id_usuario = u.id_usuario
          WHERE u.id_usuario = ?
        `,
        [req.user.id_usuario]
      );

      return res.json(rows[0]);
    }

    if (req.user.tipo_usuario === "veterinario") {
      const [rows] = await db.query(
        `
          SELECT
            u.id_usuario,
            u.nome,
            u.email,
            u.cpf,
            u.tipo_usuario,
            v.id_veterinario,
            v.crmv,
            v.especialidade,
            v.telefone,
            v.carga_horaria_semanal
          FROM usuarios u
          JOIN veterinarios v ON v.id_usuario = u.id_usuario
          WHERE u.id_usuario = ?
        `,
        [req.user.id_usuario]
      );

      return res.json(rows[0]);
    }

    const [rows] = await db.query(
      "SELECT id_usuario, nome, email, cpf, tipo_usuario FROM usuarios WHERE id_usuario = ?",
      [req.user.id_usuario]
    );

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao carregar perfil", detalhes: error.message });
  }
});

router.put("/perfil", auth, async (req, res) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      "UPDATE usuarios SET nome = ?, email = ?, cpf = ? WHERE id_usuario = ?",
      [req.body.nome, req.body.email || null, req.body.cpf || null, req.user.id_usuario]
    );

    if (req.user.tipo_usuario === "cliente") {
      await conn.query(
        `
          UPDATE clientes
          SET telefone = ?, telefone_secundario = ?, rua = ?, numero = ?, bairro = ?, cidade = ?, estado = ?, cep = ?
          WHERE id_cliente = ?
        `,
        [
          req.body.telefone || null,
          req.body.telefone_secundario || null,
          req.body.rua || null,
          req.body.numero || null,
          req.body.bairro || null,
          req.body.cidade || null,
          req.body.estado || null,
          req.body.cep || null,
          req.user.id_cliente
        ]
      );
    }

    if (req.user.tipo_usuario === "veterinario") {
      await conn.query(
        `
          UPDATE veterinarios
          SET telefone = ?, especialidade = ?
          WHERE id_veterinario = ?
        `,
        [
          req.body.telefone || null,
          req.body.especialidade || null,
          req.user.id_veterinario
        ]
      );
    }

    await conn.commit();

    const user = await getUserByEmailOrCpf(req.body.email || req.body.cpf);
    delete user.senha_hash;

    res.json({
      mensagem: "Perfil atualizado",
      token: signUser(user),
      usuario: user
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ erro: "Erro ao atualizar perfil", detalhes: error.message });
  } finally {
    conn.release();
  }
});

router.get("/dashboard", auth, async (req, res) => {
  try {
    await generateAutomaticReminders();

    if (req.user.tipo_usuario === "cliente") {
      const [animais] = await db.query(
        "SELECT COUNT(*)::int AS total FROM animais WHERE id_cliente = ? AND ativo = true",
        [req.user.id_cliente]
      );
      const [atendimentos] = await db.query(
        "SELECT COUNT(*)::int AS total FROM atendimentos WHERE id_cliente = ?",
        [req.user.id_cliente]
      );
      const [proximos] = await db.query(
        `
          SELECT *
          FROM vw_agenda_atendimentos
          WHERE id_cliente = ?
            AND inicio >= NOW()
          ORDER BY inicio
          LIMIT 5
        `,
        [req.user.id_cliente]
      );

      return res.json({
        totais: {
          animais: animais[0].total,
          atendimentos: atendimentos[0].total
        },
        proximos
      });
    }

    if (req.user.tipo_usuario === "veterinario") {
      const [hoje] = await db.query(
        `
          SELECT COUNT(*)::int AS total
          FROM atendimentos
          WHERE id_veterinario = ?
            AND inicio::date = CURRENT_DATE
        `,
        [req.user.id_veterinario]
      );
      const [agenda] = await db.query(
        `
          SELECT *
          FROM vw_agenda_atendimentos
          WHERE id_veterinario = ?
            AND inicio >= NOW() - INTERVAL '30 days'
          ORDER BY inicio
          LIMIT 10
        `,
        [req.user.id_veterinario]
      );

      return res.json({
        totais: { atendimentos_hoje: hoje[0].total },
        agenda
      });
    }

    const [totais] = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM clientes) AS clientes,
        (SELECT COUNT(*)::int FROM animais WHERE ativo = true) AS animais,
        (SELECT COUNT(*)::int FROM veterinarios WHERE ativo = true) AS veterinarios,
        (SELECT COUNT(*)::int FROM atendimentos) AS atendimentos,
        (SELECT COUNT(*)::int FROM lembretes WHERE status = 'pendente') AS lembretes
    `);
    const [agenda] = await db.query(`
      SELECT *
      FROM vw_agenda_atendimentos
      WHERE inicio >= NOW() - INTERVAL '30 days'
      ORDER BY inicio
      LIMIT 12
    `);
    const [lembretes] = await db.query(`
      SELECT l.*, an.nome AS animal, u.nome AS tutor
      FROM lembretes l
      LEFT JOIN animais an ON an.id_animal = l.id_animal
      LEFT JOIN clientes c ON c.id_cliente = l.id_cliente
      LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
      WHERE l.status = 'pendente'
      ORDER BY l.data_prevista, l.prioridade DESC
      LIMIT 10
    `);

    res.json({ totais: totais[0], agenda, lembretes });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao carregar dashboard", detalhes: error.message });
  }
});

router.get("/clientes", auth, allow("admin", "veterinario"), async (_req, res) => {
  try {
    const [rows] = await db.query(`
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
      ORDER BY u.nome
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao listar clientes", detalhes: error.message });
  }
});

router.post("/clientes", auth, allow("admin"), async (req, res) => {
  const conn = await db.getConnection();

  try {
    const senhaHash = bcrypt.hashSync(req.body.senha || "123456", 10);

    await conn.beginTransaction();
    const [usuarios] = await conn.query(
      `
        INSERT INTO usuarios (nome, email, cpf, senha_hash, tipo_usuario)
        VALUES (?, ?, ?, ?, 'cliente')
        RETURNING id_usuario
      `,
      [req.body.nome, req.body.email || null, req.body.cpf || null, senhaHash]
    );
    const idUsuario = usuarios[0].id_usuario;
    const [clientes] = await conn.query(
      `
        INSERT INTO clientes (id_usuario, telefone, rua, numero, bairro, cidade, estado, cep, observacoes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id_cliente
      `,
      [
        idUsuario,
        req.body.telefone || null,
        req.body.rua || null,
        req.body.numero || null,
        req.body.bairro || null,
        req.body.cidade || null,
        req.body.estado || null,
        req.body.cep || null,
        req.body.observacoes || null
      ]
    );

    await conn.commit();
    res.status(201).json({ id_cliente: clientes[0].id_cliente });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ erro: "Erro ao cadastrar cliente", detalhes: error.message });
  } finally {
    conn.release();
  }
});

router.put("/clientes/:id", auth, allow("admin"), async (req, res) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [clientes] = await conn.query(
      "SELECT id_usuario FROM clientes WHERE id_cliente = ?",
      [req.params.id]
    );

    if (!clientes.length) {
      await conn.rollback();
      return res.status(404).json({ erro: "Cliente nao encontrado" });
    }

    await conn.query(
      "UPDATE usuarios SET nome = ?, email = ?, cpf = ? WHERE id_usuario = ?",
      [req.body.nome, req.body.email || null, req.body.cpf || null, clientes[0].id_usuario]
    );

    await conn.query(
      `
        UPDATE clientes
        SET telefone = ?, rua = ?, numero = ?, bairro = ?, cidade = ?, estado = ?, cep = ?, observacoes = ?
        WHERE id_cliente = ?
      `,
      [
        req.body.telefone || null,
        req.body.rua || null,
        req.body.numero || null,
        req.body.bairro || null,
        req.body.cidade || null,
        req.body.estado || null,
        req.body.cep || null,
        req.body.observacoes || null,
        req.params.id
      ]
    );

    await conn.commit();
    res.json({ mensagem: "Cliente atualizado" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ erro: "Erro ao atualizar cliente", detalhes: error.message });
  } finally {
    conn.release();
  }
});

router.get("/animais", auth, async (req, res) => {
  try {
    const params = [];
    let where = "WHERE a.ativo = true";

    if (req.user.tipo_usuario === "cliente") {
      where += " AND a.id_cliente = ?";
      params.push(req.user.id_cliente);
    }

    const [rows] = await db.query(
      `
        SELECT
          a.*,
          u.nome AS tutor,
          c.telefone AS telefone_tutor
        FROM animais a
        JOIN clientes c ON c.id_cliente = a.id_cliente
        JOIN usuarios u ON u.id_usuario = c.id_usuario
        ${where}
        ORDER BY a.nome
      `,
      params
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao listar animais", detalhes: error.message });
  }
});

router.post("/animais", auth, async (req, res) => {
  try {
    const idCliente = req.user.tipo_usuario === "cliente" ? req.user.id_cliente : req.body.id_cliente;

    if (!idCliente) {
      return res.status(400).json({ erro: "Tutor obrigatorio" });
    }

    const [rows] = await db.query(
      `
        INSERT INTO animais
          (id_cliente, nome, especie, raca, cor, sexo, data_nascimento, peso_kg, castrado, alergias, observacoes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id_animal
      `,
      [
        idCliente,
        req.body.nome,
        req.body.especie || "outro",
        req.body.raca || null,
        req.body.cor || null,
        req.body.sexo || "indefinido",
        req.body.data_nascimento || null,
        req.body.peso_kg || null,
        req.body.castrado ?? null,
        req.body.alergias || null,
        req.body.observacoes || null
      ]
    );

    res.status(201).json({ id_animal: rows[0].id_animal });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao cadastrar animal", detalhes: error.message });
  }
});

router.put("/animais/:id", auth, async (req, res) => {
  try {
    const ok = await ensureClientOwnsAnimal(req.user, req.params.id);
    if (!ok) return res.status(403).json({ erro: "Acesso negado ao animal" });

    await db.query(
      `
        UPDATE animais
        SET nome = ?, especie = ?, raca = ?, cor = ?, sexo = ?, data_nascimento = ?,
            peso_kg = ?, castrado = ?, alergias = ?, observacoes = ?
        WHERE id_animal = ?
      `,
      [
        req.body.nome,
        req.body.especie || "outro",
        req.body.raca || null,
        req.body.cor || null,
        req.body.sexo || "indefinido",
        req.body.data_nascimento || null,
        req.body.peso_kg || null,
        req.body.castrado ?? null,
        req.body.alergias || null,
        req.body.observacoes || null,
        req.params.id
      ]
    );

    res.json({ mensagem: "Animal atualizado" });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao atualizar animal", detalhes: error.message });
  }
});

router.get("/veterinarios", auth, async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        v.id_veterinario,
        u.nome,
        u.email,
        v.crmv,
        v.especialidade,
        v.telefone,
        v.carga_horaria_semanal,
        v.ativo
      FROM veterinarios v
      JOIN usuarios u ON u.id_usuario = v.id_usuario
      WHERE v.ativo = true
      ORDER BY u.nome
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao listar veterinarios", detalhes: error.message });
  }
});

router.put("/veterinarios/:id", auth, allow("admin"), async (req, res) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [vets] = await conn.query(
      "SELECT id_usuario FROM veterinarios WHERE id_veterinario = ?",
      [req.params.id]
    );

    if (!vets.length) {
      await conn.rollback();
      return res.status(404).json({ erro: "Veterinario nao encontrado" });
    }

    await conn.query(
      "UPDATE usuarios SET nome = ?, email = ? WHERE id_usuario = ?",
      [req.body.nome, req.body.email || null, vets[0].id_usuario]
    );

    await conn.query(
      `
        UPDATE veterinarios
        SET crmv = ?, especialidade = ?, telefone = ?, carga_horaria_semanal = ?, ativo = ?
        WHERE id_veterinario = ?
      `,
      [
        req.body.crmv,
        req.body.especialidade || null,
        req.body.telefone || null,
        req.body.carga_horaria_semanal || null,
        req.body.ativo ?? true,
        req.params.id
      ]
    );

    await conn.commit();
    res.json({ mensagem: "Veterinario atualizado" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ erro: "Erro ao atualizar veterinario", detalhes: error.message });
  } finally {
    conn.release();
  }
});

router.get("/procedimentos", auth, async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM procedimentos
      WHERE ativo = true
      ORDER BY tipo, nome
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao listar procedimentos", detalhes: error.message });
  }
});

router.post("/procedimentos", auth, allow("admin"), async (req, res) => {
  try {
    const [rows] = await db.query(
      `
        INSERT INTO procedimentos (nome, tipo, descricao, duracao_padrao_minutos, preco_base, exige_confirmacao)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id_procedimento
      `,
      [
        req.body.nome,
        req.body.tipo || "outro",
        req.body.descricao || null,
        Number(req.body.duracao_padrao_minutos || 60),
        Number(req.body.preco_base || 0),
        req.body.exige_confirmacao ?? true
      ]
    );
    res.status(201).json({ id_procedimento: rows[0].id_procedimento });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao cadastrar procedimento", detalhes: error.message });
  }
});

router.put("/procedimentos/:id", auth, allow("admin"), async (req, res) => {
  try {
    await db.query(
      `
        UPDATE procedimentos
        SET nome = ?, tipo = ?, descricao = ?, duracao_padrao_minutos = ?, preco_base = ?, exige_confirmacao = ?
        WHERE id_procedimento = ?
      `,
      [
        req.body.nome,
        req.body.tipo || "outro",
        req.body.descricao || null,
        Number(req.body.duracao_padrao_minutos || 60),
        Number(req.body.preco_base || 0),
        req.body.exige_confirmacao ?? true,
        req.params.id
      ]
    );
    res.json({ mensagem: "Procedimento atualizado" });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao atualizar procedimento", detalhes: error.message });
  }
});

router.get("/atendimentos", auth, async (req, res) => {
  try {
    const params = [];
    let where = "WHERE 1 = 1";

    if (req.user.tipo_usuario === "cliente") {
      where += " AND id_cliente = ?";
      params.push(req.user.id_cliente);
    }

    if (req.user.tipo_usuario === "veterinario") {
      where += " AND id_veterinario = ?";
      params.push(req.user.id_veterinario);
    }

    const [rows] = await db.query(
      `
        SELECT *
        FROM vw_agenda_atendimentos
        ${where}
        ORDER BY inicio
      `,
      params
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao listar atendimentos", detalhes: error.message });
  }
});

router.post("/atendimentos", auth, async (req, res) => {
  try {
    const animal = await getAnimal(req.body.id_animal);
    const procedimento = await getProcedure(req.body.id_procedimento);

    if (!animal || !procedimento) {
      return res.status(400).json({ erro: "Animal ou procedimento invalido" });
    }

    const ok = await ensureClientOwnsAnimal(req.user, req.body.id_animal);
    if (!ok) return res.status(403).json({ erro: "Acesso negado ao animal" });

    const inicio = parseLocalDateTime(req.body.data, req.body.hora);
    const [rows] = await db.query(
      `
        INSERT INTO atendimentos
          (id_animal, id_cliente, id_veterinario, id_procedimento, inicio, fim, status, origem, observacoes, valor_base, criado_por)
        VALUES (
          ?, ?, ?, ?, ?::timestamptz,
          ?::timestamptz + (?::int * INTERVAL '1 minute'),
          ?, ?, ?, ?, ?
        )
        RETURNING id_atendimento
      `,
      [
        animal.id_animal,
        animal.id_cliente,
        req.body.id_veterinario,
        procedimento.id_procedimento,
        inicio,
        inicio,
        procedimento.duracao_padrao_minutos,
        req.user.tipo_usuario === "cliente" ? "aguardando_confirmacao" : (req.body.status || "confirmado"),
        req.user.tipo_usuario,
        req.body.observacoes || null,
        procedimento.preco_base,
        req.user.id_usuario
      ]
    );

    await generateAutomaticReminders();

    res.status(201).json({ id_atendimento: rows[0].id_atendimento });
  } catch (error) {
    const isConflict = error.message.includes("ex_atendimentos_sem_choque");
    res.status(isConflict ? 409 : 500).json({
      erro: isConflict ? "Horario indisponivel para este veterinario" : "Erro ao criar atendimento",
      detalhes: error.message
    });
  }
});

router.patch("/atendimentos/:id/status", auth, async (req, res) => {
  try {
    const [currentRows] = await db.query("SELECT * FROM atendimentos WHERE id_atendimento = ?", [req.params.id]);
    const atendimento = currentRows[0];

    if (!atendimento) return res.status(404).json({ erro: "Atendimento nao encontrado" });

    if (req.user.tipo_usuario === "cliente") {
      if (atendimento.id_cliente !== req.user.id_cliente) {
        return res.status(403).json({ erro: "Acesso negado" });
      }

      const [check] = await db.query(
        "SELECT (?::timestamptz - NOW()) >= INTERVAL '24 hours' AS permitido",
        [atendimento.inicio]
      );

      if (!check[0].permitido) {
        return res.status(400).json({ erro: "Cancelamento permitido apenas ate 24h antes" });
      }

      await db.query(
        "UPDATE atendimentos SET status = 'cancelado', motivo_cancelamento = ? WHERE id_atendimento = ?",
        [req.body.motivo || "Cancelado pelo tutor", req.params.id]
      );
      return res.json({ mensagem: "Atendimento cancelado" });
    }

    if (req.user.tipo_usuario === "veterinario" && atendimento.id_veterinario !== req.user.id_veterinario) {
      return res.status(403).json({ erro: "Acesso negado" });
    }

    await db.query(
      "UPDATE atendimentos SET status = ?, motivo_cancelamento = COALESCE(?, motivo_cancelamento) WHERE id_atendimento = ?",
      [req.body.status, req.body.motivo || null, req.params.id]
    );

    res.json({ mensagem: "Status atualizado" });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao atualizar status", detalhes: error.message });
  }
});

router.patch("/atendimentos/:id/valores", auth, allow("admin", "veterinario"), async (req, res) => {
  try {
    const [currentRows] = await db.query("SELECT * FROM atendimentos WHERE id_atendimento = ?", [req.params.id]);
    const atendimento = currentRows[0];

    if (!atendimento) return res.status(404).json({ erro: "Atendimento nao encontrado" });

    if (req.user.tipo_usuario === "veterinario" && atendimento.id_veterinario !== req.user.id_veterinario) {
      return res.status(403).json({ erro: "Acesso negado" });
    }

    await db.query(
      `
        UPDATE atendimentos
        SET valor_adicional = ?, observacoes = COALESCE(?, observacoes)
        WHERE id_atendimento = ?
      `,
      [
        Number(req.body.valor_adicional || 0),
        req.body.observacoes || null,
        req.params.id
      ]
    );

    res.json({ mensagem: "Valores do atendimento atualizados" });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao atualizar valores", detalhes: error.message });
  }
});

router.get("/prontuarios", auth, async (req, res) => {
  try {
    const params = [];
    let where = "WHERE 1 = 1";

    if (req.user.tipo_usuario === "cliente") {
      where += " AND at.id_cliente = ? AND p.visivel_para_cliente = true";
      params.push(req.user.id_cliente);
    }

    if (req.user.tipo_usuario === "veterinario") {
      where += " AND p.id_veterinario = ?";
      params.push(req.user.id_veterinario);
    }

    const [rows] = await db.query(
      `
        SELECT
          p.*,
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
        ${where}
        ORDER BY p.criado_em DESC
      `,
      params
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao listar prontuarios", detalhes: error.message });
  }
});

router.post("/prontuarios", auth, allow("admin", "veterinario"), async (req, res) => {
  try {
    const [ats] = await db.query("SELECT * FROM atendimentos WHERE id_atendimento = ?", [req.body.id_atendimento]);
    const atendimento = ats[0];

    if (!atendimento) return res.status(404).json({ erro: "Atendimento nao encontrado" });

    if (req.user.tipo_usuario === "veterinario" && atendimento.id_veterinario !== req.user.id_veterinario) {
      return res.status(403).json({ erro: "Acesso negado" });
    }

    const [rows] = await db.query(
      `
        INSERT INTO prontuarios
          (id_atendimento, id_animal, id_veterinario, diagnostico, tratamento, prescricao, medicacao, observacoes_clinicas, observacoes_internas, visivel_para_cliente)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id_atendimento)
        DO UPDATE SET
          diagnostico = EXCLUDED.diagnostico,
          tratamento = EXCLUDED.tratamento,
          prescricao = EXCLUDED.prescricao,
          medicacao = EXCLUDED.medicacao,
          observacoes_clinicas = EXCLUDED.observacoes_clinicas,
          observacoes_internas = EXCLUDED.observacoes_internas,
          visivel_para_cliente = EXCLUDED.visivel_para_cliente
        RETURNING id_prontuario
      `,
      [
        atendimento.id_atendimento,
        atendimento.id_animal,
        atendimento.id_veterinario,
        req.body.diagnostico || null,
        req.body.tratamento || null,
        req.body.prescricao || null,
        req.body.medicacao || null,
        req.body.observacoes_clinicas || null,
        req.body.observacoes_internas || null,
        req.body.visivel_para_cliente ?? true
      ]
    );

    await db.query("UPDATE atendimentos SET status = 'finalizado' WHERE id_atendimento = ?", [atendimento.id_atendimento]);
    res.status(201).json({ id_prontuario: rows[0].id_prontuario });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao salvar prontuario", detalhes: error.message });
  }
});

router.get("/lembretes", auth, allow("admin", "veterinario", "cliente"), async (req, res) => {
  try {
    await generateAutomaticReminders();

    const params = [];
    let where = "";

    if (req.user.tipo_usuario === "veterinario") {
      where = `
        WHERE EXISTS (
          SELECT 1
          FROM atendimentos at
          WHERE at.id_atendimento = l.id_atendimento
            AND at.id_veterinario = ?
        )
      `;
      params.push(req.user.id_veterinario);
    }

    if (req.user.tipo_usuario === "cliente") {
      where = `
        WHERE l.id_cliente = ?
          AND NOT (l.tipo = 'consulta_proxima' AND l.titulo LIKE 'Confirmar%')
      `;
      params.push(req.user.id_cliente);
    }

    const [rows] = await db.query(
      `
        SELECT l.*, an.nome AS animal, u.nome AS tutor, c.telefone
        FROM lembretes l
        LEFT JOIN animais an ON an.id_animal = l.id_animal
        LEFT JOIN clientes c ON c.id_cliente = l.id_cliente
        LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
        ${where}
        ORDER BY l.status, l.data_prevista
      `,
      params
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao listar lembretes", detalhes: error.message });
  }
});

router.patch("/lembretes/:id/status", auth, allow("admin", "veterinario"), async (req, res) => {
  try {
    const allowed = ["pendente", "em_contato", "resolvido", "ignorado"];
    if (!allowed.includes(req.body.status)) {
      return res.status(400).json({ erro: "Status invalido" });
    }

    await db.query(
      "UPDATE lembretes SET status = ?, responsavel_usuario_id = ? WHERE id_lembrete = ?",
      [req.body.status, req.user.id_usuario, req.params.id]
    );

    res.json({ mensagem: "Lembrete atualizado" });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao atualizar lembrete", detalhes: error.message });
  }
});

router.delete("/lembretes/:id", auth, allow("admin", "veterinario", "cliente"), async (req, res) => {
  try {
    if (req.user.tipo_usuario === "cliente") {
      const [rows] = await db.query(
        "SELECT 1 FROM lembretes WHERE id_lembrete = ? AND id_cliente = ?",
        [req.params.id, req.user.id_cliente]
      );

      if (!rows.length) {
        return res.status(403).json({ erro: "Acesso negado" });
      }
    }

    await db.query(
      "DELETE FROM lembretes WHERE id_lembrete = ?",
      [req.params.id]
    );

    res.json({ mensagem: "Lembrete excluido" });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao excluir lembrete", detalhes: error.message });
  }
});

router.get("/relatorios/servicos", auth, allow("admin", "veterinario"), async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT procedimento AS servico, COUNT(*)::int AS total
      FROM vw_agenda_atendimentos
      GROUP BY procedimento
      ORDER BY total DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao carregar relatorio", detalhes: error.message });
  }
});

router.get("/relatorios/veterinarios", auth, allow("admin"), async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT veterinario, COUNT(*)::int AS total
      FROM vw_agenda_atendimentos
      GROUP BY veterinario
      ORDER BY total DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao carregar relatorio", detalhes: error.message });
  }
});

module.exports = router;
