require("dotenv").config();

const dbClient = (process.env.DB_CLIENT || "mysql").toLowerCase();

function mysqlPool() {
  const mysql = require("mysql2/promise");

  return mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

function postgresPool() {
  const { Pool } = require("pg");

  const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
    max: Number(process.env.DB_POOL_SIZE || 10),
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
  });

  const convertPlaceholders = (sql) => {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  };

  const normalizeResult = (result) => {
    const rows = result.rows || [];
    const metadata = {
      rowCount: result.rowCount,
      insertId: rows[0]?.id || rows[0]?.id_cliente || rows[0]?.id_animal || rows[0]?.id_vet || rows[0]?.id_servico || rows[0]?.id_atend || rows[0]?.id_pront
    };

    return [rows, metadata];
  };

  return {
    async query(sql, params = []) {
      const result = await pool.query(convertPlaceholders(sql), params);
      return normalizeResult(result);
    },

    async getConnection() {
      const client = await pool.connect();

      return {
        async beginTransaction() {
          await client.query("BEGIN");
        },

        async commit() {
          await client.query("COMMIT");
        },

        async rollback() {
          await client.query("ROLLBACK");
        },

        async query(sql, params = []) {
          const result = await client.query(convertPlaceholders(sql), params);
          return normalizeResult(result);
        },

        release() {
          client.release();
        }
      };
    },

    async end() {
      await pool.end();
    }
  };
}

if (dbClient === "postgres" || dbClient === "postgresql" || dbClient === "pg") {
  module.exports = postgresPool();
} else {
  module.exports = mysqlPool();
}
