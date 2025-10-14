const fs = require('fs');
const path = require('path');

class StorageService {
  /**
   * Simple local storage for development
   * In production, replace with AWS S3, Cloudinary, etc.
   */
  static async uploadImage(file) {
    try {
      // Create uploads directory if it doesn't exist
      const uploadDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.originalname}`;
      const filepath = path.join(uploadDir, filename);

      // Save file
      fs.writeFileSync(filepath, file.buffer);

      // Return URL (adjust based on your server setup)
      const url = `/uploads/${filename}`;
      
      console.log(`✅ Image saved: ${url}`);
      return url;

    } catch (error) {
      console.error('Storage error:', error);
      throw new Error('Failed to save image');
    }
  }

  /**
   * Delete image
   */
  static async deleteImage(imageUrl) {
    try {
      const filename = path.basename(imageUrl);
      const filepath = path.join(__dirname, '../../uploads', filename);

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`✅ Image deleted: ${imageUrl}`);
      }

      return true;
    } catch (error) {
      console.error('Delete error:', error);
      return false;
    }
  }
}

module.exports = StorageService;