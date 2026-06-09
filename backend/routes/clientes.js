const express = require("express");
const router = express.Router();
const db = require("../db");

// SELECT - listar todos os clientes
router.get("/", async (req, res) => {
  try {
    const [clientes] = await db.query(`
      SELECT 
        id_cliente,
        nome,
        cpf,
        rua,
        numero,
        bairro,
        cidade,
        ativo
      FROM cliente
      ORDER BY nome
    `);

    res.json(clientes);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao listar clientes",
      detalhes: error.message
    });
  }
});

// SELECT - buscar cliente por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [cliente] = await db.query(
      "SELECT * FROM cliente WHERE id_cliente = ?",
      [id]
    );

    if (cliente.length === 0) {
      return res.status(404).json({ erro: "Cliente não encontrado" });
    }

    const [telefones] = await db.query(
      "SELECT * FROM telefonecliente WHERE id_cliente = ?",
      [id]
    );

    const [emails] = await db.query(
      "SELECT * FROM emailcliente WHERE id_cliente = ?",
      [id]
    );

    res.json({
      ...cliente[0],
      telefones,
      emails
    });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao buscar cliente",
      detalhes: error.message
    });
  }
});

// INSERT com TRANSAÇÃO - cadastrar cliente + telefone + email
router.post("/", async (req, res) => {
  const {
    nome,
    cpf,
    rua,
    numero,
    bairro,
    cidade,
    telefone,
    email
  } = req.body;

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [resultadoCliente] = await conn.query(
      `INSERT INTO cliente 
       (nome, cpf, rua, numero, bairro, cidade)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nome, cpf, rua, numero, bairro, cidade]
    );

    const idCliente = resultadoCliente.insertId;

    if (telefone) {
      await conn.query(
        `INSERT INTO telefonecliente (id_cliente, telefone)
         VALUES (?, ?)`,
        [idCliente, telefone]
      );
    }

    if (email) {
      await conn.query(
        `INSERT INTO emailcliente (id_cliente, email)
         VALUES (?, ?)`,
        [idCliente, email]
      );
    }

    await conn.commit();

    res.status(201).json({
      mensagem: "Cliente cadastrado com sucesso",
      id_cliente: idCliente
    });
  } catch (error) {
    await conn.rollback();

    res.status(500).json({
      erro: "Erro ao cadastrar cliente",
      detalhes: error.message
    });
  } finally {
    conn.release();
  }
});

// UPDATE - atualizar cliente
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nome,
      cpf,
      rua,
      numero,
      bairro,
      cidade,
      ativo
    } = req.body;

    await db.query(
      `UPDATE cliente
       SET nome = ?, cpf = ?, rua = ?, numero = ?, bairro = ?, cidade = ?, ativo = ?
       WHERE id_cliente = ?`,
      [nome, cpf, rua, numero, bairro, cidade, ativo, id]
    );

    res.json({ mensagem: "Cliente atualizado com sucesso" });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao atualizar cliente",
      detalhes: error.message
    });
  }
});

// DELETE - excluir cliente
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      "DELETE FROM cliente WHERE id_cliente = ?",
      [id]
    );

    res.json({ mensagem: "Cliente excluído com sucesso" });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao excluir cliente",
      detalhes: error.message
    });
  }
});

module.exports = router;