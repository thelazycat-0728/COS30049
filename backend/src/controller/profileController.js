// controllers/profileController.js
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class ProfileController {
  /**
   * GET /api/profile
   * Get user profile
   */
  static async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const [users] = await pool.execute(
        `SELECT user_id, username, email, role, created_at, updated_at 
         FROM Users WHERE user_id = ?`,
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const user = users[0];
      
      // Remove sensitive information
      delete user.password_hash;

      res.json({
        success: true,
        user,
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch profile',
      });
    }
  }

  /**
   * PUT /api/profile
   * Update user profile (username and email)
   */
  static async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { username, email } = req.body;

      if (!username && !email) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update',
        });
      }

      // Check if username already exists (excluding current user)
      if (username) {
        const [existingUsername] = await pool.execute(
          'SELECT user_id FROM Users WHERE username = ? AND user_id != ?',
          [username, userId]
        );
        if (existingUsername.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Username already exists',
          });
        }
      }

      // Check if email already exists (excluding current user)
      if (email) {
        const [existingEmail] = await pool.execute(
          'SELECT user_id FROM Users WHERE email = ? AND user_id != ?',
          [email, userId]
        );
        if (existingEmail.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Email already exists',
          });
        }
      }

      // Build update query dynamically
      const updates = [];
      const params = [];

      if (username) {
        updates.push('username = ?');
        params.push(username);
      }

      if (email) {
        updates.push('email = ?');
        params.push(email);
      }

      // Always update the updated_at timestamp
      updates.push('updated_at = NOW()');
      params.push(userId);

      const query = `UPDATE Users SET ${updates.join(', ')} WHERE user_id = ?`;

      const [result] = await pool.execute(query, params);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Get updated user
      const [users] = await pool.execute(
        `SELECT user_id, username, email, role, created_at, updated_at 
         FROM Users WHERE user_id = ?`,
        [userId]
      );

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: users[0],
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile',
      });
    }
  }

  /**
   * PUT /api/profile/password
   * Change user password
   */
  static async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password are required',
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'New password must be at least 6 characters long',
        });
      }

      // Get current user with password hash
      const [users] = await pool.execute(
        'SELECT user_id, password_hash FROM Users WHERE user_id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const user = users[0];

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect',
        });
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      const [result] = await pool.execute(
        'UPDATE Users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?',
        [newPasswordHash, userId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      res.json({
        success: true,
        message: 'Password updated successfully',
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to change password',
      });
    }
  }

  /**
   * GET /api/profile/stats
   * Get user statistics
   */
  static async getUserStats(req, res) {
    try {
      const userId = req.user.id;

      // Get observation count
      const [observationCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM PlantObservations WHERE user_id = ?',
        [userId]
      );

      // Get unique species count
      const [speciesCount] = await pool.execute(
        'SELECT COUNT(DISTINCT plant_id) as count FROM PlantObservations WHERE user_id = ?',
        [userId]
      );

      // Get unique locations count
      const [locationsCount] = await pool.execute(
        `SELECT COUNT(DISTINCT CONCAT(latitude, ',', longitude)) as count 
         FROM PlantObservations 
         WHERE user_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL`,
        [userId]
      );

      res.json({
        success: true,
        stats: {
          observations: observationCount[0].count,
          species: speciesCount[0].count,
          locations: locationsCount[0].count,
        },
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user statistics',
      });
    }
  }
}

module.exports = ProfileController;