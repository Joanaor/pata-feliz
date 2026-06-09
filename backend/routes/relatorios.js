const express = require("express");
const router = express.Router();
const db = require("../db");

// Serviços mais solicitados
router.get("/servicos-mais-solicitados", async (req, res) => {
  try {
    const [resultado] = await db.query(`
      SELECT 
        s.descricao AS servico,
        COUNT(at.id_atend) AS total_solicitacoes
      FROM servico s
      LEFT JOIN atendimento at ON s.id_servico = at.id_servico
      GROUP BY s.id_servico, s.descricao
      ORDER BY total_solicitacoes DESC
    `);

    res.json(resultado);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao buscar serviços mais solicitados",
      detalhes: error.message
    });
  }
});

// Veterinários com maior número de atendimentos
router.get("/veterinarios-mais-atendimentos", async (req, res) => {
  try {
    const [resultado] = await db.query(`
      SELECT 
        v.nome AS veterinario,
        COUNT(at.id_atend) AS total_atendimentos
      FROM veterinario v
      LEFT JOIN atendimento at ON v.id_vet = at.id_vet
      GROUP BY v.id_vet, v.nome
      ORDER BY total_atendimentos DESC
    `);

    res.json(resultado);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao buscar veterinários com mais atendimentos",
      detalhes: error.message
    });
  }
});

// Animais atendidos por período usando procedure
router.get("/atendimentos-periodo", async (req, res) => {
  try {
    const { inicio, fim } = req.query;

    const [resultado] = await db.query(
      "CALL listar_atendimentos_periodo(?, ?)",
      [inicio, fim]
    );

    res.json(resultado[0]);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao buscar atendimentos por período",
      detalhes: error.message
    });
  }
});

// Histórico médico usando stored procedure com parâmetro
router.get("/historico-animal/:idAnimal", async (req, res) => {
  try {
    const { idAnimal } = req.params;

    const [resultado] = await db.query(
      "CALL buscar_historico_animal(?)",
      [idAnimal]
    );

    res.json(resultado[0]);
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao buscar histórico do animal",
      detalhes: error.message
    });
  }
});

module.exports = router;