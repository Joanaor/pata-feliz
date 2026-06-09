const express = require("express");
const cors = require("cors");
require("dotenv").config();

const clientesRoutes = require("./routes/clientes");
const animaisRoutes = require("./routes/animais");
const veterinariosRoutes = require("./routes/veterinarios");
const servicosRoutes = require("./routes/servicos");
const atendimentosRoutes = require("./routes/atendimentos");
const prontuariosRoutes = require("./routes/prontuarios");
const relatoriosRoutes = require("./routes/relatorios");
const v2Routes = require("./routes/v2");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    mensagem: "API da Clínica Veterinária Pata Feliz funcionando!"
  });
});

app.use("/clientes", clientesRoutes);
app.use("/animais", animaisRoutes);
app.use("/veterinarios", veterinariosRoutes);
app.use("/servicos", servicosRoutes);
app.use("/atendimentos", atendimentosRoutes);
app.use("/prontuarios", prontuariosRoutes);
app.use("/relatorios", relatoriosRoutes);
app.use("/api", v2Routes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
