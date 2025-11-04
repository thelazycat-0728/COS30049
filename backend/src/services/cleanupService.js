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
          'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = TRUE'
        );
        
        // Clean expired MFA codes
        const [mfaResult] = await pool.query(
          'DELETE FROM mfa_codes WHERE expires_at < NOW()'
        );
        
        
          
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });

    // Clean up audit logs older than 7 days daily at 03:00
    cron.schedule('0 3 * * *', async () => {
      try {
        const logsDir = path.join(__dirname, '..', 'logger', 'logs');
        const now = Date.now();
        const ttlMs = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (!fs.existsSync(logsDir)) return;
        const files = fs.readdirSync(logsDir);
        for (const file of files) {
          const fullPath = path.join(logsDir, file);
          const stat = fs.statSync(fullPath);
          if (!stat.isFile()) continue;
          if (now - stat.mtimeMs > ttlMs) {
            try { fs.unlinkSync(fullPath); } catch (_) { /* ignore */ }
          }
        }
      } catch (error) {
        console.error('Log cleanup error:', error);
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
