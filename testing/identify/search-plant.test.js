/**
 * Identify: Search Plant by Name
 * - Returns plant for given scientific name
 * - No match returns { success: true, found: false }
 * - Missing query param returns 400 with validation error
 */

const request = require('supertest');

// Mock DB pool to avoid real MySQL connections
jest.mock('../../backend/src/config/database', () => ({
  execute: jest.fn(),
  query: jest.fn(),
}));

// Import app after mocks
const app = require('../../backend/src/app.js');

describe('GET /identify/search-plant', () => {
const pool = require('../../backend/src/config/database');

  afterEach(() => {
    pool.execute.mockReset();
    pool.query.mockReset();
  });

  it('Returns plant for a given scientific name', async () => {
    // Simulate DB returning a match
    pool.execute.mockResolvedValueOnce([
      [{ plant_id: 7, scientific_name: 'Rosa rubiginosa' }],
    ]);

    const res = await request(app)
      .get('/identify/search-plant')
      .query({ plantName: 'Rosa rubiginosa' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, found: true, plant: { plant_id: 7, scientific_name: 'Rosa rubiginosa' } });
  });

  it('No match returns found:false', async () => {
    // Simulate DB returning no rows
    pool.execute.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .get('/identify/search-plant')
      .query({ plantName: 'Nonexistent Plantus' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, found: false });
  });

  it('Missing query param returns 400', async () => {
    const res = await request(app)
      .get('/identify/search-plant');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, message: 'Plant name is required' });
  });
});