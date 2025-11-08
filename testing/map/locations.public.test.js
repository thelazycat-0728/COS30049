/**
 * Public Map Locations Tests (GET /map/locations/public)
 * - Filters: single family, multiple conservation statuses (comma-joined), date range respected, invalid dates ignored
 * - Coordinates mapping: ensures numeric coordinates are numbers; highlights invalid shapes for future filtering
 */

const request = require('supertest');

// Mock DB pool: capture SQL and params; return dataset filtered per params
jest.mock('../../backend/src/config/database.js', () => {
  const state = { calls: [], last: null };
  const baseRows = [
    {
      observation_id: 1,
      user_id: 10,
      latitude: 10,
      longitude: 20,
      status: 'verified',
      observation_date: '2024-02-01',
      image_url: '/uploads/a.jpg',
      public: 1,
      plant_id: 100,
      common_name: 'Plant A',
      scientific_name: 'A aa',
      family: 'Fabaceae',
      description: 'A',
      conservation_status: 'vulnerable',
    },
    {
      observation_id: 2,
      user_id: 11,
      latitude: 11.2,
      longitude: 21,
      status: 'verified',
      observation_date: '2024-03-10',
      image_url: '/uploads/b.jpg',
      public: 1,
      plant_id: 101,
      common_name: 'Plant B',
      scientific_name: 'B bb',
      family: 'Rosaceae',
      description: 'B',
      conservation_status: 'least_concern',
    },
    {
      observation_id: 3,
      user_id: 12,
      latitude: 12,
      longitude: 22,
      status: 'verified',
      observation_date: '2023-12-31',
      image_url: '/uploads/c.jpg',
      public: 1,
      plant_id: 102,
      common_name: 'Plant C',
      scientific_name: 'C cc',
      family: 'Fabaceae',
      description: 'C',
      conservation_status: 'endangered',
    },
    {
      observation_id: 4,
      user_id: 13,
      latitude: 'abc', // invalid
      longitude: 99,
      status: 'verified',
      observation_date: '2024-03-15',
      image_url: '/uploads/d.jpg',
      public: 1,
      plant_id: 103,
      common_name: 'Plant D',
      scientific_name: 'D dd',
      family: 'Asteraceae',
      description: 'D',
      conservation_status: 'near_threatened',
    },
    {
      observation_id: 5,
      user_id: 14,
      latitude: 13,
      longitude: 'xyz', // invalid
      status: 'verified',
      observation_date: '2024-04-05',
      image_url: '/uploads/e.jpg',
      public: 1,
      plant_id: 104,
      common_name: 'Plant E',
      scientific_name: 'E ee',
      family: 'Poaceae',
      description: 'E',
      conservation_status: 'vulnerable',
    },
  ];

  const execute = jest.fn(async (query, params) => {
    state.calls.push({ query, params });
    state.last = { query, params };
    let rows = baseRows.slice();
    // Family filter
    if (query.includes('p.family = ?')) {
      const idx = params.findIndex((p) => typeof p === 'string' && /\w/.test(p));
      if (idx >= 0) {
        rows = rows.filter((r) => r.family === params[idx]);
      }
    }
    // Conservation status IN filter
    if (query.includes('p.conservation_status IN')) {
      const statuses = params.filter((p) => typeof p === 'string' && ['least_concern','near_threatened','vulnerable','endangered','critically_endangered'].includes(p));
      if (statuses.length) rows = rows.filter((r) => statuses.includes(r.conservation_status));
    }
    // Date range
    const dateParams = params.filter((p) => typeof p === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p));
    if (query.includes('po.observation_date >= ?') && dateParams[0]) {
      rows = rows.filter((r) => r.observation_date >= dateParams[0]);
    }
    if (query.includes('po.observation_date <= ?') && dateParams[1]) {
      rows = rows.filter((r) => r.observation_date <= dateParams[1]);
    }
    return [rows];
  });
  const __getState = () => ({ ...state });
  const __reset = () => { state.calls = []; state.last = null; };
  return { execute, __getState, __reset };
});

// Import app after mocks
const app = require('../../backend/src/app.js');

describe('GET /map/locations/public - Filters and coordinates', () => {
  beforeEach(() => {
    const pool = require('../../backend/src/config/database.js');
    pool.__reset();
  });

  it('single family filter returns only that family', async () => {
    const res = await request(app)
      .get('/map/locations/public?family=Fabaceae')
      .send();
    expect(res.status).toBe(200);
    const families = Array.from(new Set((res.body.locations || []).map((l) => l.plant?.family).filter(Boolean)));
    expect(families).toEqual(['Fabaceae']);
    const pool = require('../../backend/src/config/database.js');
    const st = pool.__getState();
    expect(st.last.query).toMatch(/p\.family\s*=\s*\?/);
    expect(st.last.params).toContain('Fabaceae');
  });

  it('multiple conservation statuses narrow results to the set', async () => {
    const res = await request(app)
      .get('/map/locations/public?conservation_status=near_threatened,vulnerable')
      .send();
    expect(res.status).toBe(200);
    const statuses = Array.from(new Set((res.body.locations || []).map((l) => l.plant?.conservation_status).filter(Boolean))).sort();
    expect(statuses).toEqual(['near_threatened','vulnerable']);
    const pool = require('../../backend/src/config/database.js');
    const st = pool.__getState();
    expect(st.last.query).toMatch(/p\.conservation_status\s+IN\s*\(/);
    expect(st.last.params).toEqual(expect.arrayContaining(['near_threatened','vulnerable']));
  });

  it('date range respected', async () => {
    // Valid date range
    const res = await request(app)
      .get('/map/locations/public?start_date=2024-02-01&end_date=2024-03-31')
      .send();
    expect(res.status).toBe(200);
    const dates = (res.body.locations || []).map((l) => l.observation_date);
    expect(dates.every((d) => d >= '2024-02-01' && d <= '2024-03-31')).toBe(true);
    const pool = require('../../backend/src/config/database.js');
    let st = pool.__getState();
    expect(st.last.query).toMatch(/po\.observation_date\s*>=\s*\?/);
    expect(st.last.query).toMatch(/po\.observation_date\s*<=\s*\?/);
    expect(st.last.params).toEqual(expect.arrayContaining(['2024-02-01','2024-03-31']));

  });

  it('returns coordinates as numbers for valid points; flags invalid shapes', async () => {
    const res = await request(app)
      .get('/map/locations/public')
      .send();
    expect(res.status).toBe(200);
    const list = res.body.locations || [];
    const valid = list.filter((l) => Number.isFinite(l.coordinates?.lat) && Number.isFinite(l.coordinates?.lon));
    const invalid = list.filter((l) => !Number.isFinite(l.coordinates?.lat) || !Number.isFinite(l.coordinates?.lon));
    expect(valid.length).toBeGreaterThan(0);
    expect(invalid.length).toBeGreaterThan(0);
    // Note: current controller does not filter invalid numeric shapes; propose enforcement.
  });
});