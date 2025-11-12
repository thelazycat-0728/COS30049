/**
 * Observation Update (PUT /observations/:id) Tests
 * - Only provided fields are included in SQL SET; updated_at always included
 * - verified_by set only when status is verified (or when explicitly provided)
 * - Lat/lon updates persist and validate ranges
 * - No updates supplied returns 400
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

function signToken({ user_id, role = 'expert', email = 'expert@example.com' }) {
  return jwt.sign(
    { id: Number(user_id), email, role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

// Mock TokenBlacklist: no tokens are blacklisted
jest.mock('../../backend/src/models/TokenBlacklist.js', () => ({
  isBlacklisted: jest.fn(async () => false),
}));

// Mock User model to satisfy requireAuth user existence check
jest.mock('../../backend/src/models/User.js', () => ({
  findById: jest.fn(async (id) => ({ user_id: Number(id), username: 'expertuser', role: 'expert', email: 'expert@example.com' })),
}));

// Mock StorageService for optional image upload (not used in these tests)
jest.mock('../../backend/src/services/storageService', () => ({
  uploadImage: jest.fn(async () => '/uploads/new-image.jpg'),
}));

// Mock DB pool with query/execute to capture update SQL and support lookups
jest.mock('../../backend/src/config/database.js', () => {
  const state = { calls: [], lastUpdate: null };
  const execute = jest.fn(async (query, params) => {
    state.calls.push({ kind: 'execute', query, params });
    // Plant existence check
    if (/SELECT\s+plant_id\s+FROM\s+Plants\s+WHERE\s+plant_id\s*=\s*\?/i.test(query)) {
      const plantId = Array.isArray(params) ? Number(params[0]) : NaN;
      if (plantId === 99) return [[{ plant_id: 99 }], []];
      return [[/* no plant */], []];
    }
    // Toggle/touch queries
    return [[{ affectedRows: 0 }], []];
  });
  const query = jest.fn(async (sql, params) => {
    state.calls.push({ kind: 'query', query: sql, params });
    // Observation.findById
    if (/FROM\s+PlantObservations\s+o/i.test(sql) && /WHERE\s+o\.observation_id\s*=\s*\?/i.test(sql)) {
      return [[{
        observation_id: params[0],
        user_id: 42,
        plant_id: 31,
        image_url: '/uploads/old.jpg',
        confidence_score: 0.3,
        latitude: -37.8,
        longitude: 144.9,
        status: 'pending',
        observation_date: '2024-01-02',
        created_at: '2024-01-02',
      }]];
    }
    // Observation.update -> capture SQL and return success
    if (/^UPDATE\s+PlantObservations\s+SET\s+/i.test(sql)) {
      state.lastUpdate = { sql, params };
      return [{ affectedRows: 1 }];
    }
    return [[[]]];
  });
  const __getState = () => ({ ...state });
  const __reset = () => { state.calls = []; state.lastUpdate = null; };
  return { execute, query, __getState, __reset };
});

// Import app after mocks
const app = require('../../backend/src/app.js');

describe('PUT /observations/:id - Field update behavior', () => {
  beforeEach(() => {
    const pool = require('../../backend/src/config/database.js');
    pool.__reset();
  });

  it('includes only provided fields in SQL SET and always updated_at', async () => {
    const token = signToken({ user_id: 42, role: 'expert' });
    const res = await request(app)
      .put('/observations/777')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'verified', public: '1' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });

    const pool = require('../../backend/src/config/database.js');
    const st = pool.__getState();
    expect(st.lastUpdate).toBeTruthy();
    const { sql, params } = st.lastUpdate;
    // Expect SET to include status, public, verified_by, updated_at
    expect(sql).toMatch(/SET\s+[^;]*status\s*=\s*\?[^;]*,/i);
    expect(sql).toMatch(/SET\s+[^;]*public\s*=\s*\?[^;]*,/i);
    expect(sql).toMatch(/SET\s+[^;]*verified_by\s*=\s*\?[^;]*,/i);
    expect(sql).toMatch(/updated_at\s*=\s*NOW\(\)/i);
    // No plant_id or image_url or confidence_score when not provided
    expect(sql).not.toMatch(/plant_id\s*=\s*\?/i);
    expect(sql).not.toMatch(/image_url\s*=\s*\?/i);
    expect(sql).not.toMatch(/confidence_score\s*=\s*\?/i);
    // Params: [status, publicValue, verified_by, observation_id]
    expect(Array.isArray(params)).toBe(true);
    // Last param is observation_id (string or number)
    expect(String(params[params.length - 1])).toBe('777');
  });

  it('does not set verified_by when status is not verified and not provided', async () => {
    const token = signToken({ user_id: 42, role: 'expert' });
    const res = await request(app)
      .put('/observations/778')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'pending', public: '0' });

    expect(res.status).toBe(200);
    const pool = require('../../backend/src/config/database.js');
    const st = pool.__getState();
    const { sql } = st.lastUpdate;
    expect(sql).toMatch(/status\s*=\s*\?/i);
    expect(sql).toMatch(/public\s*=\s*\?/i);
    expect(sql).not.toMatch(/verified_by\s*=\s*\?/i);
  });

  it('latitude/longitude valid updates persist; out-of-range returns 400', async () => {
    const token = signToken({ user_id: 42, role: 'expert' });
    // Valid lat/lon
    const ok = await request(app)
      .put('/observations/779')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: '-12.34', longitude: '99.1' });
    expect(ok.status).toBe(200);
    const pool = require('../../backend/src/config/database.js');
    const st = pool.__getState();
    expect(st.lastUpdate.sql).toMatch(/latitude\s*=\s*\?/i);
    expect(st.lastUpdate.sql).toMatch(/longitude\s*=\s*\?/i);
    // Now out-of-range lat
    const badLat = await request(app)
      .put('/observations/780')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: '95.0' });
    expect(badLat.status).toBe(400);
    expect(badLat.body).toMatchObject({ success: false });
    // Out-of-range lon
    const badLon = await request(app)
      .put('/observations/781')
      .set('Authorization', `Bearer ${token}`)
      .send({ longitude: '-181' });
    expect(badLon.status).toBe(400);
    expect(badLon.body.success).toBe(false);
  });

  it('returns 400 when no recognized update fields are supplied', async () => {
    const token = signToken({ user_id: 42, role: 'expert' });
    const res = await request(app)
      .put('/observations/782')
      .set('Authorization', `Bearer ${token}`)
      .send({ foo: 'bar' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: expect.stringMatching(/No fields to update/i) });
  });
});