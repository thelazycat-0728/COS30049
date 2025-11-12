/**
 * Identify: Submit Observation
 * - Successful submission with auth token
 * - Missing image_url validation
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Ensure JWT secret is set for optionalAuth
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

function signToken({ user_id, role = 'user', email = 'user@example.com' }) {
  return jwt.sign(
    { id: Number(user_id), email, role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

// Mock DB pool: capture INSERT for PlantObservations and return insertId
jest.mock('../../backend/src/config/database.js', () => {
  const state = { calls: [] };
  const execute = jest.fn(async (query, params) => {
    state.calls.push({ query, params });
    if (query.includes('INSERT INTO PlantObservations')) {
      return [ { insertId: 555 }, [] ];
    }
    return [ { insertId: 0 }, [] ];
  });
  const query = jest.fn(async (query, params) => {
    state.calls.push({ query, params });
    // In this test we always provide plant_id to avoid SELECT Plants
    return [ [], [] ];
  });
  const __getState = () => ({ ...state });
  const __reset = () => { state.calls = []; };
  return { execute, query, __getState, __reset };
});

// Import app after mocks
const app = require('../../backend/src/app.js');

describe('POST /identify/submit-observation', () => {
  beforeEach(() => {
    const pool = require('../../backend/src/config/database.js');
    pool.__reset();
  });

  it('Successful submission with auth token', async () => {
    const token = signToken({ user_id: 77 });

    const payload = {
      image_url: '/uploads/test.jpg',
      plant_id: 5,
      lat: -37.8136,
      lon: 144.9631,
      status: 'pending',
      confidence_score: 0.85,
    };

    const res = await request(app)
      .post('/identify/submit-observation')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      observationId: 555,
      image_url: payload.image_url,
      coordinates: { lat: payload.lat, lon: payload.lon },
      confidence_score: 0.85,
      message: expect.stringContaining('Observation saved successfully'),
    });

    const pool = require('../../backend/src/config/database.js');
    const st = pool.__getState();
    const insertCall = st.calls.find(c => c.query.includes('INSERT INTO PlantObservations'));
    expect(insertCall).toBeDefined();
    const params = insertCall.params;
    expect(params[0]).toBe(77); // user_id
    expect(params[1]).toBe(5); // plant_id
    expect(params[2]).toBe('/uploads/test.jpg'); // image_url
    expect(params[3]).toBeCloseTo(-37.8136); // latitude
    expect(params[4]).toBeCloseTo(144.9631); // longitude
    expect(params[5]).toBe('pending'); // status
    expect(params[6]).toBeCloseTo(0.85); // confidence_score (normalized)
  });

  it('Missing image_url returns 400', async () => {
    const token = signToken({ user_id: 77 });

    const res = await request(app)
      .post('/identify/submit-observation')
      .set('Authorization', `Bearer ${token}`)
      .send({ plant_id: 5, lat: -1, lon: 1, status: 'pending', confidence_score: 0.5 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'image_url is required' });

    const pool = require('../../backend/src/config/database.js');
    const st = pool.__getState();
    // No INSERT should have occurred
    const insertCall = st.calls.find(c => c.query.includes('INSERT INTO PlantObservations'));
    expect(insertCall).toBeUndefined();
  });

  it('Uses user_id from auth when both auth and body are provided', async () => {
    const token = signToken({ user_id: 101 });

    const payload = {
      image_url: '/uploads/test.jpg',
      plant_id: 5,
      user_id: 999,
      lat: -1,
      lon: 1,
      status: 'pending',
      confidence_score: 0.5,
    };

    const res = await request(app)
      .post('/identify/submit-observation')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(200);
    const pool = require('../../backend/src/config/database.js');
    const st = pool.__getState();
    const insertCall = st.calls.find(c => c.query.includes('INSERT INTO PlantObservations'));
    expect(insertCall).toBeDefined();
    expect(insertCall.params[0]).toBe(101); // user_id from auth overrides body
  });

  it('Parses lat/lon numeric strings and returns googleMapsUrl when both present', async () => {
    const token = signToken({ user_id: 77 });

    const res = await request(app)
      .post('/identify/submit-observation')
      .set('Authorization', `Bearer ${token}`)
      .send({
        image_url: '/uploads/loc.jpg',
        plant_id: 5,
        lat: '12.34',
        lon: '56.78',
        status: 'pending',
        confidence_score: 0.5,
      });

    expect(res.status).toBe(200);
    expect(res.body.coordinates).toEqual({ lat: 12.34, lon: 56.78 });
    expect(res.body.googleMapsUrl).toBe('https://maps.google.com/?q=12.34,56.78');
  });

  it('Normalizes confidence_score percentage to fraction in response', async () => {
    const token = signToken({ user_id: 77 });

    const res = await request(app)
      .post('/identify/submit-observation')
      .set('Authorization', `Bearer ${token}`)
      .send({
        image_url: '/uploads/score.jpg',
        plant_id: 5,
        lat: 1,
        lon: 2,
        confidence_score: 85,
      });

    expect(res.status).toBe(200);
    expect(res.body.confidence_score).toBeCloseTo(0.85, 2);
  });

  it('Normalizes confidence_score > 100 to 1.00 in response', async () => {
    const token = signToken({ user_id: 77 });

    const res = await request(app)
      .post('/identify/submit-observation')
      .set('Authorization', `Bearer ${token}`)
      .send({
        image_url: '/uploads/score-max.jpg',
        plant_id: 5,
        lat: 1,
        lon: 2,
        confidence_score: 150,
      });

    expect(res.status).toBe(200);
    expect(res.body.confidence_score).toBe(1);
  });

  it('DB insert failure returns 500 with error message', async () => {
    const token = signToken({ user_id: 77 });
    const pool = require('../../backend/src/config/database.js');
    pool.execute.mockImplementationOnce(() => { throw new Error('DB insert failed'); });

    const res = await request(app)
      .post('/identify/submit-observation')
      .set('Authorization', `Bearer ${token}`)
      .send({
        image_url: '/uploads/error.jpg',
        plant_id: 5,
        lat: 1,
        lon: 2,
        confidence_score: 0.5,
      });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Failed to save observation' });
  });

  it('Currently accepts out-of-range lat/lon (recommend validation)', async () => {
    const token = signToken({ user_id: 77 });

    const res = await request(app)
      .post('/identify/submit-observation')
      .set('Authorization', `Bearer ${token}`)
      .send({
        image_url: '/uploads/coords.jpg',
        plant_id: 5,
        lat: 200,
        lon: 300,
        confidence_score: 0.5,
      });

    expect(res.status).toBe(200);
    expect(res.body.coordinates).toEqual({ lat: 200, lon: 300 });
    expect(res.body.googleMapsUrl).toBe('https://maps.google.com/?q=200,300');
  });
});