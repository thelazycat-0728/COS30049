/**
 * Identify: Classify Image
 * - Valid image yields predictions (proxied to AI backend)
 * - Downstream AI backend failure returns provided status (e.g., 502) with error message
 * - Missing body (no image_path) returns 400
 * - Unsupported media type simulated via downstream 415
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Ensure AI backend URL is present (value irrelevant when axios is mocked)
process.env.AI_BACKEND_URL = process.env.AI_BACKEND_URL || 'http://ai.example';

// Mock axios to avoid real network calls; configure per test
jest.mock('axios', () => ({
  post: jest.fn(),
}));

// Import app after mocks
const app = require('../../backend/src/app.js');

// Helpers to create and cleanup a dummy image file under backend/uploads
const TEST_FILENAME = 'test-classify.jpg';
const fileFullPath = path.resolve(__dirname, '..', '..', 'backend', 'uploads', TEST_FILENAME);

function ensureTestImage() {
  // Create a small dummy file
  fs.writeFileSync(fileFullPath, Buffer.from('dummy-jpeg-content'));
}

function cleanupTestImage() {
  try { fs.unlinkSync(fileFullPath); } catch (_) {}
}

describe('POST /identify/classify', () => {
  const axios = require('axios');

  afterEach(() => {
    axios.post.mockReset();
    cleanupTestImage();
  });

  it('Valid image yields predictions', async () => {
    ensureTestImage();
    axios.post.mockResolvedValue({
      data: {
        success: true,
        predictions: [
          { label: 'Rose', confidence: 0.92 },
          { label: 'Hibiscus', confidence: 0.61 },
        ],
      },
    });

    const res = await request(app)
      .post('/identify/classify')
      .send({ image_path: `uploads/${TEST_FILENAME}` });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      predictions: expect.any(Array),
    });
    expect(Array.isArray(res.body.predictions)).toBe(true);
    expect(res.body.predictions[0]).toMatchObject({ label: expect.any(String), confidence: expect.any(Number) });
  });

  it('Downstream AI backend failure returns 502 with error message', async () => {
    ensureTestImage();
    axios.post.mockRejectedValue({
      response: { status: 502, data: { message: 'Bad Gateway' } },
      message: 'Bad Gateway',
    });

    const res = await request(app)
      .post('/identify/classify')
      .send({ image_path: `uploads/${TEST_FILENAME}` });

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ success: false, error: 'Classification failed', message: 'Bad Gateway' });
  });

  it('Missing body returns 400', async () => {
    const res = await request(app)
      .post('/identify/classify')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'No image path provided' });
  });

  it('Unsupported media type (downstream 415) returns 415', async () => {
    ensureTestImage();
    axios.post.mockRejectedValue({
      response: { status: 415, data: { message: 'Unsupported Media Type' } },
      message: 'Unsupported Media Type',
    });

    const res = await request(app)
      .post('/identify/classify')
      .send({ image_path: `uploads/${TEST_FILENAME}` });

    expect(res.status).toBe(415);
    expect(res.body).toMatchObject({ success: false, error: 'Classification failed', message: 'Unsupported Media Type' });
  });
});