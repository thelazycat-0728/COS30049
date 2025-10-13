const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    // Configure email transporter
    this.transporter = nodemailer.createTransport({
      // Option 1: Gmail (for development/testing)
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD // Use App Password, not regular password
      }

      // Option 2: Custom SMTP (recommended for production)
      // host: process.env.SMTP_HOST,
      // port: process.env.SMTP_PORT,
      // secure: true,
      // auth: {
      //   user: process.env.SMTP_USER,
      //   pass: process.env.SMTP_PASSWORD
      // }

      // Option 3: SendGrid
      // host: 'smtp.sendgrid.net',
      // port: 587,
      // auth: {
      //   user: 'apikey',
      //   pass: process.env.SENDGRID_API_KEY
      // }
    });
  }

  /**
   * Send MFA verification code
   */
  async sendMFACode(email, code, username) {
    const mailOptions = {
      from: `"SmartPlant Sarawak" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Login Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .code-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 10px; }
            .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
            .warning { color: #e74c3c; font-size: 14px; margin-top: 20px; }
            .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌿 SmartPlant Sarawak</h1>
              <p>Login Verification Required</p>
            </div>
            <div class="content">
              <p>Hello ${username || 'there'},</p>
              <p>You requested to log in to your SmartPlant account. Please use the verification code below to complete your login:</p>
              
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              
              <p><strong>This code will expire in 10 minutes.</strong></p>
              
              <p>If you didn't attempt to log in, please ignore this email or contact support if you're concerned about your account security.</p>
              
              <div class="warning">
                ⚠️ Never share this code with anyone. SmartPlant staff will never ask for your verification code.
              </div>
            </div>
            <div class="footer">
              <p>© 2025 SmartPlant Sarawak. All rights reserved.</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        SmartPlant Sarawak - Login Verification
        
        Hello ${username || 'there'},
        
        Your verification code is: ${code}
        
        This code will expire in 10 minutes.
        
        If you didn't attempt to log in, please ignore this email.
        
        Never share this code with anyone.
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ MFA email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send MFA email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Verify email configuration
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service is ready');
      return true;
    } catch (error) {
      console.error('❌ Email service error:', error);
      return false;
    }
  }
}

module.exports = new EmailService();