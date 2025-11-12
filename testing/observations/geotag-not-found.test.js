/**
 * Observation Geotag - Not Found Scenario
 * Ensures DELETE /observations/:id/geotag returns 404 when DB reports no rows updated.
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
    if (Number(id) === 42) {
      return { user_id: 42, username: 'expertuser', role: 'expert', email: 'expert@example.com' };
    }
    return null;
  }),
}));

// Mock DB pool: for geotag removal, return affectedRows=0 to simulate nonexistent id
jest.mock('../../backend/src/config/database.js', () => {
  const state = { calls: [] };
  const execute = jest.fn(async (query, params) => {
    state.calls.push({ query, params });
    if (query.includes('UPDATE PlantObservations SET latitude = NULL, longitude = NULL')) {
      return [ { affectedRows: 0 }, [] ];
    }
    return [ { affectedRows: 0 }, [] ];
  });
  const __getState = () => ({ ...state });
  const __reset = () => { state.calls = []; };
  return { execute, __getState, __reset };
});

// Import app after mocks
const app = require('../../backend/src/app.js');

describe('DELETE /observations/:id/geotag - Geotag not found', () => {
  beforeEach(() => {
    const pool = require('../../backend/src/config/database.js');
    pool.__reset();
  });

  it('returns 404 when observation id does not exist', async () => {
    const token = signToken({ user_id: 42 });

    const res = await request(app)
      .delete('/observations/999999/geotag')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'Observation not found' });

    const pool = require('../../backend/src/config/database.js');
    const st = pool.__getState();
    expect(st.calls.length).toBeGreaterThan(0);
    const geotagCall = st.calls.find(c => c.query.includes('UPDATE PlantObservations SET latitude = NULL, longitude = NULL'));
    expect(geotagCall).toBeDefined();
    expect(geotagCall.params[0]).toBe(999999);
  });
});