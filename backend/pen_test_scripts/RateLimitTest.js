// Comprehensive Rate-Limit / Brute Force Penetration Test
// Usage: node rateLimitPenTest.js [BASE_URL] [USERNAME] [BASE_PASSWORD] [ATTEMPTS]
// Default BASE_URL: http://localhost:8080

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = process.argv[2] || process.env.BASE_URL || 'http://localhost:8080';
const USERNAME = process.argv[3] || process.env.PEN_TEST_USER || 'test@example.com';
const BASE_PASSWORD = process.argv[4] || 'wrongpassword';
const ATTEMPTS = parseInt(process.argv[5] || '30', 10);

async function attemptLogin(i) {
    try {
        const res = await axios.post(`${BASE_URL}/auth/login`, { email: USERNAME, password: `${BASE_PASSWORD}${i}` }, { validateStatus: () => true });
        return { i, status: res.status, data: res.data };
    } catch (err) {
        return { i, error: err.message };
    }
}

async function run() {
    console.log(`\n🔐 Rate-Limit Penetration Test against ${BASE_URL}/auth/login`);
    let blockedAt = null;
    const statuses = {};

    for (let i = 1; i <= ATTEMPTS; i++) {
        const r = await attemptLogin(i);
        const s = r.status || 'error';
        statuses[s] = (statuses[s] || 0) + 1;
        console.log(`   Attempt ${i}: ${s} ${r.data && r.data.message ? '- ' + r.data.message : ''}`);
        if (r.status === 429 && !blockedAt) {
            blockedAt = i;
            console.log(`   ✅ Rate limit triggered at attempt ${i}`);
            break;
        }
    }

    console.log('\n📊 Rate-Limit Summary');
    console.log(' - Status counts:', statuses);
    if (!blockedAt) console.log(' - No 429 detected in attempts run; server may not expose rate-limiting or uses other signals.');

    console.log('\n✅ Rate-limit testing complete.');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
