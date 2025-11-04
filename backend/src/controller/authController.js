const User = require("../models/User");
const jwt = require("jsonwebtoken");
const RefreshToken = require("../models/RefreshToken");
const MFACode = require("../models/mfaCode");
const emailService = require("../services/emailService");
require("dotenv").config();
const TokenBlacklist = require("../models/TokenBlacklist");
const auditLogger = require("../logger/auditLogger");

class AuthController {
  static generateTempToken(user) {
    return jwt.sign(
      {
        id: user.user_id,
        email: user.email,
        temp: true, // Mark as temporary
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" } // Expires in 15 minutes
    );
  }

  // POST /api/auth/register
  static async register(req, res) {
    try {
      const { username, email, password } = req.body;
      const trimmedUsername = (username || "").trim();
      const trimmedEmail = (email || "").trim().toLowerCase();

      // Check if user exists
      const existingUser = await User.findByEmail(trimmedEmail);
      if (existingUser) {
        auditLogger.info(
          `Registration failed - Email already registered: ${trimmedEmail}`
        ); // Audit log
        return res.status(400).json({ error: "Email already registered" });
      }

      // Check if username is taken
      const existingByUsername = await User.findByUsername(trimmedUsername);
      if (existingByUsername) {
        auditLogger.info(
          `Registration failed - Username already taken: ${trimmedUsername}`
        ); // Audit log
        return res.status(400).json({ error: "Username already taken" });
      }

      // Create user (model handles password hashing)
      const userId = await User.create({
        username: trimmedUsername,
        email: trimmedEmail,
        password,
      });

      // Get created user
      const user = await User.findById(userId);

      auditLogger.info(
        `New user registered: ${trimmedUsername} (${trimmedEmail})`
      ); // Audit log

      res.status(201).json({
        message: "User registered successfully",
        user: {
          user_id: user.user_id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      auditLogger.info(`Registration error: ${error.message}`); // Audit log
      console.error("Register error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  }

  // GET /api/auth/check-username?username=...
  static async checkUsername(req, res) {
    try {
      const username = (req.query.username || "").trim();
      if (!username || username.length < 2) {
        return res
          .status(400)
          .json({ success: false, error: "username is required" });
      }
      const existing = await User.findByUsername(username);
      return res.json({ success: true, exists: !!existing });
    } catch (error) {
      console.error("checkUsername error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to check username" });
    }
  }

  /**
   * Generate access token (short-lived)
   */
  static generateAccessToken(user) {
    return jwt.sign(
      {
        id: user.user_id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" } // 15 minutes
    );
  }

  /**
   * Login - returns both access and refresh tokens
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: "Email and password are required",
        });
      }

      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        auditLogger.info(`Login failed - User not found: ${email}`); // Audit log
        return res.status(401).json({
          success: false,
          error: "Invalid credentials",
        });
      }

      // Verify password
      const isValid = await User.comparePassword(password, user.password_hash);
      if (!isValid) {
        auditLogger.info(`Login failed - Invalid password for user: ${email}`); // Audit log
        return res.status(401).json({
          success: false,
          error: "Invalid credentials",
        });
      }

      // Check rate limiting
      const recentAttempts = await MFACode.getRecentAttempts(user.id);
      if (recentAttempts >= 5) {
        auditLogger.info(
          `Login failed - Too many attempts for user: ${user.email}`
        ); // Audit log
        return res.status(429).json({
          success: false,
          error: "Too many login attempts. Please try again in 15 minutes.",
        });
      }

      // Generate MFA code
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"];
      const code = await MFACode.create(user.user_id, ipAddress, userAgent);

      // Send code via email
      try {
        await emailService.sendMFACode(user.email, code, user.username);
        auditLogger.info(`MFA code sent to user: ${user.email}`); // Audit log
      } catch (error) {
        auditLogger.error(
          `Failed to send MFA code to user: ${user.email} - ${error.message}`
        ); // Audit log
        console.error("Failed to send MFA email:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to send verification email. Please try again.",
        });
      }

      // Generate temporary token
      const tempToken = AuthController.generateTempToken(user);

      res.json({
        success: true,
        message: "Verification code sent to your email",
        requiresMFA: true,
        tempToken, // Frontend needs this to verify MFA
        email: user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"), // Masked email
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        error: "Login failed",
      });
    }
  }

  static async requestMFA(req, res) {
    try {
      const { user } = req.body;
      console.log(user);
      if (!user.user.email || !user.user.role) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid user data" });
      }

      // Check rate limiting
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"];
      const code = await MFACode.create(
        user.user.user_id,
        ipAddress,
        userAgent
      );

      console.log(user.user);
      const tempToken = AuthController.generateTempToken(user.user);
      await emailService.sendMFACode(user.user.email, code, user.user.username);

      res.json({
        success: true,
        message: "Verification code sent to email",
        tempToken,
      });
    } catch (error) {
      console.error("MFA request error:", error);
      res.status(500).json({
        success: false,
        error: "MFA request failed",
      });
    }
  }

  static async verifyMFA(req, res) {
    try {
      const { code, tempToken, login } = req.body;

      // Validate input
      if (!code || !tempToken) {
        return res.status(400).json({
          success: false,
          error: "Verification code and token are required",
        });
      }

      // Verify temporary token
      let decoded;

      try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
        console.log(decoded);
        if (!decoded.temp) {
          return res.status(401).json({
            success: false,
            error: "Invalid token",
          });
        }
      } catch (error) {
        auditLogger.info(`MFA verification failed - Invalid or expired token`); // Audit log
        return res.status(401).json({
          success: false,
          error: "Token expired or invalid",
        });
      }

      // Verify MFA code

      const isValid = await MFACode.verify(decoded.id, code);

      if (!isValid) {
        auditLogger.info(
          `MFA verification failed - Invalid code for user ID: ${decoded.id}`
        ); // Audit log
        return res.status(401).json({
          success: false,
          error: "Invalid or expired verification code",
        });
      }

      if (!login) {
        return res.json({
          success: true,
          message: "MFA verification successful",
          user: {
            id: decoded.id,
            email: decoded.email,
          },
        });
      }

      // Get user details
      const user = await User.findById(decoded.id);

      if (!user) {
        auditLogger.info(
          `MFA verification failed - User not found for ID: ${decoded.id}`
        ); // Audit log
        return res.status(401).json({
          success: false,
          error: "User not found",
        });
      }

      // Generate full access token and refresh token
      const accessToken = AuthController.generateAccessToken(user);
      const refreshTokenData = await RefreshToken.create(user.user_id);

      // Set cookies
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", refreshTokenData.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Clear temporary token cookie
      res.clearCookie("tempToken");

      res.json({
        success: true,
        message: "Login successful",
        accessToken,
        refreshToken: refreshTokenData.token,
        expiresIn: 15 * 60,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      auditLogger.error(`MFA verification error: ${error.message}`); // Audit log
      console.error("MFA verification error:", error);
      res.status(500).json({
        success: false,
        error: "Verification failed",
      });
    }
  }

  /**
   * Resend MFA code
   */
  static async resendMFA(req, res) {
    try {
      const { tempToken } = req.body;

      if (!tempToken) {
        return res.status(400).json({
          success: false,
          error: "Token is required",
        });
      }

      // Verify temporary token
      let decoded;
      try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);

        if (!decoded.temp) {
          return res.status(401).json({
            success: false,
            error: "Invalid token",
          });
        }
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: "Token expired or invalid",
        });
      }

      // Check rate limiting
      const recentAttempts = await MFACode.getRecentAttempts(decoded.id);
      if (recentAttempts >= 5) {
        auditLogger.info(`MFA rate limit exceeded for user ID: ${decoded.id}`); // Audit log
        return res.status(429).json({
          success: false,
          error: "Too many attempts. Please wait 15 minutes.",
        });
      }

      // Get user
      const user = await User.findById(decoded.user_id);

      if (!user) {
        auditLogger.info(
          `MFA rate limit exceeded - User not found for ID: ${decoded.id}`
        ); // Audit log
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Generate new code
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"];
      const code = await MFACode.create(user.user_id, ipAddress, userAgent);

      // Send email
      await emailService.sendMFACode(user.email, code, user.username);
      auditLogger.info(`New MFA code resent to user: ${user.email}`); // Audit log

      res.json({
        success: true,
        message: "New verification code sent to your email",
      });
    } catch (error) {
      auditLogger.error(`Resend MFA error: ${error.message}`); // Audit log
      console.error("Resend MFA error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to resend code",
      });
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refresh(req, res) {
    try {
      // Get refresh token from body or cookie
      let refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: "Refresh token required",
        });
      }

      // Validate refresh token
      const tokenData = await RefreshToken.findByToken(refreshToken);

      if (!tokenData) {
        auditLogger.info(`Invalid refresh token attempt`); // Audit log
        return res.status(401).json({
          success: false,
          error: "Invalid or expired refresh token",
        });
      }

      // Get user
      const user = await User.findById(tokenData.user_id);

      if (!user) {
        auditLogger.info(
          `Invalid refresh token attempt - User not found: ${refreshToken}`
        ); // Audit log
        return res.status(401).json({
          success: false,
          error: "User not found",
        });
      }

      // Generate new access token
      const newAccessToken = AuthController.generateAccessToken(user);

      // Revoke old refresh token and issue new one
      const newRefreshTokenData = await RefreshToken.create(user.user_id);
      await RefreshToken.revoke(refreshToken, newRefreshTokenData.token);

      // Update cookies
      res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", newRefreshTokenData.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      auditLogger.info(`New refresh token issued for user: ${user.email}`); // Audit log

      res.json({
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshTokenData.token,
        expiresIn: 15 * 60,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      auditLogger.error(`Refresh token error: ${error.message}`); // Audit log
      console.error("Refresh token error:", error);
      res.status(500).json({
        success: false,
        error: "Token refresh failed",
      });
    }
  }

  /**
   * Logout - revoke refresh token
   */
  static async logout(req, res) {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;


      if (refreshToken) {
        await RefreshToken.revoke(refreshToken);
      }

      const token = req.token;

      await TokenBlacklist.add(token, new Date(Date.now() + 15 * 60 * 1000)); // Blacklist for 15 mins

      auditLogger.info(
        `User logged out: ${req.user ? req.user.username : "Unknown"}`
      ); // Audit log

      // Clear cookies
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      auditLogger.error(`Logout error: ${error.message}`); // Audit log
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        error: "Logout failed",
      });
    }
  }

  /**
   * Logout from all devices
   */
  static async logoutAll(req, res) {
    try {
      await RefreshToken.revokeAllForUser(req.user.id);

      const token = req.token;

      await TokenBlacklist.add(token, new Date(Date.now() + 15 * 60 * 1000)); // Blacklist for 15 mins

      auditLogger.info(
        `User logged out from all devices: ${
          req.user ? req.user.username : "Unknown user"
        }`
      ); // Audit log

      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");

      res.json({
        success: true,
        message: "Logged out from all devices",
      });
    } catch (error) {
      auditLogger.error(`Logout all error: ${error.message}`); // Audit log
      console.error("Logout all error:", error);
      res.status(500).json({
        success: false,
        error: "Logout failed",
      });
    }
  }

  static async cleanupExpiredTokens(req, res) {
    try {
      const deletedCount = await CleanupService.runCleanup();
      res.json({
        success: true,
        message: `Cleaned up ${deletedCount} expired tokens`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Cleanup failed",
      });
    }
  }

  static async cleanUp(req, res) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({
          success: false,
          error: "Authorization header missing",
        });
      }

      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          error: "Invalid authorization format. Use: Bearer <token>",
        });
      }

      const token = authHeader.substring(7);

      if (!token) {
        return res.status(401).json({
          success: false,
          error: "Token not provided",
        });
      }

      let decoded;

      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.temp) {
          auditLogger.warn(
            `Cleanup attempt with non-temp token from IP: ${req.ip}`
          );
          return res.status(403).json({
            success: false,
            error: "Invalid token type. Temporary token required.",
          });
        }
      } catch (error) {
        auditLogger.warn(`Invalid token in cleanup attempt: ${error.message}`);

        if (error.name === "TokenExpiredError") {
          return res.status(401).json({
            success: false,
            error: "Token has expired",
          });
        }

        return res.status(401).json({
          success: false,
          error: "Invalid token",
        });
      }

      User.delete(decoded.id);
      RefreshToken.revokeAllForUser(decoded.id);


      return res.json({
        success: true,
        message: "User data cleanup successful",
      });

    } catch (error) {
      console.error("Cleanup error:", error);
      res.status(500).json({
        success: false,
        error: "Cleanup failed",
      });
    }
  }
}

module.exports = AuthController;
