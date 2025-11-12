/**
 * Observation Geotag Authorization and Success Tests
 * Covers DELETE /observations/:id/geotag success for admin/expert and 403 for regular users.
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
  findById: jest.fn(async (id) => {
    const map = {
      1: { user_id: 1, username: 'admin', role: 'admin', email: 'admin@example.com' },
      2: { user_id: 2, username: 'expert', role: 'expert', email: 'expert@example.com' },
      3: { user_id: 3, username: 'user', role: 'user', email: 'user@example.com' },
    };
    return map[Number(id)] || null;
  }),
}));

// Mock DB pool: for geotag removal, return affectedRows=1 to simulate successful update
jest.mock('../../backend/src/config/database.js', () => {
  const state = { calls: [] };
  const execute = jest.fn(async (query, params) => {
    state.calls.push({ query, params });
    if (query.includes('UPDATE PlantObservations SET latitude = NULL, longitude = NULL')) {
      return [ { affectedRows: 1 }, [] ];
    }
    // Fallback for other queries used by middleware/controllers
    return [ { affectedRows: 0 }, [] ];
  });
  const __getState = () => ({ ...state });
  const __reset = () => { state.calls = []; };
  return { execute, __getState, __reset };
});

// Import app after mocks
const app = require('../../backend/src/app.js');

describe('DELETE /observations/:id/geotag - Authorization and Success', () => {
  beforeEach(() => {
    const pool = require('../../backend/src/config/database.js');
    pool.__reset();
  });

  it('admin succeeds with 200 when affectedRows > 0', async () => {
    const token = signToken({ user_id: 1, role: 'admin' });
    const res = await request(app)
      .delete('/observations/123/geotag')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    const pool = require('../../backend/src/config/database.js');
    const st = pool.__getState();
    const geotagCall = st.calls.find(c => c.query.includes('UPDATE PlantObservations SET latitude = NULL, longitude = NULL'));
    expect(geotagCall).toBeDefined();
    expect(geotagCall.params[0]).toBe(123);
  });

  it('expert succeeds with 200 when affectedRows > 0', async () => {
    const token = signToken({ user_id: 2, role: 'expert' });
    const res = await request(app)
      .delete('/observations/456/geotag')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    const pool = require('../../backend/src/config/database.js');
    const st = pool.__getState();
    const geotagCall = st.calls.find(c => c.query.includes('UPDATE PlantObservations SET latitude = NULL, longitude = NULL'));
    expect(geotagCall).toBeDefined();
    expect(geotagCall.params[0]).toBe(456);
  });

  it('regular user gets 403', async () => {
    const token = signToken({ user_id: 3, role: 'user' });
    const res = await request(app)
      .delete('/observations/789/geotag')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false });
  });
});