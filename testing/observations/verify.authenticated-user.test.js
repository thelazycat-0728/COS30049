/**
 * Scenario: Verify sets verified_by to authenticated user
 * - Mocks a valid JWT with id=42 and role=expert
 * - Mocks DB lookups and Observation.update
 * - Sends PUT /observations/123 with { status: 'verified' }
 * - Expects Observation.update called with verifiedBy=42 and 200 response
 * - Confirms mocked DB row verified_by becomes 42
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');

// Ensure JWT secret for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

// Helper to sign a JWT for a given user id and role
function signToken({ user_id, role = 'expert', email = 'user@example.com' }) {
  return jwt.sign(
    { id: Number(user_id), email, role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

// Resolve paths relative to the COS30049 repo to avoid absolute path issues
const ROOT = path.resolve(__dirname, '..');

// Mock upload middleware to no-op (avoid multer expecting multipart)
jest.mock('../../backend/src/middleware/upload.js', () => {
  return {
    single: () => (req, res, next) => {
      req.file = undefined; // no image in this scenario
      return next();
    },
  };
});

// Mock TokenBlacklist: no tokens are blacklisted
jest.mock('../../backend/src/models/TokenBlacklist.js', () => ({
  isBlacklisted: jest.fn(async () => false),
}));

// Mock User model to satisfy requireAuth user existence check
jest.mock('../../backend/src/models/User.js', () => ({
  findById: jest.fn(async (id) => {
    if (Number(id) === 42) {
      return {
        user_id: 42,
        username: 'expertuser',
        email: 'expert@example.com',
        role: 'expert',
      };
    }
    return null;
  }),
}));

// Mock Observation model without referencing out-of-scope variables
jest.mock('../../backend/src/models/Observation.js', () => {
  const dbRow = { verified_by: null, status: 'pending' };
  const update = jest.fn(async (id, updateData) => {
    // Simulate DB update side effects
    if (updateData?.verifiedBy !== undefined) {
      dbRow.verified_by = Number(updateData.verifiedBy);
    }
    if (updateData?.status) {
      dbRow.status = updateData.status;
    }
    return true; // indicate success
  });
  const findById = jest.fn(async (id) => {
    if (String(id) === '123') {
      return { observation_id: 123, status: 'pending', user_id: 1001 };
    }
    return null;
  });
  const __getRow = () => ({ ...dbRow });
  const __resetRow = () => { dbRow.verified_by = null; dbRow.status = 'pending'; };
  return { findById, update, __getRow, __resetRow };
});

// Import the app after mocks are set up
const app = require('../../backend/src/app.js');

describe('PUT /observations/:id verification sets verified_by to authenticated user', () => {
  beforeEach(() => {
    // Reset mock state between tests
    const Observation = require('../../backend/src/models/Observation.js');
    Observation.update.mockClear();
    Observation.__resetRow();
    const User = require('../../backend/src/models/User.js');
    User.findById.mockReset();
    User.findById.mockImplementation(async (id) => {
      if (Number(id) === 42) {
        return {
          user_id: 42,
          username: 'expertuser',
          email: 'expert@example.com',
          role: 'expert',
        };
      }
      return null;
    });
  });

  it('sets verified_by to req.user.id (42) when status=verified and no explicit verifiedBy provided', async () => {
    // Create a valid expert JWT with 15m expiry
    const token = jwt.sign(
      { id: 42, email: 'expert@example.com', role: 'expert' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Perform the update
    const res = await request(app)
      .put('/observations/123')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'verified' })
      .expect(200);

    // Response expectations
    expect(res.body).toBeDefined();
    expect(res.body.success).toBe(true);

    const Observation = require('../../backend/src/models/Observation.js');
    // Observation.update called with verifiedBy=42 and status=verified
    expect(Observation.update).toHaveBeenCalledTimes(1);
    const [calledId, payload] = Observation.update.mock.calls[0];
    expect(calledId).toBe('123');
    expect(payload).toMatchObject({ status: 'verified', verifiedBy: 42 });

    // Confirm mocked DB row reflects verified_by=42
    const row = Observation.__getRow();
    expect(row.verified_by).toBe(42);
    expect(row.status).toBe('verified');
  });

  it('respects provided verifiedBy when status is verified', async () => {
    const token = signToken({ user_id: 42 });

    const res = await request(app)
      .put('/observations/123')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'verified', verifiedBy: 99 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });

    const Observation = require('../../backend/src/models/Observation.js');
    expect(Observation.update).toHaveBeenCalledTimes(1);
    const [calledId, payload] = Observation.update.mock.calls[0];
    expect(calledId).toBe('123');
    expect(payload).toMatchObject({ status: 'verified', verifiedBy: 99 });

    const row = Observation.__getRow();
    expect(row.verified_by).toBe(99);
    expect(row.status).toBe('verified');
  });

  it('non-verified status does not set verified_by', async () => {
    const token = signToken({ user_id: 42 });

    const res = await request(app)
      .put('/observations/123')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'pending' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });

    const Observation = require('../../backend/src/models/Observation.js');
    expect(Observation.update).toHaveBeenCalledTimes(1);
    const [, payload] = Observation.update.mock.calls[0];
    expect(payload).toMatchObject({ status: 'pending' });
    expect(payload).not.toHaveProperty('verifiedBy');

    const row = Observation.__getRow();
    expect(row.verified_by).toBeNull();
    expect(row.status).toBe('pending');
  });

  it('requires admin or expert authorization', async () => {
    const User = require('../../backend/src/models/User.js');
    // Return a normal user for id=12
    User.findById.mockImplementationOnce(async (id) => {
      if (Number(id) === 12) {
        return { user_id: 12, username: 'regular', role: 'user' };
      }
      return null;
    });

    const token = signToken({ user_id: 12, role: 'user' });

    const res = await request(app)
      .put('/observations/123')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'verified' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, error: 'Access denied. Required role: expert or admin' });

    const Observation = require('../../backend/src/models/Observation.js');
    expect(Observation.update).not.toHaveBeenCalled();
  });

  it('invalid observation id returns not found (404)', async () => {
    const token = signToken({ user_id: 42 });

    const res = await request(app)
      .put('/observations/abc')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'verified' });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'Observation not found' });

    const Observation = require('../../backend/src/models/Observation.js');
    expect(Observation.update).not.toHaveBeenCalled();
  });
});