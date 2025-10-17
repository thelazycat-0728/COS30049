const express = require("express");
const authController = require("../controller/authController");
const auth = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimiter");

const authRouter = express.Router();

authRouter.post("/login", loginLimiter, authController.login);

authRouter.post("/register", authController.register);

authRouter.get("/check-username", authController.checkUsername);

authRouter.post("/logout", auth.requireAuth, authController.logout);

authRouter.post("/logout-all", auth.requireAuth, authController.logoutAll);

authRouter.post("/refresh-token", authController.refresh);

authRouter.post("/verify-mfa",  authController.verifyMFA);

authRouter.post("/resend-mfa", authController.resendMFA);

module.exports = authRouter;
