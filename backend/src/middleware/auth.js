const jwt = require("jsonwebtoken");
const config = require("../config/config");
const User = require("../models/User");
require("dotenv").config();
const TokenBlacklist = require("../models/TokenBlacklist");

const MAX_TOKEN_LIFETIME = 15 * 60;
/**
 * Basic authentication middleware
 * Verifies JWT token and attaches user info to request
 */
const requireAuth = async (req, res, next) => {
  try {
    // 1. Extract token from multiple possible sources
    let token = null;

    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // No token found
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication required. No token provided.",
      });
    }

    const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        error: "Token has been revoked. Please login again.",
      });
    }

    // 2. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          error: "Token has expired. Please login again.",
        });
      }
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          error: "Invalid token.",
        });
      }
      throw error; // Other errors
    }

    const now = Math.floor(Date.now() / 1000);
    const tokenLifetime = decoded.exp - decoded.iat;

    if (tokenLifetime > MAX_TOKEN_LIFETIME) {
      return res.status(401).json({
        success: false,
        error: "Token lifetime exceeds maximum allowed duration",
      });
    }

    // ✅ NEW: Validate token hasn't been tampered with (exp shouldn't be in the future beyond max)
    const expectedMaxExp = decoded.iat + MAX_TOKEN_LIFETIME;
    if (decoded.exp > expectedMaxExp) {
      return res.status(401).json({
        success: false,
        error: "Token expiry has been tampered with",
      });
    }

    // 4. Optional: Verify user still exists and is active

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User no longer exists.",
      });
    }

    // 5. Attach user info and token to request object
    req.user = {
      id: decoded.id || user.user_id,
      email: decoded.email || user.email,
      role: decoded.role || user.role,
      username: user.username,
    };
    req.token = token;

    // 6. Continue to next middleware/controller
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication failed. Please try again.",
    });
  }
};

/**
 * Role-based authorization middleware
 * Checks if user has required role
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    // Must use requireAuth first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required.",
      });
    }

    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
      });
    }

    next();
  };
};

/**
 * Shorthand middleware for expert or admin access
 */
const requireExpert = [requireAuth, requireRole("expert", "admin")];

/**
 * Shorthand middleware for admin-only access
 */
const requireAdmin = [requireAuth, requireRole("admin")];

/**
 * Optional authentication
 * Attaches user if token exists, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    // No token = just continue without user
    if (!token) {
      req.user = null;
      return next();
    }

    // Try to decode token
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (error) {
      // Token invalid/expired = continue without user
      req.user = null;
    }

    next();
  } catch (error) {
    console.error("Optional auth error:", error);
    req.user = null;
    next();
  }
};

/**
 * Check if user owns the resource
 * Use after requireAuth
 */
const requireOwnership = (userIdParam = "id") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required.",
      });
    }

    const resourceUserId = parseInt(req.params[userIdParam]);
    const currentUserId = req.user.id;

    // Admin can access everything
    if (req.user.role === "admin") {
      return next();
    }

    // Check ownership
    if (resourceUserId !== currentUserId) {
      return res.status(403).json({
        success: false,
        error: "You can only access your own resources.",
      });
    }

    next();
  };
};

/**
 * Rate limiting per user
 * Prevents abuse
 */
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next(); // Skip for unauthenticated requests
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get user's request history
    if (!requests.has(userId)) {
      requests.set(userId, []);
    }

    const userRequests = requests.get(userId);

    // Remove old requests outside the window
    const recentRequests = userRequests.filter((time) => time > windowStart);
    requests.set(userId, recentRequests);

    // Check if limit exceeded
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please try again later.",
      });
    }

    // Add current request
    recentRequests.push(now);

    next();
  };
};

module.exports = {
  requireAuth,
  requireRole,
  requireExpert,
  requireAdmin,
  optionalAuth,
  requireOwnership,
  rateLimit,
  MAX_TOKEN_LIFETIME
};
