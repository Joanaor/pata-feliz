const express = require("express");
const router = express.Router();
const db = require("../db");

// SELECT com JOIN
router.get("/", async (req, res) => {
  try {
    const [prontuarios] = await db.query(`
      SELECT 
        p.id_pront,
        p.diagnostico,
        p.medicacao,
        p.observacao,
        p.id_atend,
        a.nome AS animal,
        at.data_atend,
        at.horario
      FROM prontuario p
      JOIN atendimento at ON p.id_atend = at.id_atend
      JOIN animal a ON at.id_animal = a.id_animal
      ORDER BY at.data_atend DESC
    `);

    res.json(prontuarios);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao listar prontuários",
      detalhes: error.message
    });
  }
});

// SELECT por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [prontuario] = await db.query(
      "SELECT * FROM prontuario WHERE id_pront = ?",
      [id]
    );

    if (prontuario.length === 0) {
      return res.status(404).json({ erro: "Prontuário não encontrado" });
    }

    res.json(prontuario[0]);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao buscar prontuário",
      detalhes: error.message
    });
  }
});

// INSERT
router.post("/", async (req, res) => {
  try {
    const {
      diagnostico,
      medicacao,
      observacao,
      id_atend
    } = req.body;

    const [resultado] = await db.query(
      `INSERT INTO prontuario 
       (diagnostico, medicacao, observacao, id_atend)
       VALUES (?, ?, ?, ?)`,
      [diagnostico, medicacao, observacao, id_atend]
    );

    res.status(201).json({
      mensagem: "Prontuário cadastrado com sucesso",
      id_pront: resultado.insertId
    });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao cadastrar prontuário",
      detalhes: error.message
    });
  }
});

// UPDATE
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      diagnostico,
      medicacao,
      observacao
    } = req.body;

    await db.query(
      `UPDATE prontuario
       SET diagnostico = ?, medicacao = ?, observacao = ?
       WHERE id_pront = ?`,
      [diagnostico, medicacao, observacao, id]
    );

    res.json({ mensagem: "Prontuário atualizado com sucesso" });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao atualizar prontuário",
      detalhes: error.message
    });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      "DELETE FROM prontuario WHERE id_pront = ?",
      [id]
    );

    res.json({ mensagem: "Prontuário excluído com sucesso" });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao excluir prontuário",
      detalhes: error.message
    });
  }
});

module.exports = router;