/**
 * Identify: Delete Uploaded Image
 * - Ensures previously uploaded image is deletable
 * - Non-existent image returns 404
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Import app
const app = require('../../backend/src/app.js');

// Helpers to create and cleanup a dummy image file under backend/uploads
const TEST_FILENAME = 'test-delete.jpg';
const fileFullPath = path.resolve(__dirname, '..', '..', 'backend', 'uploads', TEST_FILENAME);

function ensureTestImage() {
  fs.writeFileSync(fileFullPath, Buffer.from('dummy-jpeg-content'));
}

function cleanupTestImage() {
  try { fs.unlinkSync(fileFullPath); } catch (_) {}
}

describe('POST /identify/delete-image', () => {
  afterEach(() => {
    cleanupTestImage();
  });

  it('Deletes an existing uploaded image and returns success', async () => {
    // Arrange: create dummy file
    ensureTestImage();
    expect(fs.existsSync(fileFullPath)).toBe(true);

    // Act: call delete-image with a URL containing the filename
    const res = await request(app)
      .post('/identify/delete-image')
      .send({ image_url: `uploads/${TEST_FILENAME}` });

    // Assert: endpoint returns success and file is gone
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'Image deleted successfully' });
    expect(fs.existsSync(fileFullPath)).toBe(false);
  });

  it('Returns 404 when the image does not exist', async () => {
    // Ensure the file does not exist
    cleanupTestImage();
    expect(fs.existsSync(fileFullPath)).toBe(false);

    const res = await request(app)
      .post('/identify/delete-image')
      .send({ image_url: `uploads/${TEST_FILENAME}` });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: 'Image not found' });
  });
});