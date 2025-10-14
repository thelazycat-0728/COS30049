const cron = require('node-cron');
const pool = require('../config/database');

class CleanupService {
  static startScheduledCleanup() {
    // Clean up expired tokens every hour
    cron.schedule('0 * * * *', async () => {
      try {
        
        // Clean expired blacklisted tokens
        const [blacklistResult] = await pool.query(
          'DELETE FROM token_blacklist WHERE expires_at < NOW()'
        );
        
        // Clean expired refresh tokens
        const [refreshResult] = await pool.query(
          'DELETE FROM refresh_tokens WHERE expires_at < NOW()'
        );
        
        // Clean expired MFA codes
        const [mfaResult] = await pool.query(
          'DELETE FROM mfa_codes WHERE expires_at < NOW()'
        );
        
        
          
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });
    
    console.log('✅ Scheduled cleanup service started');
  }
  
  // Manual cleanup method
  static async runCleanup() {
    try {
      const [result] = await pool.query(
        'DELETE FROM token_blacklist WHERE expires_at < NOW()'
      );
      
  
      return result.affectedRows;
    } catch (error) {
      console.error('Manual cleanup error:', error);
      throw error;
    }
  }
}

module.exports = CleanupService;