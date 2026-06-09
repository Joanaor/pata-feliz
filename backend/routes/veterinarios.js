const express = require("express");
const router = express.Router();
const db = require("../db");

// SELECT
router.get("/", async (req, res) => {
  try {
    const [veterinarios] = await db.query(`
      SELECT *
      FROM veterinario
      ORDER BY nome
    `);

    res.json(veterinarios);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao listar veterinários",
      detalhes: error.message
    });
  }
});

// SELECT por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [veterinario] = await db.query(
      "SELECT * FROM veterinario WHERE id_vet = ?",
      [id]
    );

    if (veterinario.length === 0) {
      return res.status(404).json({ erro: "Veterinário não encontrado" });
    }

    res.json(veterinario[0]);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao buscar veterinário",
      detalhes: error.message
    });
  }
});

// INSERT
router.post("/", async (req, res) => {
  try {
    const {
      nome,
      crmv,
      telefone,
      email,
      especialidade,
      carga_horaria
    } = req.body;

    const [resultado] = await db.query(
      `INSERT INTO veterinario 
       (nome, crmv, telefone, email, especialidade, carga_horaria)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nome, crmv, telefone, email, especialidade, carga_horaria]
    );

    res.status(201).json({
      mensagem: "Veterinário cadastrado com sucesso",
      id_vet: resultado.insertId
    });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao cadastrar veterinário",
      detalhes: error.message
    });
  }
});

// UPDATE
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nome,
      crmv,
      telefone,
      email,
      especialidade,
      carga_horaria,
      ativo
    } = req.body;

    await db.query(
      `UPDATE veterinario
       SET nome = ?, crmv = ?, telefone = ?, email = ?, especialidade = ?, carga_horaria = ?, ativo = ?
       WHERE id_vet = ?`,
      [nome, crmv, telefone, email, especialidade, carga_horaria, ativo, id]
    );

    res.json({ mensagem: "Veterinário atualizado com sucesso" });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao atualizar veterinário",
      detalhes: error.message
    });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      "DELETE FROM veterinario WHERE id_vet = ?",
      [id]
    );

    res.json({ mensagem: "Veterinário excluído com sucesso" });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao excluir veterinário",
      detalhes: error.message
    });
  }
});

module.exports = router;