const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000, // 10 seconds
});

// Test connection
pool.getConnection()
  .then(connection => {
    console.log('✅ Successfully connected to MySQL database');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Error connecting to MySQL database:', err.message);
  });

module.exports = pool;