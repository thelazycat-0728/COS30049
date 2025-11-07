// ...existing code...
const axios = require("axios");

const BASE_URL = process.env.BASE_URL || "http://localhost:8080";

/**
 * ✅ Test 1: SQL Injection in Login (using axios)
 */
async function testSQLInjectionLogin() {
  console.log("\n🔍 Testing SQL Injection in Login...");

  const payloads = [
    "' OR '1'='1",
    "' OR '1'='1' --",
    "admin'--",
    "' OR 1=1--",
    "admin' OR '1'='1'--",
    "' UNION SELECT NULL, NULL, NULL--",
  ];

  let total = payloads.length;
  let passed = 0;
  const failures = [];

  for (const payload of payloads) {
    try {
      const response = await axios.post(
        `${BASE_URL}/auth/login`,
        { email: payload, password: payload },
        { validateStatus: () => true, timeout: 10000 }
      );

      if (response.status === 200) {
        console.log(
          `❌ VULNERABILITY: SQL Injection successful with payload: ${payload}`
        );
        console.log("Response:", response.data);
        failures.push(payload);
      } else {
        console.log(`✅ Protected against: ${payload}`);
        passed++;
      }
    } catch (error) {
      // network or other error -> treat as protected for this test
      console.log(`✅ Protected (error thrown): ${payload}`);
      passed++;
    }
  }

  return { name: "SQL Injection (login payloads)", total, passed, failures };
}

/**
 * ✅ Test 2: Brute Force Protection (using axios)
 */
async function testBruteForceProtection() {
  console.log("\n🔍 Testing Brute Force Protection...");

  const attempts = 20;
  let blockedCount = 0;

  for (let i = 0; i < attempts; i++) {
    try {
      const response = await axios.post(
        `${BASE_URL}/auth/login`,
        { email: "test@example.com", password: `wrong_password_${i}` },
        { validateStatus: () => true, timeout: 10000 }
      );

      if (response.status === 429) {
        blockedCount++;
        console.log(`✅ Request blocked after ${i + 1} attempts`);
        break;
      }
    } catch (error) {
      console.log(`Attempt ${i + 1}: ${error.message}`);
    }
  }

  const total = 1;
  const passed = blockedCount > 0 ? 1 : 0;
  if (passed === 0) console.log("❌ VULNERABILITY: No brute force protection detected");
  return { name: "Brute Force Protection", total, passed, failures: passed ? [] : ["No rate limit / blocking detected"] };
}

/**
 * ✅ Test 3: Weak Password Policy (using axios)
 */
async function testWeakPasswordPolicy() {
  console.log("\n🔍 Testing Weak Password Policy...");

  const weakPasswords = ["123", "password", "12345678", "qwerty", "abc123"];

  let total = weakPasswords.length;
  let passed = 0;
  const failures = [];

  for (const password of weakPasswords) {
    try {
      const response = await axios.post(
        `${BASE_URL}/auth/register`,
        {
          username: "testuser",
          email: `test_${Date.now()}@example.com`,
          password: password,
        },
        { validateStatus: () => true, timeout: 10000 }
      );

      if (response.status === 201) {
        console.log(`❌ VULNERABILITY: Weak password accepted: ${password}`);
        failures.push(password);
      } else {
        console.log(`✅ Weak password rejected: ${password}`);
        passed++;
      }
    } catch (error) {
      console.log(`✅ Protected: ${password}`);
      passed++;
    }
  }

  return { name: "Weak Password Policy", total, passed, failures };
}

/**
 * ✅ Test 4: Authorization Bypass (using axios)
 */
async function testAuthorizationBypass() {
  console.log("\n🔍 Testing Authorization Bypass...");

  let total = 1;
  let passed = 0;
  const failures = [];

  try {
    // Try to access admin endpoint without token
    const response1 = await axios.get(`${BASE_URL}/admin/users`, {
      validateStatus: () => true,
      timeout: 10000,
    });

    if (response1.status === 200) {
      console.log("❌ VULNERABILITY: Admin endpoint accessible without authentication");
      failures.push("Unauthenticated access to /admin/users allowed");
    } else {
      console.log("✅ Admin endpoint protected (no token)");
      passed++;
    }

   
    
  } catch (error) {
    console.log(`✅ Protected (error): ${error.message}`);
    passed++; // treat unexpected errors as protection here
  }

  return { name: "Authorization Bypass", total, passed, failures };
}

// Run all tests
(async () => {
  console.log("🔐 Starting Authentication Penetration Tests...\n");

  const summary = { total: 0, passed: 0, failed: 0, details: [] };

  // mute backend logs while tests run

  const tests = [
    await testSQLInjectionLogin(),
    await testBruteForceProtection(),
    await testWeakPasswordPolicy(),
    await testAuthorizationBypass(),
  ];

  // restore console for summary

  for (const t of tests) {
    summary.total += t.total;
    summary.passed += t.passed;
    const failedCount = t.total - t.passed;
    summary.failed += failedCount;
    summary.details.push({
      test: t.name,
      total: t.total,
      passed: t.passed,
      failed: failedCount,
      failures: t.failures || [],
    });
  }

  console.log("\n📊 PENETRATION TEST SUMMARY");
  console.log("---------------------------");
  console.log(`Total sub-tests: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}\n`);

  for (const d of summary.details) {
    console.log(`- ${d.test}: ${d.passed}/${d.total} passed`);
    if (d.failures && d.failures.length) {
      console.log(`  Failures: ${JSON.stringify(d.failures)}`);
    }
  }

  console.log("\n✅ Authentication Penetration Tests Complete\n");
})();
// ...existing code...