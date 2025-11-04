const User = require("../models/User");
const pool = require('../config/database');
const auditLogger = require('../logger/auditLogger');

class UserController {
  static async updateUserRole(req, res) {
    try {
      const userId = req.params.id || req.body.userId;
      const { newRole } = req.body;

      const allowedRoles = ["public", "expert", "admin"];
      if (!userId || !newRole || !allowedRoles.includes(newRole)) {
        return res.status(400).json({
          success: false,
          message: "Invalid userId or role",
        });
      }

      const ok = await User.updateRole(userId, newRole);
      if (!ok) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      auditLogger.info('user.role.update', {
        requestId: req.requestId,
        actor: req.user ? { id: req.user.id, username: req.user.username, role: req.user.role } : null,
        targetUserId: userId,
        newRole,
      });

      return res
        .status(200)
        .json({ success: true, message: "User role updated successfully" });
    } catch (error) {
      auditLogger.error('user.role.update.error', { requestId: req.requestId, targetUserId: req.params.id || req.body.userId, message: error?.message });
      return res.status(500).json({
        success: false,
        message: "Error updating user role",
        error: error.message,
      });
    }
  }

  static async deleteUser(req, res) {
    try {
      const userId = req.params.id;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      // Prevent users from deleting themselves
      if (req.user.id == userId) {
        return res.status(400).json({
          success: false,
          message: "You cannot delete your own account",
        });
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Delete user from database
      const deleteQuery = 'DELETE FROM Users WHERE user_id = ?';
      const [result] = await pool.execute(deleteQuery, [userId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      return res.status(500).json({
        success: false,
        message: "Error deleting user",
        error: error.message,
      });
    }
  }

  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ user });
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  }

  static async getAllUsers(req, res) {
    try {
      // Parse pagination params
      const sizeQ = req.query.limit ?? req.query.size;
      const pageQ = req.query.page;
      const offsetQ = req.query.offset;

      // Parse filter, sort, and search parameters
      const roleFilter = req.query.role;
      const sortKey = req.query.sortBy || req.query.sort || 'created_at';
      const sortOrder = req.query.sortOrder || req.query.order || 'DESC';
      const searchQuery = req.query.search;

      // Validate and set size (limit)
      let size = Number(sizeQ);
      if (!Number.isFinite(size) || size <= 0) size = 10;
      if (size > 100) size = 100;

      // Validate and set offset
      let offset = Number(offsetQ);
      if (!Number.isFinite(offset) || offset < 0) {
        const pageNum = Number(pageQ);
        if (Number.isFinite(pageNum) && pageNum > 0) {
          offset = (pageNum - 1) * size;
        } else {
          offset = 0;
        }
      }

      // Build base SQL query with filters
      let baseQuery = `FROM Users WHERE 1=1`;
      const queryParams = [];

      // Add role filter if provided
      if (roleFilter) {
        baseQuery += ` AND role = ?`;
        queryParams.push(roleFilter);
      }

      // Add search filter if provided (search in username and email)
      if (searchQuery && searchQuery.trim()) {
        baseQuery += ` AND (username LIKE ? OR email LIKE ?)`;
        const searchPattern = `%${searchQuery.trim()}%`;
        queryParams.push(searchPattern, searchPattern);
      }

      // Query total count
      const countQuery = `SELECT COUNT(*) AS total ${baseQuery}`;
      const [countRows] = await pool.execute(countQuery, queryParams);
      const total = countRows[0]?.total ?? 0;

      // Build main query with sorting and pagination
      let mainQuery = `
        SELECT user_id, username, email, role, created_at, updated_at 
        ${baseQuery}
      `;

      // Add sorting (validate sortKey to prevent SQL injection)
      const allowedSortKeys = ['username', 'email', 'role', 'created_at', 'updated_at'];
      const safeSortKey = allowedSortKeys.includes(sortKey) ? sortKey : 'created_at';
      const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      mainQuery += ` ORDER BY ${safeSortKey} ${safeSortOrder}`;
      
      // Add pagination
      mainQuery += ` LIMIT ? OFFSET ?`;
      
      // Execute main query
      const [users] = await pool.execute(mainQuery, [...queryParams, size, offset]);

      // Derive current page if not provided
      const currentPage = Number.isFinite(Number(pageQ)) && Number(pageQ) > 0 
        ? Number(pageQ) 
        : Math.floor(offset / size) + 1;

      res.status(200).json({
        success: true,
        data: users,
        pagination: {
          total: total,
          page: currentPage,
          size: size,
          offset: offset
        },
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({
        success: false,
        message: "Error fetching users",
        error: error.message,
      });
    }
  }
}

module.exports = UserController;
