'use strict';
// Ody-core'un KENDİ Postgres'i (Railway eklentisi). Benseno DB'sinden bağımsız.
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
  max: 5,
});
module.exports = { pool };
