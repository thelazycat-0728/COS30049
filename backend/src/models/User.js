const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  // CREATE
  static async create({ username, email, password, role = 'public' }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO Users (username, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `;
    const [result] = await pool.query(query, [username, email, hashedPassword, role]);
    return result.insertId;
  }

  // READ (single)
  static async findById(id) {
    const query = 'SELECT user_id, username, email, role, created_at FROM Users WHERE user_id = ?';
    const [rows] = await pool.query(query, [id]);
    return rows[0];
  }

  // READ (by email)
  static async findByEmail(email) {
    const query = 'SELECT * FROM Users WHERE email = ?';
    const [rows] = await pool.query(query, [email]);
    return rows[0];
  }

  // READ (all with pagination)
  static async findAll(limit = 10, offset = 0) {
    const query = 'SELECT id, username, email, role, created_at FROM Users LIMIT ? OFFSET ?';
    const [rows] = await pool.query(query, [limit, offset]);
    return rows;
  }

  // UPDATE
  static async updateRole(id, role) {
    const query = 'UPDATE Users SET role = ?, updated_at = NOW() WHERE id = ?';
    const [result] = await pool.query(query, [role, id]);
    return result.affectedRows > 0;
  }

  // DELETE (soft delete preferred)
  static async delete(id) {
    const query = 'DELETE FROM Users WHERE id = ?';
    const [result] = await pool.query(query, [id]);
    return result.affectedRows > 0;
  }

  // Helper methods
  static async comparePassword(candidatePassword, hashedPassword) {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }

  static async countAll() {
    const query = 'SELECT COUNT(*) as count FROM Users';
    const [rows] = await pool.query(query);
    return rows[0].count;
  }
}

module.exports = User;