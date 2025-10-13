const pool = require('../config/database');
const crypto = require('crypto');

class RefreshToken {
  /**
   * Generate a secure random refresh token
   */
  static generateToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Create and store a new refresh token
   */
  static async create(userId, expiresInDays = 7) {
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const query = `
      INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, NOW())
    `;
    
    await pool.query(query, [userId, token, expiresAt]);
    
    return {
      token,
      expiresAt
    };
  }

  /**
   * Find refresh token by token string
   */
  static async findByToken(token) {
    const query = `
      SELECT * FROM refresh_tokens 
      WHERE token = ? AND revoked = FALSE AND expires_at > NOW()
    `;
    const [rows] = await pool.query(query, [token]);
    return rows[0];
  }

  /**
   * Revoke a refresh token
   */
  static async revoke(token, replacedByToken = null) {
    const query = `
      UPDATE refresh_tokens 
      SET revoked = TRUE, revoked_at = NOW(), replaced_by_token = ?
      WHERE token = ?
    `;
    await pool.query(query, [replacedByToken, token]);
  }

  /**
   * Revoke all tokens for a user (logout all devices)
   */
  static async revokeAllForUser(userId) {
    const query = `
      UPDATE refresh_tokens 
      SET revoked = TRUE, revoked_at = NOW()
      WHERE user_id = ? AND revoked = FALSE
    `;
    const [result] = await pool.query(query, [userId]);
    return result.affectedRows;
  }

  /**
   * Clean up expired tokens
   */
  static async cleanupExpired() {
    const query = `
      DELETE FROM refresh_tokens 
      WHERE expires_at < NOW() OR (revoked = TRUE AND revoked_at < DATE_SUB(NOW(), INTERVAL 30 DAY))
    `;
    const [result] = await pool.query(query);
    return result.affectedRows;
  }

  /**
   * Get all active tokens for a user
   */
  static async getActiveTokensForUser(userId) {
    const query = `
      SELECT id, token, expires_at, created_at 
      FROM refresh_tokens 
      WHERE user_id = ? AND revoked = FALSE AND expires_at > NOW()
      ORDER BY created_at DESC
    `;
    const [rows] = await pool.query(query, [userId]);
    return rows;
  }
}

module.exports = RefreshToken;