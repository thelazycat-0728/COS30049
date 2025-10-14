const User = require("../models/User");

class UserController {
  static async updateUserRole(req, res) {
    const { userId, newRole } = req.body;

    try {
      await User.updateRole(userId, newRole);
      res
        .status(200)
        .json({ success: true, message: "User role updated successfully" });
    } catch (error) {
      res.status(500).json({
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
      let { limit, offset } = req.query;

      // Convert and validate
      limit = parseInt(limit) || undefined;
      offset = parseInt(offset) || undefined;

      const maxLimit = 100;
      if (limit > maxLimit || limit <= 0) {
        limit = undefined;
      }

      const totalUsers = await User.countAll();

      if (offset >= totalUsers || offset < 0) {
        offset = undefined;
      }

      const users = await User.findAll(limit, offset);

      res.status(200).json({
        success: true,
        data: users,
        pagination: {
          total: totalUsers,
          limit: limit || 10,
          offset: offset || 0,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching users",
        error: error.message,
      });
    }
  }
}
module.exports = UserController;
