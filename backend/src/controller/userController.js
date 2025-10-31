const User = require("../models/User");
const pool = require('../config/database'); // Add this import

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

      return res
        .status(200)
        .json({ success: true, message: "User role updated successfully" });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error updating user role",
        error: error.message,
      });
    }
  }

  static async getProfile(req, res) {
    try {
      // req.user is set by auth middleware
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
      // Parse pagination params: support limit/offset or page/size (following plantController pattern)
      const sizeQ = req.query.limit ?? req.query.size;
      const pageQ = req.query.page;
      const offsetQ = req.query.offset;

      // Parse filter and sort parameters
      const roleFilter = req.query.role;
      const sortKey = req.query.sort || 'created_at';
      const sortOrder = req.query.order || 'desc';

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
      const safeSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      
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