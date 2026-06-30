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

function validateSchedule(date, time, durationMinutes) {
  if (!date || !time) {
    return "Informe data e hora do atendimento";
  }

  const start = new Date(`${date}T${time}:00-03:00`);
  const end = new Date(start.getTime() + Number(durationMinutes || 0) * 60000);
  const now = new Date();

  if (Number.isNaN(start.getTime())) {
    return "Data ou hora invalida";
  }

  if (start <= now) {
    return "Nao e permitido marcar consultas no passado";
  }

  const maxDate = new Date(now);
  maxDate.setFullYear(maxDate.getFullYear() + 1);

  if (start > maxDate) {
    return "Nao e permitido marcar consultas com mais de 1 ano de antecedencia";
  }

  const day = start.getDay();
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const sameDay = start.toLocaleDateString("pt-BR") === end.toLocaleDateString("pt-BR");

  if (day >= 1 && day <= 5) {
    if (!sameDay || startMinutes < 8 * 60 || endMinutes > 18 * 60) {
      return "Consultas podem ser marcadas de segunda a sexta, das 08:00 as 18:00";
    }

    return null;
  }

  if (day === 6) {
    if (!sameDay || startMinutes < 8 * 60 || endMinutes > 12 * 60) {
      return "Consultas podem ser marcadas aos sabados, das 08:00 as 12:00";
    }

    return null;
  }

  return "Nao e permitido marcar consultas aos domingos";
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

async function hasScheduleBlock(idVeterinario, inicio, durationMinutes) {
  const [rows] = await db.query(
    `
      SELECT 1
      FROM bloqueios_agenda b
      WHERE (b.id_veterinario IS NULL OR b.id_veterinario = ?)
        AND b.periodo && tstzrange(?::timestamptz, ?::timestamptz + (?::int * INTERVAL '1 minute'), '[)')
      LIMIT 1
    `,
    [idVeterinario, inicio, inicio, durationMinutes]
  );

  return rows.length > 0;
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
  await db.query("SELECT gerar_lembretes_automaticos() AS lembretes_criados");
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
    const [rows] = await db.query("SELECT * FROM listar_clientes()");
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
    const [rows] = await db.query(
      "SELECT * FROM listar_animais(?::tipo_usuario, ?::bigint)",
      [req.user.tipo_usuario, req.user.id_cliente || null]
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

router.get("/bloqueios-agenda", auth, allow("admin"), async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        b.id_bloqueio,
        b.id_veterinario,
        b.inicio,
        b.fim,
        b.motivo,
        b.criado_em,
        uv.nome AS veterinario,
        uc.nome AS criado_por_nome
      FROM bloqueios_agenda b
      LEFT JOIN veterinarios v ON v.id_veterinario = b.id_veterinario
      LEFT JOIN usuarios uv ON uv.id_usuario = v.id_usuario
      JOIN usuarios uc ON uc.id_usuario = b.criado_por
      ORDER BY b.inicio DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao listar bloqueios", detalhes: error.message });
  }
});

router.post("/bloqueios-agenda", auth, allow("admin"), async (req, res) => {
  try {
    const inicio = parseLocalDateTime(req.body.data_inicio, req.body.hora_inicio);
    const fim = parseLocalDateTime(req.body.data_fim || req.body.data_inicio, req.body.hora_fim);

    const [periodo] = await db.query(
      "SELECT (?::timestamptz > NOW()) AS futuro, (?::timestamptz > ?::timestamptz) AS valido",
      [inicio, fim, inicio]
    );

    if (!periodo[0].futuro) {
      return res.status(400).json({ erro: "Nao e permitido criar bloqueio no passado" });
    }

    if (!periodo[0].valido) {
      return res.status(400).json({ erro: "Fim do bloqueio deve ser depois do inicio" });
    }

    const [rows] = await db.query(
      `
        INSERT INTO bloqueios_agenda (id_veterinario, inicio, fim, motivo, criado_por)
        VALUES (?, ?::timestamptz, ?::timestamptz, ?, ?)
        RETURNING id_bloqueio
      `,
      [
        req.body.id_veterinario || null,
        inicio,
        fim,
        req.body.motivo,
        req.user.id_usuario
      ]
    );

    res.status(201).json({ id_bloqueio: rows[0].id_bloqueio });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao criar bloqueio", detalhes: error.message });
  }
});

router.delete("/bloqueios-agenda/:id", auth, allow("admin"), async (req, res) => {
  try {
    await db.query("DELETE FROM bloqueios_agenda WHERE id_bloqueio = ?", [req.params.id]);
    res.json({ mensagem: "Bloqueio excluido" });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao excluir bloqueio", detalhes: error.message });
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
    const [rows] = await db.query(
      "SELECT * FROM listar_atendimentos(?::tipo_usuario, ?::bigint, ?::bigint)",
      [req.user.tipo_usuario, req.user.id_cliente || null, req.user.id_veterinario || null]
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

    const scheduleError = validateSchedule(req.body.data, req.body.hora, procedimento.duracao_padrao_minutos);
    if (scheduleError) {
      return res.status(400).json({ erro: scheduleError });
    }

    const inicio = parseLocalDateTime(req.body.data, req.body.hora);

    if (await hasScheduleBlock(req.body.id_veterinario, inicio, procedimento.duracao_padrao_minutos)) {
      return res.status(409).json({ erro: "Agenda bloqueada para este periodo" });
    }

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
    const [rows] = await db.query(
      "SELECT * FROM listar_prontuarios(?::tipo_usuario, ?::bigint, ?::bigint)",
      [req.user.tipo_usuario, req.user.id_cliente || null, req.user.id_veterinario || null]
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

    const [rows] = await db.query(
      "SELECT * FROM listar_lembretes(?::tipo_usuario, ?::bigint, ?::bigint)",
      [req.user.tipo_usuario, req.user.id_cliente || null, req.user.id_veterinario || null]
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
      "CALL atualizar_status_lembrete(?::bigint, ?::status_lembrete, ?::bigint)",
      [req.params.id, req.body.status, req.user.id_usuario]
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

router.get("/relatorios/historico-animal/:id", auth, allow("admin", "veterinario", "cliente"), async (req, res) => {
  try {
    const animal = await getAnimal(req.params.id);
    if (!animal) {
      return res.status(404).json({ erro: "Animal nao encontrado" });
    }

    if (req.user.tipo_usuario === "cliente" && Number(animal.id_cliente) !== Number(req.user.id_cliente)) {
      return res.status(403).json({ erro: "Acesso negado" });
    }

    if (req.user.tipo_usuario === "veterinario") {
      const [rows] = await db.query(
        "SELECT 1 FROM atendimentos WHERE id_animal = ? AND id_veterinario = ? LIMIT 1",
        [req.params.id, req.user.id_veterinario]
      );

      if (!rows.length) {
        return res.status(403).json({ erro: "Acesso negado" });
      }
    }

    const [historico] = await db.query(
      "SELECT * FROM buscar_historico_animal(?)",
      [req.params.id]
    );

    const visibleRows = req.user.tipo_usuario === "cliente"
      ? historico.filter(item => item.visivel_para_cliente)
      : historico;

    res.json(visibleRows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao carregar historico do animal", detalhes: error.message });
  }
});

router.get("/relatorios/servicos", auth, allow("admin", "veterinario"), async (_req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM relatorio_servicos()");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao carregar relatorio", detalhes: error.message });
  }
});

router.get("/relatorios/veterinarios", auth, allow("admin"), async (_req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM relatorio_veterinarios()");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao carregar relatorio", detalhes: error.message });
  }
});

module.exports = router;
