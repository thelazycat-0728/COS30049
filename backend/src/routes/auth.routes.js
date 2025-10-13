const express = require("express");
const authController = require("../controller/authController");
const auth = require("../middleware/auth");
const loginLimiter = require("../middleware/loginLimiter");

const authRouter = express.Router();

authRouter.post("/login", loginLimiter, authController.login);

authRouter.post("/register", authController.register);

authRouter.post("/logout", auth.requireAuth, authController.logout);

authRouter.post("/logout-all", auth.requireAuth, authController.logoutAll);

authRouter.post("/refresh-token", authController.refresh);

authRouter.post("/verify-mfa", loginLimiter, authController.verifyMFA);

authRouter.post("/resend-mfa", authController.resendMFA);

/* authRouter.post("/testing-route", auth.requireAuth, (req, res) => {
  res.json({ message: "You have accessed a protected route", user: req.user });
}) */

module.exports = authRouter;
