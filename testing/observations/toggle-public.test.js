/**
 * Observation Public Flag Toggle Tests
 * Covers:
 * - Toggle public on (admin)
 * - Toggle public off (admin)
 * - Authorization required (non-admin/expert)
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

// Helper to sign JWTs
function signToken({ user_id, role = 'admin', email = 'admin@example.com' }) {
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

// Mock User model to satisfy requireAuth and role checks
jest.mock('../../backend/src/models/User.js', () => ({
  findById: jest.fn(async (id) => {
    const num = Number(id);
    if (num === 1) {
      return { user_id: 1, username: 'admin', role: 'admin', email: 'admin@example.com' };
    }
    if (num === 12) {
      return { user_id: 12, username: 'regular', role: 'user', email: 'user@example.com' };
    }
    return { user_id: num, username: 'user', role: 'expert', email: 'user@example.com' };
  }),
}));

// Mock DB pool to capture public flag updates
jest.mock('../../backend/src/config/database.js', () => {
  const state = { public: null, lastId: null };
  const execute = jest.fn(async (query, params) => {
    if (query.includes('UPDATE PlantObservations SET public = ?')) {
      state.public = params[0];
      state.lastId = params[1];
      return [ { affectedRows: 1 }, [] ];
    }
    return [ { affectedRows: 0 }, [] ];
  });
  const __getState = () => ({ ...state });
  const __reset = () => { state.public = null; state.lastId = null; };
  return { execute, __getState, __reset };
});

// Import app after mocks
const app = require('../../backend/src/app.js');

describe('PATCH /observations/:id/public toggles public flag', () => {
  beforeEach(() => {
    const pool = require('../../backend/src/config/database.js');
    pool.__reset();
  });

  it('Toggle public flag on (admin)', async () => {
    const token = signToken({ user_id: 1, role: 'admin' });

    const res = await request(app)
      .patch('/observations/123/public')
      .set('Authorization', `Bearer ${token}`)
      .send({ public: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, observation_id: 123, public: true });

    const pool = require('../../backend/src/config/database.js');
    const st = pool.__getState();
    expect(st.public).toBe(1);
    expect(st.lastId).toBe(123);
  });

  it('Toggle public flag off (admin)', async () => {
    const token = signToken({ user_id: 1, role: 'admin' });

    const res = await request(app)
      .patch('/observations/123/public')
      .set('Authorization', `Bearer ${token}`)
      .send({ public: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, observation_id: 123, public: false });

    const pool = require('../../backend/src/config/database.js');
    const st = pool.__getState();
    expect(st.public).toBe(0);
    expect(st.lastId).toBe(123);
  });

  it('Authorization required for public toggle (non-admin/expert)', async () => {
    const token = signToken({ user_id: 12, role: 'user' });

    const res = await request(app)
      .patch('/observations/123/public')
      .set('Authorization', `Bearer ${token}`)
      .send({ public: true });

    expect(res.status).toBe(403);
    // From requireRole middleware
    expect(res.body).toMatchObject({ success: false, error: 'Access denied. Required role: expert or admin' });

    const pool = require('../../backend/src/config/database.js');
    const st = pool.__getState();
    expect(st.public).toBeNull();
    expect(st.lastId).toBeNull();
  });
});