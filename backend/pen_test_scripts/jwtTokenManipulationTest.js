const axios = require("axios");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const BASE_URL = "http://localhost:8080";

async function testJWTManipulation() {
  console.log("\n🔐 JWT Token Manipulation Security Test (with MFA)\n");
  console.log("=".repeat(60));

  // ============================================
  // Check JWT_SECRET
  // ============================================
  console.log("\n🔍 Checking environment...");
  if (!process.env.JWT_SECRET) {
    console.error("❌ ERROR: JWT_SECRET not found in .env");
    return;
  }
  console.log("✅ JWT_SECRET loaded");
  console.log("   Length:", process.env.JWT_SECRET.length, "characters\n");

  try {
    // ============================================
    // Step 1: Initial Login (triggers MFA)
    // ============================================
    console.log("📝 Step 1: Initial login (should trigger MFA)...");

    let initialLoginRes;
    try {
      initialLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
        email: "jonathanyeokk@gmail.com",
        password: "HurhCat123!",
      });

      tempToken = initialLoginRes.data.tempToken;

      verifyMfa = await axios.post(`${BASE_URL}/auth/verify-mfa`, {
        tempToken,
      });
    } catch (error) {
      if (error.response?.status === 400) {
        console.log("✅ MFA required (as expected)");

        let decodedTempToken;

        // Decode temp token to get userId
        try {
          decodedTempToken = jwt.verify(tempToken, process.env.JWT_SECRET);
          console.log("   Temp token decoded:", decodedTempToken);
        } catch (decodeError) {
          console.error("❌ Failed to decode temp token:", decodeError);
        }

        // ============================================
        // Test: Try to use userId without completing MFA
        // ============================================
        console.log("\n🧪 Test 1: Bypass MFA by creating fake token");
        const bypassPayload = {
          userId: decodedTempToken.id,
          role: "admin", // Try to escalate privileges
        };

        const bypassToken = jwt.sign(bypassPayload, "wrong-secret", {
          expiresIn: "1h",
        });

        try {
          await axios.get(`${BASE_URL}/user/profile`, {
            headers: { Authorization: `Bearer ${bypassToken}` },
          });
          console.log("❌ VULNERABILITY: MFA bypass successful!");
        } catch (bypassError) {
          if (bypassError.response?.status === 401) {
            console.log("✅ SECURE: Fake token rejected");
          } else {
            console.log("⚠️  Unexpected error:", bypassError.response?.status);
          }
        }

        // ============================================
        // Step 2: Request MFA code
        // ============================================
        console.log("\n📝 Step 2: Please check your email for MFA code");
        console.log("   Email sent to: jonathanyeokk@gmail.com");

        // Prompt for MFA code
        const readline = require("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const mfaCode = await new Promise((resolve) => {
          rl.question("\n   Enter the 6-digit MFA code: ", (answer) => {
            rl.close();
            resolve(answer);
          });
        });

        console.log("\n📝 Step 3: Verifying MFA code...");

        // ============================================
        // Step 3: Verify MFA and get token
        // ============================================
        let validToken;
        try {
          const mfaRes = await axios.post(`${BASE_URL}/auth/verify-mfa`, {
            tempToken,
            code: mfaCode,
            login: true,
          });

          validToken = mfaRes.data.accessToken;
          console.log("✅ MFA verification successful");
          console.log(
            "   Token received:",
            validToken.substring(0, 50) + "..."
          );
        } catch (mfaError) {
          console.error("❌ MFA verification failed:", mfaError);
          return;
        }

        // ============================================
        // Test 2: Decode and analyze token
        // ============================================
        console.log("\n📝 Step 4: Analyzing valid token...");
        const decoded = jwt.decode(validToken);
        console.log("   Token payload:", JSON.stringify(decoded, null, 2));

        // ============================================
        // Test 3: Modify payload (privilege escalation)
        // ============================================
        console.log("\n🧪 Test 2: Privilege escalation with wrong secret");
        const maliciousPayload = {
          ...decoded,
          role: "admin",
        };

        const fakeToken = jwt.sign(maliciousPayload, "wrong-secret-key");

        try {
          await axios.get(`${BASE_URL}/admin/users`, {
            headers: { Authorization: `Bearer ${fakeToken}` },
          });
          console.log("❌ VULNERABILITY: Fake admin token accepted!");
        } catch (fakeError) {
          if (
            fakeError.response?.status === 401 ||
            fakeError.response?.status === 403
          ) {
            console.log("✅ SECURE: Fake token rejected");
          } else {
            console.log("⚠️  Unexpected error:", fakeError.response?.status);
          }
        }



        console.log('Test 3: Accessing endpoint with valid token but wrong privileges');

        try {
          await axios.get(`${BASE_URL}/admin/users`, {
            headers: { Authorization: `Bearer ${validToken}` },
          });
          console.log("❌ VULNERABILITY: User token accessed admin endpoint!");
        } catch (privError) {
          if (privError.response?.status === 403) {
            console.log("✅ SECURE: Access to admin endpoint correctly forbidden");
          } else {
            console.log("⚠️  Unexpected error:", privError.response?.status);
          }
        }

        // ============================================
        // Test 4: Expired token
        // ============================================
        console.log("\n🧪 Test 4: Expired token");
        const expiredToken = jwt.sign(
          {
            userId: decoded.id,
            role: "admin",
            exp: Math.floor(Date.now() / 1000) - 60 * 60, // 1 hour ago
          },
          process.env.JWT_SECRET
        );
        try {
          await axios.get(`${BASE_URL}/admin/users`, {
            headers: { Authorization: `Bearer ${expiredToken}` },
          });
          console.log("❌ VULNERABILITY: Expired token accepted!");
        } catch (expiredError) {
          if (expiredError.response?.status === 401) {
            console.log("✅ SECURE: Expired token rejected");
          } else {
            console.log("⚠️  Unexpected error:", expiredError.response?.status);
          }
        }

        // ============================================
        // Test 5: Token with modified expiry
        // ============================================
        console.log("\n🧪 Test 5: Token with extended expiry");
        const extendedToken = jwt.sign(
          {
            ...decoded,
            exp: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
          }, // 1 year
          process.env.JWT_SECRET
        );

        try {
          await axios.get(`${BASE_URL}/user/profile`, {
            headers: { Authorization: `Bearer ${extendedToken}` },
          });
          console.log("⚠️  WARNING: Extended expiry token accepted");
        } catch (extendedError) {
          if (extendedError.response?.status === 401) {
            console.log("✅ SECURE: Modified expiry rejected");
          }
        }

        // ============================================
        // Test 6: Malformed tokens
        // ============================================
        console.log("\n🧪 Test 6: Malformed tokens");
        const malformedTokens = [
          "not-a-jwt",
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature",
          "malicious-token",
          "",
        ];

        for (const badToken of malformedTokens) {
          try {
            await axios.get(`${BASE_URL}/user/profile`, {
              headers: { Authorization: `Bearer ${badToken}` },
            });
            console.log(`❌ VULNERABILITY: Accepted "${badToken}"`);
          } catch (badError) {
            if (badError.response?.status === 401) {
              console.log(`✅ SECURE: Rejected malformed token`);
            }
          }
        }

        // ============================================
        // Test 7: Token reuse after logout
        // ============================================
        console.log("\n🧪 Test 7: Token reuse after logout");

        // Logout
        try {
          await axios.post(
            `${BASE_URL}/auth/logout`,
            {},
            {
              headers: { Authorization: `Bearer ${validToken}` },
            }
          );
          console.log("   Logged out successfully");
        } catch (logoutError) {
          console.log("   Logout failed:", logoutError.response?.data);
        }

        // Try to use token after logout
        try {
          await axios.get(`${BASE_URL}/user/profile`, {
            headers: { Authorization: `Bearer ${validToken}` },
          });
          console.log(
            "❌ VULNERABILITY: Token works after logout (not blacklisted)"
          );
        } catch (reuseError) {
          if (reuseError.response?.status === 401) {
            console.log("✅ SECURE: Token blacklisted after logout");
          } else {
            console.log("⚠️  Unexpected error:", reuseError.response?.status);
          }
        }
      } else {
        // Login succeeded without MFA (MFA might be disabled)
        console.log("⚠️  WARNING: MFA not required for this account");
        validToken = initialLoginRes.data.token;

        // Continue with tests using the token
        const decoded = jwt.decode(validToken);
        console.log("   Token payload:", decoded);

        // Run basic tests
        await runBasicTests(validToken, decoded);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ JWT Security Testing Complete\n");
  } catch (error) {
    console.error("\n❌ Test Error:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
  }
}

// ============================================
// Helper: Run basic tests
// ============================================
async function runBasicTests(validToken, decoded) {
  console.log("\n🧪 Running basic JWT security tests...\n");

  // Test 1: Fake token
  console.log("Test 1: Fake token with wrong secret");
  const fakeToken = jwt.sign({ ...decoded, role: "admin" }, "wrong-secret");

  try {
    await axios.get(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${fakeToken}` },
    });
    console.log("❌ VULNERABILITY: Fake token accepted!");
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log("✅ SECURE: Fake token rejected\n");
    }
  }

  // Test 2: Expired token
  console.log("Test 2: Expired token");
  const expiredToken = jwt.sign(decoded, process.env.JWT_SECRET, {
    expiresIn: "-1h",
  });

  try {
    await axios.get(`${BASE_URL}/users/profile`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    console.log("❌ VULNERABILITY: Expired token accepted!");
  } catch (error) {
    if (error.response?.status === 401) {
      console.log("✅ SECURE: Expired token rejected\n");
    }
  }

  // Test 3: Valid token
  console.log("Test 3: Valid token (sanity check)");
  try {
    await axios.get(`${BASE_URL}/users/profile`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    console.log("✅ PASS: Valid token works correctly\n");
  } catch (error) {
    console.log("❌ FAIL: Valid token rejected\n");
  }
}

// Run the test
testJWTManipulation().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
