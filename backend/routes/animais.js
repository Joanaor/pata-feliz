const express = require("express");
const router = express.Router();
const db = require("../db");

// SELECT com JOIN - listar animais com tutor
router.get("/", async (req, res) => {
  try {
    const [animais] = await db.query(`
      SELECT 
        a.id_animal,
        a.nome,
        a.especie,
        a.raca,
        a.sexo,
        a.datanasc,
        a.ativo,
        c.id_cliente,
        c.nome AS tutor
      FROM animal a
      JOIN cliente c ON a.id_cliente = c.id_cliente
      ORDER BY a.nome
    `);

    res.json(animais);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao listar animais",
      detalhes: error.message
    });
  }
});

// SELECT por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [animal] = await db.query(
      "SELECT * FROM animal WHERE id_animal = ?",
      [id]
    );

    if (animal.length === 0) {
      return res.status(404).json({ erro: "Animal não encontrado" });
    }

    res.json(animal[0]);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao buscar animal",
      detalhes: error.message
    });
  }
});

// INSERT
router.post("/", async (req, res) => {
  try {
    const {
      nome,
      especie,
      raca,
      sexo,
      datanasc,
      id_cliente
    } = req.body;

    const [resultado] = await db.query(
      `INSERT INTO animal 
       (nome, especie, raca, sexo, datanasc, id_cliente)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nome, especie, raca, sexo, datanasc, id_cliente]
    );

    res.status(201).json({
      mensagem: "Animal cadastrado com sucesso",
      id_animal: resultado.insertId
    });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao cadastrar animal",
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
      especie,
      raca,
      sexo,
      datanasc,
      id_cliente,
      ativo
    } = req.body;

    await db.query(
      `UPDATE animal
       SET nome = ?, especie = ?, raca = ?, sexo = ?, datanasc = ?, id_cliente = ?, ativo = ?
       WHERE id_animal = ?`,
      [nome, especie, raca, sexo, datanasc, id_cliente, ativo, id]
    );

    res.json({ mensagem: "Animal atualizado com sucesso" });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao atualizar animal",
      detalhes: error.message
    });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      "DELETE FROM animal WHERE id_animal = ?",
      [id]
    );

    res.json({ mensagem: "Animal excluído com sucesso" });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao excluir animal",
      detalhes: error.message
    });
  }
});

module.exports = router;