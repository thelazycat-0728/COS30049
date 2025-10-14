const pool = require('../config/database');


class TokenBlacklist {
  static async add(token, expiresAt) {
    const query = 'INSERT INTO token_blacklist (token, expires_at) VALUES (?, ?)';
    await pool.execute(query, [token, expiresAt]);
  }

  static async isBlacklisted(token) {
    const query = 'SELECT 1 FROM token_blacklist WHERE token = ? AND expires_at > NOW()';
    const [rows] = await pool.execute(query, [token]);
    return rows.length > 0;
  }
}


module.exports = TokenBlacklist;

