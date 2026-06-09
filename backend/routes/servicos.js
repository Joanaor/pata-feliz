const express = require("express");
const router = express.Router();
const db = require("../db");

// SELECT
router.get("/", async (req, res) => {
  try {
    const [servicos] = await db.query(`
      SELECT *
      FROM servico
      ORDER BY descricao
    `);

    res.json(servicos);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao listar serviços",
      detalhes: error.message
    });
  }
});

// SELECT por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [servico] = await db.query(
      "SELECT * FROM servico WHERE id_servico = ?",
      [id]
    );

    if (servico.length === 0) {
      return res.status(404).json({ erro: "Serviço não encontrado" });
    }

    res.json(servico[0]);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao buscar serviço",
      detalhes: error.message
    });
  }
});

// INSERT
router.post("/", async (req, res) => {
  try {
    const {
      descricao,
      valor,
      tempo_medio
    } = req.body;

    const [resultado] = await db.query(
      `INSERT INTO servico 
       (descricao, valor, tempo_medio)
       VALUES (?, ?, ?)`,
      [descricao, valor, tempo_medio]
    );

    res.status(201).json({
      mensagem: "Serviço cadastrado com sucesso",
      id_servico: resultado.insertId
    });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao cadastrar serviço",
      detalhes: error.message
    });
  }
});

// UPDATE
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      descricao,
      valor,
      tempo_medio,
      ativo
    } = req.body;

    await db.query(
      `UPDATE servico
       SET descricao = ?, valor = ?, tempo_medio = ?, ativo = ?
       WHERE id_servico = ?`,
      [descricao, valor, tempo_medio, ativo, id]
    );

    res.json({ mensagem: "Serviço atualizado com sucesso" });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao atualizar serviço",
      detalhes: error.message
    });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      "DELETE FROM servico WHERE id_servico = ?",
      [id]
    );

    res.json({ mensagem: "Serviço excluído com sucesso" });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao excluir serviço",
      detalhes: error.message
    });
  }
});

module.exports = router;