const express = require("express");
const router = express.Router();
const db = require("../db");

// SELECT com JOIN - atendimentos completos
router.get("/", async (req, res) => {
  try {
    const [atendimentos] = await db.query(`
      SELECT 
        at.id_atend,
        at.data_atend,
        at.horario,
        at.status_atendimento,
        an.id_animal,
        an.nome AS animal,
        c.nome AS tutor,
        v.id_vet,
        v.nome AS veterinario,
        s.id_servico,
        s.descricao AS servico,
        s.valor
      FROM atendimento at
      JOIN animal an ON at.id_animal = an.id_animal
      JOIN cliente c ON an.id_cliente = c.id_cliente
      JOIN veterinario v ON at.id_vet = v.id_vet
      JOIN servico s ON at.id_servico = s.id_servico
      ORDER BY at.data_atend DESC, at.horario DESC
    `);

    res.json(atendimentos);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao listar atendimentos",
      detalhes: error.message
    });
  }
});

// SELECT por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [atendimento] = await db.query(
      "SELECT * FROM atendimento WHERE id_atend = ?",
      [id]
    );

    if (atendimento.length === 0) {
      return res.status(404).json({ erro: "Atendimento não encontrado" });
    }

    res.json(atendimento[0]);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao buscar atendimento",
      detalhes: error.message
    });
  }
});

// INSERT - cadastrar atendimento simples
router.post("/", async (req, res) => {
  try {
    const {
      data_atend,
      horario,
      status_atendimento,
      id_animal,
      id_vet,
      id_servico
    } = req.body;

    const [resultado] = await db.query(
      `INSERT INTO atendimento 
       (data_atend, horario, status_atendimento, id_animal, id_vet, id_servico)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data_atend, horario, status_atendimento, id_animal, id_vet, id_servico]
    );

    res.status(201).json({
      mensagem: "Atendimento cadastrado com sucesso",
      id_atend: resultado.insertId
    });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao cadastrar atendimento",
      detalhes: error.message
    });
  }
});

// INSERT usando STORED PROCEDURE com TRANSAÇÃO
router.post("/com-prontuario", async (req, res) => {
  try {
    const {
      data_atend,
      horario,
      id_animal,
      id_vet,
      id_servico,
      diagnostico,
      medicacao,
      observacao
    } = req.body;

    await db.query(
      `CALL cadastrar_atendimento_com_prontuario(?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data_atend,
        horario,
        id_animal,
        id_vet,
        id_servico,
        diagnostico,
        medicacao,
        observacao
      ]
    );

    res.status(201).json({
      mensagem: "Atendimento com prontuário cadastrado com sucesso"
    });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao cadastrar atendimento com prontuário",
      detalhes: error.message
    });
  }
});

// UPDATE
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      data_atend,
      horario,
      status_atendimento,
      id_animal,
      id_vet,
      id_servico
    } = req.body;

    await db.query(
      `UPDATE atendimento
       SET data_atend = ?, horario = ?, status_atendimento = ?, id_animal = ?, id_vet = ?, id_servico = ?
       WHERE id_atend = ?`,
      [data_atend, horario, status_atendimento, id_animal, id_vet, id_servico, id]
    );

    res.json({ mensagem: "Atendimento atualizado com sucesso" });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao atualizar atendimento",
      detalhes: error.message
    });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      "DELETE FROM atendimento WHERE id_atend = ?",
      [id]
    );

    res.json({ mensagem: "Atendimento excluído com sucesso" });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao excluir atendimento",
      detalhes: error.message
    });
  }
});

module.exports = router;