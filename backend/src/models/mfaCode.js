const pool = require('../config/database');
const crypto = require('crypto');

class MFACode {
  /**
   * Generate random 6-digit code
   */
  static generateCode() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Create new MFA code for user
   */
  static async create(userId, ipAddress = null, userAgent = null) {
    // Generate code
    const code = MFACode.generateCode();
    
    // Expires in 10 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Invalidate previous codes for this user
    await MFACode.invalidateUserCodes(userId);

    // Insert new code
    const query = `
      INSERT INTO mfa_codes (user_id, code, expires_at, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    
    await pool.query(query, [userId, code, expiresAt, ipAddress, userAgent]);
    
    return code;
  }

  /**
   * Verify MFA code
   */
  static async verify(userId, code) {
    const query = `
      SELECT * FROM mfa_codes 
      WHERE user_id = ? 
        AND code = ? 
        AND verified = FALSE 
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const [rows] = await pool.query(query, [userId, code]);

    console.log(rows);
    
    if (rows.length === 0) {
      return false;
    }

    // Mark as verified
    const updateQuery = `
      UPDATE mfa_codes 
      SET verified = TRUE, verified_at = NOW()
      WHERE id = ?
    `;
    await pool.query(updateQuery, [rows[0].id]);

    return true;
  }

  /**
   * Invalidate all unverified codes for user
   */
  static async invalidateUserCodes(userId) {
    const query = `
      DELETE FROM mfa_codes 
      WHERE user_id = ? AND verified = FALSE
    `;
    await pool.query(query, [userId]);
  }

  /**
   * Check if code exists and is valid (without verifying)
   */
  static async exists(userId, code) {
    const query = `
      SELECT id FROM mfa_codes 
      WHERE user_id = ? 
        AND code = ? 
        AND verified = FALSE 
        AND expires_at > NOW()
    `;
    const [rows] = await pool.query(query, [userId, code]);
    return rows.length > 0;
  }

  /**
   * Clean up expired codes
   */
  static async cleanupExpired() {
    const query = `
      DELETE FROM mfa_codes 
      WHERE expires_at < NOW() OR verified = TRUE
    `;
    const [result] = await pool.query(query);
    return result.affectedRows;
  }

  /**
   * Get recent failed attempts (for rate limiting)
   */
  static async getRecentAttempts(userId, minutesAgo = 15) {
    const query = `
      SELECT COUNT(*) as count 
      FROM mfa_codes 
      WHERE user_id = ? 
        AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
    `;
    const [rows] = await pool.query(query, [userId, minutesAgo]);
    return rows[0].count;
  }
}

module.exports = MFACode;